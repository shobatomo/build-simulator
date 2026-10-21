# Deadlock Build Simulator

Next.js App Router MVP for a Deadlock MOBA build simulator. The frontend requests hero and item data from Next.js API Routes. The API can sync the external Deadlock API into Supabase/PostgreSQL and then serve the existing screen from Supabase without exposing secrets to the browser.

## Data operations recommendation

For production, prefer a scheduled ingestion job rather than fetching game data directly from the browser:

1. An authorized server-side job calls `POST /api/sync/deadlock-data-first` with a bearer token matching `DEADLOCK_SYNC_SECRET`.
2. The route fetches the trusted Deadlock data API on the server.
3. The route normalizes heroes, items, abilities, stat keys, conditional effects, and localized labels.
4. The route upserts into Supabase tables (`deadlock_heroes`, `deadlock_items`, `deadlock_abilities`, `deadlock_asset_documents`, `deadlock_sync_runs`).
5. The app reads from Supabase through the Next.js API Routes.
6. Keep manual override fields in Supabase for data that the external API does not expose cleanly.

This is safer than live browser fetches because it avoids rate limits, keeps service-role credentials private, and lets the app continue working if the external API is temporarily unavailable.

### Current read and update behavior

- The frontend currently uses `GET /api/sync/deadlock-data-first`: external API first, then saved Supabase data on failure. GET never writes to the database. If the fallback lacks heroes or items, it returns `503 DATA_UNAVAILABLE` instead of starting a sync.
- `POST /api/sync/deadlock-data-first` is the only update entry point. It checks authorization before any data access. A missing, empty, or whitespace-containing `DEADLOCK_SYNC_SECRET` disables updates with `503 SYNC_NOT_CONFIGURED`. With valid configuration, a missing or invalid `Authorization: Bearer <token>` header returns `401 UNAUTHORIZED`.
- `DEADLOCK_SYNC_SECRET` is a dedicated server-side secret, separate from Supabase credentials. Never expose it through `NEXT_PUBLIC_`, client code, query strings, or source control. No secret or scheduled job is created by the code change. Production configuration and deployment require a separate operational step; leaving it unset keeps updates disabled.
- The scheduled ingestion and database-first read strategy above remains a recommendation, not an enabled scheduler.

### Isolated checks

Run `npm test`, `npm run lint`, and `npx tsc --noEmit --incremental false`. The route tests use Node's test runner and TypeScript transpilation with mocked data modules and an isolated environment. They never load `.env`, connect to Supabase, call the external API, or execute a real synchronization. `npm run build` checks the production build separately.

## Item component selection

The item picker resolves the API's `component_items` class names to item IDs using
the full English item collection before shop filtering. It records direct and
transitive components and builds a reverse index for upgrade checks. Display names,
tiers, prices and shared components are never used to guess an upgrade relationship.

- Selecting an upgrade removes every selected confirmed component, including
  multi-stage ancestors. Capacity is checked after removal, so upgrading at 12
  occupied slots works. Removed components' conditional effects are discarded;
  the new item uses only its own default effect state.
- Selecting a component while its upgrade is selected is rejected with a visible
  reason. Separate upgrades sharing a component remain selected together.
- Missing or ambiguous class references, malformed lists and cycles are diagnosable.
  Cyclic/ambiguous item identities cannot be added. No missing reference is resolved
  using an item name.
- An API record with omitted/null `component_items` declares no component edges;
  this describes the API graph, not every game exclusivity rule. Legacy saved
  `formatted_json` without `upgradeRelations` is **unavailable**, not an empty known
  graph: the UI shows a warning and only applies relationships actually present.
  Existing database rows are not rewritten or synchronized by this feature.

`tests/fixtures/item-upgrades-6807.public.json` is a version-pinned projection of
public API relationship fields. Tests cover direct/multi-stage/multiple components,
sibling branches, duplicates, hidden intermediates, full slots, effect state,
unresolved references and legacy data. Synthetic mutations are used only for error
and activation-state cases; no new game damage formula is introduced.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

- App: http://localhost:3000
- API health: http://localhost:3000/api/health

Required server-side environment variables for Supabase:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional environment variable:

- `DEADLOCK_API_BASE_URL` (defaults to `https://api.deadlock-api.com/v1/assets`)

Set the same variables in Vercel Environment Variables. Do not expose `SUPABASE_SERVICE_ROLE_KEY` with a `NEXT_PUBLIC_` prefix.

## Supabase migration

Apply `supabase/migrations/202606250001_deadlock_assets.sql` to create the persistence tables. The migration separates normalized heroes, shop items, abilities, generic asset documents, and sync run metadata while retaining the source payloads in `raw_json` columns.

## MVP scope

- PC-first single page layout.
- Left panel: hero icon/selector, level control, item picker.
- Right panel: build summary and large stats panel.
- Japanese/English UI toggle.

- Frontend fetches heroes and items from `GET /api/sync/deadlock-data-first`.

- Automatic stat calculation from hero level, base stats, item stats, passive effects, and user-toggleable conditional effects.
- Build persistence is intentionally out of scope for the first MVP.

## Future Supabase schema sketch

- `deadlock_heroes(external_id, class_name, name_en, name_ja, formatted_json, raw_json, synced_at)`
- `deadlock_items(external_id, class_name, name_en, name_ja, item_type, slot_type, formatted_json, raw_json, synced_at)`
- `deadlock_abilities(external_id, class_name, name_en, name_ja, hero_external_id, raw_json, synced_at)`
- `deadlock_asset_documents(asset_key, source_url, raw_json, synced_at)`
- `deadlock_sync_runs(id, source, endpoints, status, error_message, started_at, finished_at)`
