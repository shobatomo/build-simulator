-- DRAFT ONLY. Read-only application grants revised after the PG16 validation.
-- The revised permission profile requires fresh validation before production.
-- Not registered as a migration and not applied to any Supabase project.
-- Supabase CLI is not installed in this environment. After review, create a
-- migration with `supabase migration new versioned_asset_snapshots` and use this
-- body. No existing deadlock_* rows or tables are modified by this proposal.
begin;

create table public.deadlock_asset_snapshots (
  id uuid primary key default gen_random_uuid(),
  client_version bigint not null check (client_version > 0),
  schema_version integer not null check (schema_version = 1),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  source_base_url text not null,
  captured_at timestamptz not null,
  snapshot_json jsonb not null check (jsonb_typeof(snapshot_json) = 'object'),
  created_at timestamptz not null default now(),
  unique (client_version, content_hash),
  unique (id, client_version, content_hash),
  check (snapshot_json ?& array['clientVersion', 'schemaVersion', 'contentHash', 'sourceBaseUrl']),
  check (jsonb_typeof(snapshot_json -> 'clientVersion') = 'number'),
  check (jsonb_typeof(snapshot_json -> 'schemaVersion') = 'number'),
  check (jsonb_typeof(snapshot_json -> 'contentHash') = 'string'),
  check (jsonb_typeof(snapshot_json -> 'sourceBaseUrl') = 'string'),
  check (snapshot_json ->> 'clientVersion' = client_version::text),
  check (snapshot_json ->> 'schemaVersion' = schema_version::text),
  check (snapshot_json ->> 'contentHash' = content_hash),
  check (snapshot_json ? 'documents'),
  check (jsonb_typeof(snapshot_json -> 'documents') = 'array'),
  check (jsonb_array_length(snapshot_json -> 'documents') = 5),
  check (source_base_url = 'https://api.deadlock-api.com/v1/assets'),
  check (snapshot_json ->> 'sourceBaseUrl' = source_base_url)
);

create table public.deadlock_normalized_snapshots (
  snapshot_id uuid not null,
  client_version bigint not null,
  source_snapshot_hash text not null,
  normalizer_version text not null check (length(normalizer_version) > 0),
  normalized_json jsonb not null check (jsonb_typeof(normalized_json) = 'object'),
  created_at timestamptz not null default now(),
  primary key (snapshot_id, normalizer_version),
  foreign key (snapshot_id, client_version, source_snapshot_hash)
    references public.deadlock_asset_snapshots(id, client_version, content_hash) on delete restrict,
  check (normalized_json ?& array['clientVersion', 'sourceSnapshotHash', 'normalizerVersion']),
  check (jsonb_typeof(normalized_json -> 'clientVersion') = 'number'),
  check (jsonb_typeof(normalized_json -> 'sourceSnapshotHash') = 'string'),
  check (jsonb_typeof(normalized_json -> 'normalizerVersion') = 'string'),
  check (normalized_json ->> 'clientVersion' = client_version::text),
  check (normalized_json ->> 'sourceSnapshotHash' = source_snapshot_hash),
  check (normalized_json ->> 'normalizerVersion' = normalizer_version),
  check (normalized_json ?& array['heroes', 'items']),
  check (jsonb_typeof(normalized_json -> 'heroes') = 'array'),
  check (jsonb_typeof(normalized_json -> 'items') = 'array'),
  check (jsonb_array_length(normalized_json -> 'heroes') > 0),
  check (jsonb_array_length(normalized_json -> 'items') > 0)
);

alter table public.deadlock_asset_snapshots enable row level security;
alter table public.deadlock_normalized_snapshots enable row level security;

-- Full raw/catalog reads and all writes are owner-only. The display migration
-- separately grants only the columns required by the small read RPC.
revoke all on table public.deadlock_asset_snapshots from public, anon, authenticated;
revoke all on table public.deadlock_normalized_snapshots from public, anon, authenticated;
-- Append-only for the application role; database owners can still maintain data.
revoke all on table public.deadlock_asset_snapshots from service_role;
revoke all on table public.deadlock_normalized_snapshots from service_role;

