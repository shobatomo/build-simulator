-- DRAFT ONLY: validated in isolated PostgreSQL 16 and PGlite; not registered
-- as a migration and not applied to any Supabase project.
-- Requires versioned-assets-proposal.sql. Register separately with the Supabase
-- CLI after review. No new GRANTs: owner-operated SQL only, NOT a public RPC.
-- Prepare parameters with prepareAssetRecovery from the exact stored bundle.
begin;

create schema deadlock_admin;
revoke all on schema deadlock_admin from public, anon, authenticated, service_role;

create table deadlock_admin.asset_recovery_operations (
  operation_id uuid primary key,
  expected_revision bigint not null check (expected_revision between 1 and 9007199254740990),
  applied_revision bigint not null check (applied_revision in (expected_revision, expected_revision + 1)),
  from_snapshot_id uuid not null,
  from_normalizer_version text not null,
  target_snapshot_id uuid not null,
  target_normalizer_version text not null,
  reason text not null check (length(btrim(reason)) between 1 and 500),
  performed_by name not null default current_user,
  performed_at timestamptz not null default now(),
  foreign key (from_snapshot_id, from_normalizer_version)
    references public.deadlock_normalized_snapshots(snapshot_id, normalizer_version) on delete restrict,
  foreign key (target_snapshot_id, target_normalizer_version)
    references public.deadlock_normalized_snapshots(snapshot_id, normalizer_version) on delete restrict
);
alter table deadlock_admin.asset_recovery_operations enable row level security;
revoke all on table deadlock_admin.asset_recovery_operations from public, anon, authenticated, service_role;

create function deadlock_admin.restore_asset_release(
  p_operation_id uuid, p_expected_revision bigint,
  p_snapshot jsonb, p_catalog jsonb, p_reason text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_target_id uuid;
  v_target_normalizer text := p_catalog ->> 'normalizerVersion';
  v_current public.deadlock_active_asset_release%rowtype;
  v_operation deadlock_admin.asset_recovery_operations%rowtype;
  v_applied_revision bigint;
  v_reason text := btrim(p_reason);
begin
  if p_operation_id is null or p_expected_revision is null or
     p_expected_revision not between 1 and 9007199254740990 or
     v_reason is null or length(v_reason) not between 1 and 500 then
    raise exception 'Invalid recovery request' using errcode = '22023';
  end if;
  if jsonb_typeof(p_snapshot) is distinct from 'object' or
     jsonb_typeof(p_catalog) is distinct from 'object' or
     v_target_normalizer is distinct from '0.2.0' then
    raise exception 'Unsupported recovery bundle or normalizer' using errcode = '22023';
  end if;
  -- Same transaction lock as normal publication. Never lower/reuse a revision.
  perform pg_catalog.pg_advisory_xact_lock(1684368483, 1);
  select s.id into v_target_id
    from public.deadlock_asset_snapshots s
    join public.deadlock_normalized_snapshots n on n.snapshot_id = s.id
    where s.client_version = (p_snapshot ->> 'clientVersion')::bigint
      and s.content_hash = p_snapshot ->> 'contentHash'
      and n.normalizer_version = v_target_normalizer
      and s.snapshot_json = p_snapshot and n.normalized_json = p_catalog;
  if not found then
    raise exception 'Exact stored recovery bundle not found' using errcode = '22023';
  end if;

  -- A repeated operation can confirm a historical success, but MUST NOT restore
  -- its target again if another publication has happened since that success.
  select * into v_operation from deadlock_admin.asset_recovery_operations where operation_id = p_operation_id;
  if found then
    if v_operation.expected_revision is distinct from p_expected_revision or
       v_operation.target_snapshot_id is distinct from v_target_id or
       v_operation.target_normalizer_version is distinct from v_target_normalizer or
       v_operation.reason is distinct from v_reason then
      raise exception 'Recovery operation ID reused for different request' using errcode = '22023';
    end if;
    return jsonb_build_object('operation', to_jsonb(v_operation), 'replayed', true,
      'active', public.read_deadlock_asset_release());
  end if;

  select * into v_current from public.deadlock_active_asset_release where singleton for update;
  if not found or v_current.revision is distinct from p_expected_revision then
    raise exception 'Asset recovery revision conflict' using errcode = '40001';
  end if;
  v_applied_revision := v_current.revision;
  if v_current.snapshot_id is distinct from v_target_id or v_current.normalizer_version is distinct from v_target_normalizer then
    v_applied_revision := v_current.revision + 1;
    update public.deadlock_active_asset_release
      set snapshot_id = v_target_id, normalizer_version = v_target_normalizer,
          revision = v_applied_revision, published_at = now()
      where singleton and revision = p_expected_revision;
    if not found then
      raise exception 'Asset recovery revision conflict' using errcode = '40001';
    end if;
  end if;
  -- The pointer update and receipt either BOTH commit or BOTH roll back.
  insert into deadlock_admin.asset_recovery_operations(
    operation_id, expected_revision, applied_revision,
    from_snapshot_id, from_normalizer_version, target_snapshot_id, target_normalizer_version, reason
  ) values (p_operation_id, p_expected_revision, v_applied_revision,
    v_current.snapshot_id, v_current.normalizer_version, v_target_id, v_target_normalizer, v_reason)
    returning * into v_operation;
  return jsonb_build_object('operation', to_jsonb(v_operation), 'replayed', false,
    'active', public.read_deadlock_asset_release());
end;
$$;

revoke all on function deadlock_admin.restore_asset_release(uuid, bigint, jsonb, jsonb, text)
  from public, anon, authenticated, service_role;
-- Intentionally no application role grant and no exposed-schema registration.
commit;
