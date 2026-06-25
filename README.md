# Deadlock Build Simulator

Next.js App Router MVP for a Deadlock MOBA build simulator. The frontend requests hero and item data from Next.js App Router API routes. The API keeps the model close to a future Supabase-backed implementation.


## Data operations recommendation

For production, prefer a scheduled ingestion job rather than fetching game data directly from the browser:

1. A weekly cron job calls the trusted Deadlock data API.
2. The job normalizes heroes, items, stat keys, conditional effects, and localized labels.
3. The job upserts into Supabase tables (`heroes`, `items`, `item_effects`, `sync_runs`).
4. The app reads from Supabase through App Router API routes.
5. Keep manual override fields in Supabase for data that the external API does not expose cleanly.

This is safer than live browser fetches because it avoids rate limits, keeps API keys private, and lets the app continue working if the external API is temporarily unavailable.

## Local development

```bash
npm install
npm run dev
```

- App: http://localhost:3000
- API health: http://localhost:3000/api/health

## MVP scope

- PC-first single page layout.
- Left panel: hero icon/selector, level control, item picker.
- Right panel: build summary and large stats panel.
- Japanese/English UI toggle.

- Frontend fetches heroes and items from `GET /api/heroes` and `GET /api/items`.

- Automatic stat calculation from hero level, base stats, item stats, passive effects, and user-toggleable conditional effects.
- Build persistence is intentionally out of scope for the first MVP.

## Future Supabase schema sketch

- `heroes(id, external_id, name, role, icon_url, base_stats jsonb, growth_per_level jsonb, updated_at)`
- `items(id, external_id, name, category, price, icon_url, stats jsonb, updated_at)`
- `item_effects(id, item_id, name, description, stats jsonb, conditional boolean, default_enabled boolean)`
- `sync_runs(id, source, started_at, finished_at, status, error_message)`
