-- DRAFT ONLY. Local/in-memory validation only; no real Supabase application.
-- Apply AFTER versioned-assets-proposal.sql and asset-recovery-proposal.sql.
-- Register a reviewed migration before execution. No old game tables are used.
begin;

create table public.deadlock_display_projections (
  snapshot_id uuid not null,
  client_version bigint not null,
  source_snapshot_hash text not null,
  normalizer_version text not null,
  projection_version text not null check (projection_version = 'legacy-display-v1'),
  section text not null check (section in ('heroes', 'items', 'metadata')),
  payload_text text not null check (octet_length(payload_text) <= 4000000),
  content_hash text not null check (content_hash = encode(sha256(convert_to(payload_text, 'UTF8')), 'hex')),
  primary key (snapshot_id, normalizer_version, projection_version, section),
  foreign key (snapshot_id, client_version, source_snapshot_hash)
    references public.deadlock_asset_snapshots(id, client_version, content_hash) on delete restrict,
  foreign key (snapshot_id, normalizer_version)
    references public.deadlock_normalized_snapshots(snapshot_id, normalizer_version) on delete restrict,
  check (jsonb_typeof(payload_text::jsonb) = 'object'),
  check (payload_text::jsonb ?& array['section','clientVersion','snapshotHash','normalizerVersion','projectionVersion','value']),
  check ((payload_text::jsonb ->> 'section') is not distinct from section),
  check ((payload_text::jsonb ->> 'clientVersion') is not distinct from client_version::text),
  check ((payload_text::jsonb ->> 'snapshotHash') is not distinct from source_snapshot_hash),
  check ((payload_text::jsonb ->> 'normalizerVersion') is not distinct from normalizer_version),
  check ((payload_text::jsonb ->> 'projectionVersion') is not distinct from projection_version),
  check (case when section = 'metadata' then jsonb_typeof(payload_text::jsonb -> 'value') is not distinct from 'object'
    when jsonb_typeof(payload_text::jsonb -> 'value') = 'array' then jsonb_array_length(payload_text::jsonb -> 'value') > 0
    else false end)
);
alter table public.deadlock_display_projections enable row level security;
revoke all on table public.deadlock_display_projections from public, anon, authenticated, service_role;
grant select on table public.deadlock_display_projections to service_role;
grant select (id, client_version, content_hash) on public.deadlock_asset_snapshots to service_role;

