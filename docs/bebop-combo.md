# Bebop combo lab — local MVP

Base: published `55d87bc0020bf99e215c3a43b08400a44eda91ee` (the hero-picker CSS update after `cea56e8`). This change is developed in an isolated copy; that published CSS is preserved byte-for-byte. No database, API sync, credentials, grants or deployment changes are needed for `/combat`.

## Data and evidence

The public community-operated Assets API reported `client_version=6819`, game build timestamp `2026-10-22T16:40:35`. This is **not a Valve official API**. The version is pinned; this page does not request the latest version or blend the legacy builder's live data into the calculation.

- [Versioned Bebop abilities](https://api.deadlock-api.com/v1/assets/items/by-hero-id/15?client_version=6819)
- [Versioned weapon](https://api.deadlock-api.com/v1/assets/items/citadel_weapon_bebop_set?client_version=6819)
- [Versioned hero](https://api.deadlock-api.com/v1/assets/heroes/by-name/bebop?client_version=6819)
- [Versioned Bullet Resilience](https://api.deadlock-api.com/v1/assets/items/upgrade_improved_bullet_armor?client_version=6819)
- [Valve April 10 patch](https://forums.playdeadlock.com/threads/04-10-2026-update.125825/): Grapple Arm scales with light melee, and gun windup changes corroborate the pinned payload.
- [Valve May 22 patch](https://forums.playdeadlock.com/threads/05-22-2026-update.135477/): historical corroboration; not substituted for the pinned asset records.

`tests/fixtures/bebop-combo-6819.public.json` preserves reviewed mechanical property values, units, scaling functions, upgrades, IDs, class names, components, hero growth and cost tables. `src/domain/bebopComboRules.ts` is a small explicit projection. SHA-256 of the serialized mechanical fixture is checked by tests. Its source hash is required for a scenario; changing client/version/source rejects calculation. This is provenance, not a signature or proof of live-game accuracy.

## Implemented scope

- Attacker **Bebop**, defender **Bebop**, boon 1–36. No other hero is represented as supported.
- Independently edited builds: Extra Health, Extra Spirit, Improved Spirit, Bullet Resilience, Spirit Resilience, no item upgrade stages. Existing class-name component resolution drives replacement and reverse-add rejection. Unknown items stop assembly.
- Shot: 4.98 base, 0.115 additive growth per standard boon; 66 ammo, 0.084s cycle, 0.3s initial windup, 2.35s reload. Adjacent shot clicks maintain spin; other actions reset it. The precise spin-down rule is not reconstructed.
- Uppercut: light melee contribution only to the primary target, not the landing splash to **other** enemies. The raw `0.01` is not presented as the ability's fixed damage. T1 cooldown, T2 single gun buff/fast windup, T3 hook cooldown reset are modeled. Healing, motion, CC and conversion of gun bonuses into melee are excluded.
- Bomb: `(85 + T2 85 + 1.5 × spirit) × (1 + supplied bonus% / 100)`, delayed 3.5s. Inputs are sampled at attachment in this model. The displayed saved permanent bonus is frozen for the scenario: new stacks, kills, historic spirit values and diminish histories are **not** silently reconstructed.
- Grapple: `0.7 × light melee`, independent supplied melee resistance. T1 gives the modeled 20% **bullet-only** amp for 6s. It is never applied to spirit or melee. Cast 0.1s, impact-delay field 0.5s, explicit added travel time, postcast 0.2s; actual runtime meaning/timing remains unverified.
- Beam: `(160 + T2 108 + 2.511 × spirit)` per second, selected 0.1–11s direct-hit duration after a 1s cast. Integration is 0.1s intervals, applied at the **end** of each interval. It does not assert the real first tick time. No 75% near-AoE overlap, lifesteal or movement model. Bombs can explode during the channel.
- Ability cooldown begins at action start as an explicit timing convention. Same-time scheduled impacts resolve by insertion order. These conventions are visible on the page; they are not confirmed engine ordering.
- Uppercut impact and bomb attachment are instantaneous in this minimal timeline. Animation locks, their cast times, projectile collisions and interrupt windows are not reconstructed. Combo time therefore must not be used as a real-game DPS/TTK measurement.

All four abilities are usable at stage 0. Stage 1–3 options only change the listed supported offensive mechanics. Ability unlock/point budgets are not enforced. This is an outgoing single-target combo test, not a full fight, DPS benchmark or TTK guarantee.

## Explicit uncertainty boundaries

`resolveComboScenario` refuses unknown required values. No numeric battle is created for missing final low-health resilience values, multiple unresolved resistance sources, unknown items/heroes/provenance, invalid numbers, additional penetration/amplification, or headshots.

The initial no-base-resistance, no-base-spirit, zero-shield scenario is a declared input assumption. Growth is additive in this model. Category purchase bonuses default to **deliberately excluded**; they are not inferred from current item cost or set to zero as though the data proved zero. The user can enter already-resolved flat HP/spirit/shot additions. The UI states that exclusion does not represent the full game build.

Bullet/Spirit Resilience expose normal 30%, health threshold 50%, additional 15%. With a single source the normal resistance can be used; multiple sources require a final value. Low-health resistance always requires input because 45% additive versus 40.5% multiplicative is not established. Each hit uses pre-hit HP and strict `<50%` as an explicit convention. Melee resistance is separate, never inferred from bullet resistance. Each supplied shield absorbs its type's post-resistance damage before HP; shared barriers and bypasses are excluded.

The basic resolved-input damage equation is `D × (1 − R/100)`. Internal values stay unrounded; only display is rounded. HP clamps at zero, shield loss, HP loss and overkill are separate. No later impact damages a defeated target. Log retention is 200 rows, cumulative values cover all impacts.

## State and UI

`comboCombat.ts` is pure: no fetch, DB, clocks or global mutation. Actions return a fresh state; rejections retain identity. Time advances only through actions. Beam executes the selected channel duration in one action, with pending effects interleaved. There are no timers left behind after reset.

`comboSession.ts` separates draft settings from the immutable active scenario. Editing either side disables attacks; applying the draft resets HP, time, ammo, cooldowns and pending effects. Rapid actions use reducer state, avoiding stale closures. Reset reuses the active scenario. The existing builder is unchanged except a link to the separate lab; selections are not implicitly imported/exported.

UI shows attacker/defender labels, opposing target, floating operation damage (HP+shield actually lost), raw→mitigated last impact, cumulative raw/mitigated/HP/shield totals and per-hit formulas. Reduced-motion disables the floating animation. No external sharing, account, persistence or new API write is introduced.

The separate builder entry is labeled **experimental** (Japanese UI). Before the editor and results, an always-expanded scope panel lists version 6819, both Bebop heroes, the five supported items, manual final-resistance requirements, excluded category purchase bonuses, frozen bomb stacks, unverified game accuracy and the lack of automatic import from the existing builder. The lab explicitly declares Japanese content language even after navigating from the English builder.

## Validation and remaining work

The test suite covers fixed source data, damage arithmetic, each ability, delayed events, chronological beam/bomb interaction, threshold boundaries, unknown fields, shields/overkill/death, cooldown rejection, buff expiry, hook reset, ammo/reload, repeat clicks, draft isolation, component conflicts and reset. Browser checks and aggregate results are recorded separately in the task evidence folder.

Before describing results as real-game accurate: verify resistance composition and melee classification, cost bonuses, gun-to-melee conversion, first beam tick/order, casts and bomb snapshot timing, live permanent stack updates, shield sharing/bypass and rounding against controlled game captures. Extend supported heroes/items only with corresponding evidence and rejection tests. No real PG17/PostgREST check is needed for this standalone calculation page, and none was performed.
