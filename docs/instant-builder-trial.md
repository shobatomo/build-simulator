# Builder trial: fixed-version simplified combat

The existing builder's 自分 / 相手 switch edits independent hero, boon, item and conditional-effect selections. The untouched opponent is Infernus, boon 1, no items. Attacks always use 自分, even while 相手 is being edited. このビルドで試す captures both builds into the existing dialog. Closing stops held fire and preserves the editor, scroll and focus. Reset restores captured HP/shields/ammo without clearing builds. /combat retains its timed-mode UI.

## Data boundary

Normal data still uses the existing legacy read API. The explicit 試算用6819へ切替（両ビルド保持） action loads a bundled 6819 projection for both sides and the builder display. It never relabels legacy data. If a selected hero/item is absent in the destination, the switch is refused and both builds/data remain. The user can return to normal data. An explicit fixed-version start is available when normal data fails.

GET /api/trial-assets/6819 reads only a bundled public JSON string and checks its byte hash, canonical content hash, version and snapshot provenance. Mismatch returns 503. It makes no upstream or DB calls, reads no environment variables and exports no writer. The string preserves the original numeric lexemes: importing the object directly allowed the build tool to reserialize some floating-point values. The exact validated string is the response body. Existing sync authorization is untouched.

The community-parsed public Assets API was requested with client_version=6819 for steam-info and English/Japanese heroes/items. URLs and hashes are in src/data/trialDisplay6819.provenance.json. The full 16,865,091-byte raw snapshot is retained in local task evidence. The 2,457,263-byte display projection contains 42 visible heroes and 173 shop items. Display values use the legacy formatter; combat does not assume those totals are precise combat inputs.

Only attack Bebop, defense Infernus/Bebop and five mechanical item projections are supported: Extra Health, Extra Spirit, Improved Spirit, Bullet Resilience, Spirit Resilience. Unsupported heroes/items, enabled unsupported conditional effects, unknown/mismatching versions, ambiguous identities and missing required values produce side-specific diagnostics. Confirmed purchase additions cannot be reused for a different build.

Infernus defense is separate: ID 1 / hero_inferno, HP 830, HP boon growth 39, bullet/spirit resistance boon growth 0. Tests compare these fields with the same-version public raw fixture. No Bebop base values or attack model are substituted.

## Calculation contract

- Conditions live in the builder's expandable settings, outside the combat dialog. Base-zero resistance, zero shields and excluded category-bonus assumptions are explicit. Unconfirmed low-HP or multiple-resistance values block calculation; blank does not become guessed zero.
- Gun retains windup, 84 ms interval and 66-round magazine. FPS does not determine shot count. Release/cancel/blur/hidden/unmount stops its controller. Ammo exhaustion or HP 0 stops the model; reset restores ammo.
- Uppercut/Hook immediately apply one primary-target melee hit, without landing AoE.
- Bomb applies immediately using supplied rank/permanent bonus, with no fuse, cooldown or new stacks.
- Beam applies the full 11 seconds / 110 direct packets immediately. Resistance uses pre-packet HP. The full-hit projection includes hypothetical packets after HP 0 using the then-applicable low-HP resistance. Raw/projected totals, actual HP/shield loss and excess are separate. Lethal damage is not truncated and labelled as the full total.
- Temporary Uppercut/Hook buffs, healing and nearby AoE are not simulated and are disclosed. No temporary effect becomes permanent. Only gun actions advance the internal clock; no ability wait/CD/time-forward controls are shown.

InstantTrialState.total and receipts are the combined aggregate. The embedded ComboState history/cumulative fields serve the gun scheduler, not the instant-ability aggregate.

## Validation and limits

Tests cover independent editing/capture, Infernus provenance, real catalog entry, refusal cases, canonical hashes including reordered keys, instant abilities, full duration vs HP loss, thresholds/shields, hold cadence, reset, exhaustion and death. UI QA includes the actual app/API. The early QA-only copy and its /qa route/fixture overrides must never enter a release.

These are simplified model results, not in-game measurements. Hardware touch, screen-reader software and complete combat accuracy require separate validation. No DB/schema/auth/secret/environment changes or synchronization are needed.