-- One statement snapshot: pointer, provenance and selected sections cannot be
-- assembled across different releases. Neither raw JSON nor catalog is read.
create function public.read_deadlock_display_release(p_collection text, p_projection_version text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('revision', a.revision, 'snapshotHash', s.content_hash,
    'clientVersion', s.client_version, 'normalizerVersion', a.normalizer_version,
    'projectionVersion', p_projection_version, 'parts',
    (select jsonb_agg(jsonb_build_object('section', d.section, 'payloadText', d.payload_text, 'contentHash', d.content_hash) order by d.section)
      from public.deadlock_display_projections d where d.snapshot_id = a.snapshot_id
      and d.normalizer_version = a.normalizer_version and d.projection_version = p_projection_version
      and (d.section = 'metadata' or p_collection = 'all' or d.section = p_collection)))
  from public.deadlock_active_asset_release a
  join public.deadlock_asset_snapshots s on s.id = a.snapshot_id
  where a.singleton and p_collection in ('all','heroes','items') and p_projection_version = 'legacy-display-v1'
    and (select count(*) from public.deadlock_display_projections d where d.snapshot_id = a.snapshot_id
      and d.normalizer_version = a.normalizer_version and d.projection_version = p_projection_version) = 3;
$$;
revoke all on function public.read_deadlock_display_release(text,text) from public, anon, authenticated, service_role;
grant execute on function public.read_deadlock_display_release(text,text) to service_role;

-- A raw/catalog publication or recovery cannot commit a pointer to an incomplete
-- projection. Deferred so owner publication can insert the whole set atomically.
create function deadlock_admin.require_active_display_projection()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if exists (select 1 from public.deadlock_active_asset_release a where a.singleton and
    (select count(*) from public.deadlock_display_projections d where d.snapshot_id = a.snapshot_id
      and d.normalizer_version = a.normalizer_version and d.projection_version = 'legacy-display-v1') <> 3) then
    raise exception 'Active release requires a complete display projection' using errcode = '23514';
  end if;
  return null;
end;
$$;
revoke all on function deadlock_admin.require_active_display_projection() from public, anon, authenticated, service_role;
create constraint trigger active_display_complete after insert or update on public.deadlock_active_asset_release
  deferrable initially deferred for each row execute function deadlock_admin.require_active_display_projection();
create constraint trigger retained_display_complete after update or delete on public.deadlock_display_projections
  deferrable initially deferred for each row execute function deadlock_admin.require_active_display_projection();

-- Owner-only entry point, NOT exposed via PostgREST. Caller must first run
-- prepareDisplayProjection on the fully verified bundle. SQL binds provenance,
-- exact payload bytes and hashes; it does not reimplement the TS formatter.
create function deadlock_admin.publish_display_asset_release(
  p_snapshot jsonb, p_catalog jsonb, p_expected_revision bigint, p_projection jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_snapshot_id uuid;
  v_part jsonb;
  v_existing public.deadlock_display_projections%rowtype;
  v_projection text := p_projection ->> 'projectionVersion';
  v_normalizer text := p_catalog ->> 'normalizerVersion';
begin
  if v_projection is distinct from 'legacy-display-v1' or v_normalizer is distinct from '0.2.0'
    or jsonb_typeof(p_projection -> 'parts') is distinct from 'array' then
    raise exception 'Invalid display publication' using errcode = '22023';
  end if;
  if jsonb_array_length(p_projection -> 'parts') <> 3 then
    raise exception 'Incomplete display publication' using errcode = '22023';
  end if;
  if (select count(distinct value ->> 'section') from jsonb_array_elements(p_projection -> 'parts')) <> 3 then
    raise exception 'Duplicate display sections' using errcode = '22023';
  end if;
  -- Shares the original transaction lock/CAS and keeps raw/catalog unchanged.
  perform public.publish_deadlock_asset_release(p_snapshot, p_catalog, p_expected_revision);
  select id into strict v_snapshot_id from public.deadlock_asset_snapshots
    where client_version = (p_snapshot ->> 'clientVersion')::bigint and content_hash = p_snapshot ->> 'contentHash';
  for v_part in select value from jsonb_array_elements(p_projection -> 'parts') loop
    insert into public.deadlock_display_projections(snapshot_id, client_version, source_snapshot_hash,
      normalizer_version, projection_version, section, payload_text, content_hash)
      values (v_snapshot_id, (p_snapshot ->> 'clientVersion')::bigint, p_snapshot ->> 'contentHash',
        v_normalizer, v_projection, v_part ->> 'section', v_part ->> 'payloadText', v_part ->> 'contentHash')
      on conflict (snapshot_id, normalizer_version, projection_version, section) do nothing;
    select * into strict v_existing from public.deadlock_display_projections where snapshot_id = v_snapshot_id
      and normalizer_version = v_normalizer and projection_version = v_projection and section = v_part ->> 'section';
    if v_existing.payload_text is distinct from v_part ->> 'payloadText' or v_existing.content_hash is distinct from v_part ->> 'contentHash' then
      raise exception 'Projection version already has different content' using errcode = '22023';
    end if;
  end loop;
  if (select count(*) from public.deadlock_display_projections where snapshot_id = v_snapshot_id
    and normalizer_version = v_normalizer and projection_version = v_projection) <> 3 then
    raise exception 'Incomplete display publication' using errcode = '23514';
  end if;
  -- Only a receipt leaves the DB; never echo the ~49 MB administrative input.
  return (select jsonb_build_object('revision', a.revision, 'snapshotHash', p_snapshot ->> 'contentHash',
    'clientVersion', (p_snapshot ->> 'clientVersion')::bigint, 'normalizerVersion', v_normalizer,
    'projectionVersion', v_projection) from public.deadlock_active_asset_release a where a.singleton);
end;
$$;
revoke all on function deadlock_admin.publish_display_asset_release(jsonb,jsonb,bigint,jsonb)
  from public, anon, authenticated, service_role;
-- No grants/policies for anon/authenticated and no schema exposure/role creation.
commit;
