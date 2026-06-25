create table if not exists public.deadlock_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  endpoints text[] not null default '{}',
  status text not null check (status in ('started', 'success', 'error')),
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.deadlock_asset_documents (
  asset_key text primary key,
  source_url text not null,
  raw_json jsonb not null,
  synced_at timestamptz not null default now(),
  sync_run_id uuid references public.deadlock_sync_runs(id) on delete set null
);

create table if not exists public.deadlock_heroes (
  external_id bigint primary key,
  class_name text not null,
  name_en text not null,
  name_ja text not null,
  role_en text,
  role_ja text,
  icon_url text,
  formatted_json jsonb not null,
  raw_json jsonb not null,
  synced_at timestamptz not null default now(),
  sync_run_id uuid references public.deadlock_sync_runs(id) on delete set null
);

create table if not exists public.deadlock_items (
  external_id bigint primary key,
  class_name text not null,
  name_en text not null,
  name_ja text not null,
  item_type text not null,
  slot_type text,
  tier integer,
  price integer,
  shopable boolean,
  hero_external_id bigint,
  formatted_json jsonb,
  raw_json jsonb not null,
  synced_at timestamptz not null default now(),
  sync_run_id uuid references public.deadlock_sync_runs(id) on delete set null
);

create table if not exists public.deadlock_abilities (
  external_id bigint primary key,
  class_name text not null,
  name_en text not null,
  name_ja text not null,
  hero_external_id bigint,
  ability_type text,
  image_url text,
  raw_json jsonb not null,
  synced_at timestamptz not null default now(),
  sync_run_id uuid references public.deadlock_sync_runs(id) on delete set null
);

create index if not exists deadlock_items_type_idx on public.deadlock_items(item_type);
create index if not exists deadlock_items_slot_idx on public.deadlock_items(slot_type);
create index if not exists deadlock_abilities_hero_idx on public.deadlock_abilities(hero_external_id);
create index if not exists deadlock_sync_runs_started_at_idx on public.deadlock_sync_runs(started_at desc);

alter table public.deadlock_sync_runs enable row level security;
alter table public.deadlock_asset_documents enable row level security;
alter table public.deadlock_heroes enable row level security;
alter table public.deadlock_items enable row level security;
alter table public.deadlock_abilities enable row level security;
