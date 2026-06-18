# xxscreeps PR plan

Companion to `docs/xxscreeps-parity-gaps.md`. Tracks active xxscreeps PRs that affect screeps-ok parity plus selected submission queue. Full current parity counts are generated in `docs/status.md`.

Last refreshed: 2026-06-18 (pin `8e6a71b9`).

> Source paths: xxscreeps engine at `/Users/mrwise/Coding/Screeps/xxscreeps/packages/xxscreeps`; this repo's adapter at `adapters/xxscreeps/`. PR validation runs in the `screeps-ok-pr` workspace via `XXSCREEPS_LOCAL` (see `conventions/xxscreeps-pr-workspace.md`).

## Current upstream PRs to track

These are the open PRs that either close current parity gaps or occupy Tier 1 feature territory. Older parity PRs through #165 have merged or been resolved into current expected-failure state; that includes Portal in [#159](https://github.com/laverdet/xxscreeps/pull/159), Game.notify queueing in [#161](https://github.com/laverdet/xxscreeps/pull/161), world-size parity in [#164](https://github.com/laverdet/xxscreeps/pull/164), and shard tick processors in [#165](https://github.com/laverdet/xxscreeps/pull/165). Pin `15df4bea` picked up memory accuracy work that closes the eager `RawMemory.set` limit check and most RawMemory.set memhack rows; pin `8e6a71b9` includes PowerSpawn / `Game.gpl` work from #260 and closes the stale ConstructionSite.remove plus same-tick spawning gaps.

| PR | Title | Relevance |
|---|---|---|
| _None currently tracked_ | n/a | Prior tracked PRs through #260 are included in pin `8e6a71b9`. |

## Current parity queue

`docs/status.md` currently reports 21 expected-failure classifications: 20 open parity gaps covering 45 tests, plus 1 intentional divergence covering 2 tests.

### Memory residuals

The RawMemory.set guard and mutation-preservation rows now pass on pin `15df4bea`; remaining memory gaps are smaller follow-ups:

- **`memory-circular-ref-crash`** — add cycle protection around `mods/memory/memory.ts` `crunch`, or move the normalizer under the existing serialization catch if upstream prefers the smaller intervention.
- **`memory-parsed-json-not-refreshed-across-ticks`** — reset module-level parsed Memory state at the tick boundary so the next access re-parses raw memory.
- **`foreign-segment-clear-request`** — make `setActiveForeignSegment(null)` clear the pending foreign-segment request so `RawMemory.foreignSegment` becomes `undefined` next tick.
- **Residual `rawmemory-set-invalidates-parsed-memhack` test** — mirror vanilla's first-access descriptor flip so `Memory` becomes a value descriptor after it is read.

### Accepted divergences

Intentional shape divergences are declared in the adapter's `shapeDivergences` (`adapters/xxscreeps/index.ts`) and folded into shape-test expectations, so their tests pass; only substrate-blocked gaps remain expected failures in `parity.json`:

- **`shape-flag-extra-id`** (declared divergence) — accepted 2026-06-11 per laverdet/xxscreeps#215's shape rule; `flag.id` is always `null` at runtime, so only property presence diverges. The queued upstream PR is retired — the narrow fix attempt regressed ConstructionSite schema layout (`docs/xxscreeps-flag-id-plan.md`), and laverdet's PR 133 openness to special-casing Flag keeps the door open if it ever becomes worth revisiting.
- **`shape-body-part-always-has-boost`** (declared divergence) — #163 was closed as not desired by upstream.
- **`factory-power-effect-not-implemented`** (expected failure) — accepted as blocked until power creep/effects substrate exists upstream.

## Feature queue coordination

Portal landed in #159, Game.notify queueing landed in #161, the shard-tick processor landed in #165, and PowerSpawn / `Game.gpl` landed in #260. The clean next Tier 1 feature area is **`RoomObject.effects`** because it unlocks later Power and InvaderCore/stronghold work without colliding with current PRs. The remaining small standalone Tier 1 choices are construction-site stomping and spawn stomping.

## Summary

| Stage | Count | Tests |
|---|---:|---:|
| Open PRs expected to close current gaps | 0 | 0 |
| Open Tier 1 feature PRs | 0 | n/a |
| Memory residuals | 4 residual areas | 7 |
| Accepted divergences (2 declared on adapter, 1 expected failure) | 3 | 5 |
