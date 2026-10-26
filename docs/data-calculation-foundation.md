# Versioned data and damage calculation foundation

> 更新: 2026-10-26 に専用 PostgreSQL 16 で保存・復旧・競合の 14 項目を検証し、cluster を停止しました。以下の当初の未検証記述については [最新結果](postgresql-validation.md) を参照してください。Supabase PG17 / PostgREST と本番有効化は未完了です。

This foundation is separate from the existing screen and synchronization route.
The protected POST and read-only GET remain intact. The follow-up implementation
in [internal-assets-and-combat.md](internal-assets-and-combat.md) adds an injected
storage adapter and a limited build resolver, without connecting them to the live
routes, June data, or current external-API-first read path.

## Boundaries

1. `src/server/deadlockSnapshot.ts` lists public client versions and captures an
   explicitly selected version. It issues only public GET requests, with no auth,
   cookies, environment configuration or database access. Capture returns data in
   memory; nothing is fetched merely by importing the module.
2. `src/domain/assets/normalize.ts` derives a versioned catalog from a verified raw
   snapshot. Use `normalizeVerifiedSnapshot` from the server adapter when accepting
   stored snapshots. It runs `verifySnapshot` before the pure domain normalizer and
   checks document completeness, source URLs, version agreement and SHA-256 hashes.
3. `src/domain/combat.ts` takes separate attack, defense and condition inputs and
   returns an explicit-input single-hit estimate or a reason why it cannot do so.

There is no new API route or UI integration. The new persistence adapter requires
separately approved database setup and integration; it never upserts old June rows.

## Snapshot contract

Capture fixes `client_version` for `steam-info`, English/Japanese heroes, and
English/Japanese items. Heroes use `only_active=false` so hidden records needed for
relationships are retained. The Steam manifest must report the selected version.
Collection responses do not independently report a version; consistency relies
on the versioned endpoint contract and manifest validation, not guessed row dates.
One failed locale prevents a partial snapshot from being accepted.

Every document records URL, locale, requested version, fetched time, full JSON and
a checksum. The aggregate checksum covers the game version and document identities;
capture timestamps do not change content identity. Checksums represent parsed JSON,
not original response bytes or JSON object key order. The unversioned icon index is
outside this calculation snapshot; image URLs in entities are retained.

The raw payload preserves unknown fields and all entity types. Normalization retains
IDs, class names, locale-specific source objects, original property values, units,
conditions, usage flags, scale functions, ability upgrade stages, full weapon info,
growth tables, cost bonuses and component class-name references. Japanese-only IDs
and properties survive. Missing translations remain null rather than masquerading
as translated text. Invalid IDs remain in raw with an issue; duplicate IDs and
mixed game versions are rejected. Unknown properties are not executable formulas.

`normalizerVersion` is currently `0.2.0`: object key order no longer affects derived
property-array order or locale-value diagnostics after a JSONB round trip. Bump it
whenever output structure or value interpretation changes. Preserve old snapshots.

## Values and current game rules

Numeric values and whole numeric strings (including scientific notation) are parsed.
Recognized inline units are `%`, `s`, `ms`, `m`, `m/s`, and `souls`; no unit conversion
or stacking rule is inferred. Prefix/postfix/display-unit metadata is retained
separately. Ranges, rank lists, expressions, unknown units and missing values stay
unknown with their original value; they never silently become zero.

The initial API investigation reported game version 6807 and empty
`purchase_bonuses` after build 6711. The normalizer preserves this legacy field for
older snapshots, but does not apply tier-based bonuses. It retains `cost_bonuses`
as a threshold table without choosing a cumulative/highest-threshold formula.
Purchase accounting, component costs and thresholds need measured fixtures first.
The follow-up public 6819 fixture retains that limitation; see the linked document.

## Implemented calculation model

The model accepts a weapon shot or one ability hit with **explicit raw damage at
impact**, explicit final resistance, current HP and an applicable shield amount.
The attacker and defender carry separate build selections and matching raw snapshot
hashes, game and normalizer versions. Selections are provenance: item effects, growth, ability
scaling and rank upgrades are not resolved by this low-level model. The follow-up
`buildCombat.ts` wrapper resolves a limited Bebop profile before calling it.

For the named `resolved-single-hit-v1` approximation only:

```
post-resistance damage = raw damage at impact * (1 - supplied resistance / 100)
shield damage = min(applicable shield, post-resistance damage)
health damage = min(current HP, remaining damage)
```

Results are always `assumption-based`, never advertised as verified game damage.
They return assumptions, shield/health consumption, remaining values and overkill.
Unknown inputs return `incomplete`; mismatched versions or invalid values return
`invalid`. Nonzero penetration/amplification, special effects and headshots return
`unsupported` with no numerical estimate. Resistance stacking, penetration order,
proc effects, shield bypass/type interactions, multi-hit abilities, damage over
time and target statuses are not implemented. Negative final resistance is accepted
as an explicit input, not calculated from or capped by unverified game rules.

## Validation and later work

`npm test` runs contract fixtures, value parsing, snapshot integrity, pure impact
calculation and the existing sync protection tests. The 6807 fixture is explicitly
synthetic: its field structures are representative, but its names and numeric
values are not current balance data. Tests block unmocked network access and never
read `.env` or invoke a real sync. Full game accuracy still needs approved public
response fixtures and in-game measurements pinned to the same game version.

`docs/migrations/versioned-assets-proposal.sql` is a draft, not an applied or
registered migration. It creates separate append-only snapshot tables, enables
RLS and grants only server-side access. Raw and normalized rows are append-only;
an active pointer and atomic RPC were added in the follow-up. A composite foreign
key and JSON checks bind normalized data to the raw snapshot's version and hash.
The environment has no Supabase CLI;
register the reviewed SQL with `supabase migration new` before future application.
No grants or database changes have been executed on a real database. The draft is
tested only in a disposable in-memory PGlite database.

See the follow-up document for the implemented storage/pointer/build resolver and
remaining cost accounting, measured game rules and deployment steps. Scheduling,
live integration and sharing remain outside scope. Matchup UI requires consultation.
