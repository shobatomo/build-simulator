# Deadlock API response structure checked for Supabase sync

The current sync code fetches these external Deadlock asset endpoints from `DEADLOCK_API_BASE_URL`:

- `heroes?language=english&only_active=true`
- `heroes?language=japanese&only_active=true`
- `items?language=english`
- `items?language=japanese`
- `icons`

The bundled OpenAPI file describes `/v1/assets/heroes` as an array of `Hero` objects. Fields used by the app include:

- `id`
- `class_name`
- `name`
- `description.role`
- `description.playstyle`
- `images`
- `items.weapon_primary`
- `starting_stats`
- `standard_level_up_upgrades`

The bundled OpenAPI file describes `/v1/assets/items` as an array whose item schema is a union of:

- `Ability`
- `Weapon`
- `Upgrade`

Fields used by the app and Supabase sync include:

- common fields: `id`, `class_name`, `name`, `type`, `hero`, `heroes`, `image`, `image_webp`, `properties`, `weapon_info`
- upgrade fields: `item_slot_type`, `item_tier`, `activation`, `is_active_item`, `shopable`, `cost`, `description`, `tooltip_sections`, shop image fields
- ability fields: `ability_type`, `description`, `tooltip_details`, `upgrades`, `videos`

Because the upstream schema is broad and can change, the migration stores the full bilingual source payload in `raw_json` for heroes, items, and abilities. The app-facing normalized shape is also stored in `formatted_json` for heroes and shop items so the existing UI can keep using the current `Hero` and `Item` types.