create table public.deadlock_active_asset_release (
  singleton boolean primary key default true check (singleton),
  revision bigint not null check (revision between 1 and 9007199254740991),
  snapshot_id uuid not null,
  normalizer_version text not null,
  published_at timestamptz not null default now(),
  foreign key (snapshot_id, normalizer_version)
    references public.deadlock_normalized_snapshots(snapshot_id, normalizer_version) on delete restrict
);
alter table public.deadlock_active_asset_release enable row level security;
revoke all on table public.deadlock_active_asset_release from public, anon, authenticated, service_role;
grant select on table public.deadlock_active_asset_release to service_role;

create function public.read_deadlock_asset_release()
returns jsonb language sql security invoker set search_path = '' as $$
  select jsonb_build_object('revision', a.revision, 'snapshot', s.snapshot_json, 'catalog', n.normalized_json)
  from public.deadlock_active_asset_release a
  join public.deadlock_asset_snapshots s on s.id = a.snapshot_id
  join public.deadlock_normalized_snapshots n on n.snapshot_id = a.snapshot_id and n.normalizer_version = a.normalizer_version
  where a.singleton;
$$;

-- One RPC is one PostgreSQL transaction. Lock also serializes first publication,
-- when there is no pointer row to lock. CAS prevents a stale job from replacing
-- a newer publication. Any exception rolls back inserts AND the pointer update.
create function public.publish_deadlock_asset_release(
  p_snapshot jsonb, p_catalog jsonb, p_expected_revision bigint
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_revision bigint;
  v_current_version bigint;
  v_snapshot_id uuid;
  v_version bigint := (p_snapshot ->> 'clientVersion')::bigint;
  v_hash text := p_snapshot ->> 'contentHash';
  v_normalizer text := p_catalog ->> 'normalizerVersion';
  v_existing_catalog jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(1684368483, 1);
  select a.revision, s.client_version into v_revision, v_current_version
    from public.deadlock_active_asset_release a
    join public.deadlock_asset_snapshots s on s.id = a.snapshot_id where a.singleton;
  if v_revision is distinct from p_expected_revision then
    raise exception 'Asset release revision conflict' using errcode = '40001';
  end if;
  if v_current_version is not null and v_version < v_current_version then
    raise exception 'Asset client version regression' using errcode = '22023';
  end if;
  insert into public.deadlock_asset_snapshots(client_version, schema_version, content_hash, source_base_url, captured_at, snapshot_json)
    values (v_version, (p_snapshot ->> 'schemaVersion')::integer, v_hash,
      p_snapshot ->> 'sourceBaseUrl', (p_snapshot ->> 'capturedAt')::timestamptz, p_snapshot)
    on conflict (client_version, content_hash) do nothing;
  select id into strict v_snapshot_id from public.deadlock_asset_snapshots where client_version = v_version and content_hash = v_hash;
  insert into public.deadlock_normalized_snapshots(snapshot_id, client_version, source_snapshot_hash, normalizer_version, normalized_json)
    values (v_snapshot_id, (p_catalog ->> 'clientVersion')::bigint, p_catalog ->> 'sourceSnapshotHash', v_normalizer, p_catalog)
    on conflict (snapshot_id, normalizer_version) do nothing;
  select normalized_json into strict v_existing_catalog from public.deadlock_normalized_snapshots
    where snapshot_id = v_snapshot_id and normalizer_version = v_normalizer;
  if v_existing_catalog is distinct from p_catalog then
    raise exception 'Normalizer version already has different content' using errcode = '22023';
  end if;
  if exists (select 1 from public.deadlock_active_asset_release where singleton and snapshot_id = v_snapshot_id and normalizer_version = v_normalizer) then
    return public.read_deadlock_asset_release();
  end if;
  insert into public.deadlock_active_asset_release(singleton, revision, snapshot_id, normalizer_version)
    values (true, coalesce(v_revision, 0) + 1, v_snapshot_id, v_normalizer)
    on conflict (singleton) do update set revision = excluded.revision, snapshot_id = excluded.snapshot_id,
      normalizer_version = excluded.normalizer_version, published_at = now();
  return public.read_deadlock_asset_release();
end;
$$;

revoke all on function public.read_deadlock_asset_release() from public, anon, authenticated, service_role;
revoke all on function public.publish_deadlock_asset_release(jsonb, jsonb, bigint) from public, anon, authenticated, service_role;
-- Both full-bundle functions are administrative, not application RPCs.

commit;
