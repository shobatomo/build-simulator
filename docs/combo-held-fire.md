# Bebop combo icons and held fire

This release changes the experimental `/combat` interface only. The existing builder, data-read mode, database, sync authorization and deployment environment remain unchanged.

## Interaction and timing

- Mouse/touch pointer hold and Space/Enter hold begin the weapon windup. Release stops firing. A separate one-shot button and assistive-technology activation support discrete confirmation.
- The pinned 6819 model uses 300 ms windup (50 ms during the modeled Uppercut buff), 84 ms shot intervals, 66 ammunition and 2.35 s reload. Releasing resets windup; this timing convention remains an approximation pending game measurement.
- `HoldFireController` owns one timer and one input owner. It reports monotonic elapsed time, not a number of animation frames. The pure combat transition catches up scheduled shots in chronological order. No shot is processed before the full scheduled millisecond has elapsed.
- Release, pointer cancellation/lost capture, button/window blur, pagehide, hidden document, reset, draft edit and component unmount cancel the hold. Empty ammunition or target death also stops it. Abilities and explicit time controls are unavailable while held; release before composing the next action.
- Every hit applies the existing resistance/shield rules. A queued bomb can kill the target before the next bullet; that bullet is neither counted nor charged. The model clock freezes at the terminal hit on death or ammunition exhaustion.

## Visual and accessibility contract

- Local public game artwork, source URLs and SHA-256 checksums are recorded in `combo-icons.json`. Assets were selected from community parsed versioned data; this is not an official Valve API.
- The five supported items, all four abilities, weapon, fist, resistance properties and armor use real source icons. Item names/effects remain in an expandable list; buttons retain accessible names and tooltips. Native controls remain keyboard-operable.
- Damage numbers have a transparent background. The user-selected palette is orange-yellow for bullets, purple for spirit, and a fist beside melee. This does not claim to be the game's official default palette.
- Shot feedback shows each actual hit, including interleaved queued spirit damage. Other actions aggregate by damage type. Feedback excludes overkill and includes HP plus shield actually lost, without an explanatory overlay label. At most eight numbers are drawn; calculations and cumulative totals include every hit. Reduced-motion feedback fades without moving and shows only the latest number.
- The always-visible trial notice still identifies Bebop versus Bebop, five items, omitted category bonuses, frozen bomb stacks, manual unresolved resistance and absence of in-game verification. Details explain the other approximations. Existing-builder selections are not automatically imported.

## Verification

The test suite includes windup boundaries, interval count, coarse/fine scheduler equivalence, early release/restart, cancellation generations, duplicate input ownership, delayed callbacks, all safety listeners and cleanup, ammunition, death, pending bomb ordering, per-hit shields/resistance, buff expiry, flash types, reset and draft isolation. Browser checks cover pointer and keyboard holds/releases, focus-loss cancellation, exhaustion, all abilities, manual low-HP validation, icons and responsive layouts. Real iOS/Android touch hardware and screen-reader speech output remain unverified.
