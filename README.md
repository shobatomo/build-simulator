# Deadlock Build Simulator

Next.js App Router MVP for a Deadlock MOBA build simulator. The frontend requests hero and item data from Next.js API Routes. The API can sync the external Deadlock API into Supabase/PostgreSQL and then serve the existing screen from Supabase without exposing secrets to the browser.

## Data operations recommendation

For production, prefer a scheduled ingestion job rather than fetching game data directly from the browser:

1. A scheduled job calls `POST /api/sync/deadlock-data-first`.
2. The route fetches the trusted Deadlock data API on the server.
3. The route normalizes heroes, items, abilities, stat keys, conditional effects, and localized labels.
4. The route upserts into Supabase tables (`deadlock_heroes`, `deadlock_items`, `deadlock_abilities`, `deadlock_asset_documents`, `deadlock_sync_runs`).
5. The app reads from Supabase through the Next.js API Routes.
6. Keep manual override fields in Supabase for data that the external API does not expose cleanly.

This is safer than live browser fetches because it avoids rate limits, keeps service-role credentials private, and lets the app continue working if the external API is temporarily unavailable.

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
