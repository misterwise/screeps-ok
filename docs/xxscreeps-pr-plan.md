# xxscreeps PR plan

Companion to `docs/xxscreeps-parity-gaps.md`. Tracks active xxscreeps PRs that affect screeps-ok parity plus selected submission queue. Full current parity counts are generated in `docs/status.md`.

Last refreshed: 2026-05-04 (pin `3f011d0a`).

> Source paths: xxscreeps engine at `/Users/mrwise/Coding/Screeps/xxscreeps/packages/xxscreeps`; this repo's adapter at `adapters/xxscreeps/`. PR validation runs in the `screeps-ok-pr` workspace via `XXSCREEPS_LOCAL` (see `conventions/xxscreeps-pr-workspace.md`).

## Current upstream PRs to track

These are the open PRs that either close current parity gaps or occupy Tier 1 feature territory. Older parity PRs through #164 have merged or been resolved into current expected-failure state; that includes Portal in [#159](https://github.com/laverdet/xxscreeps/pull/159), Game.notify queueing in [#161](https://github.com/laverdet/xxscreeps/pull/161), and world-size parity in [#164](https://github.com/laverdet/xxscreeps/pull/164). Pin `3f011d0a` also picked up [#169](https://github.com/laverdet/xxscreeps/pull/169), closing `construction-site-blocked-by-same-type-ruin`.

| PR | Title | Relevance |
|---|---|---|
| [#140](https://github.com/laverdet/xxscreeps/pull/140) | Fix RawMemory.set guards: eager 2 MB throw + preserve in-tick Memory mutations | Blocks most remaining memory follow-ups. Re-run parity after this lands before opening more memory PRs. |
| [#165](https://github.com/laverdet/xxscreeps/pull/165) | Add shard tick processors for Game.notify delivery | Stacked on merged #161. Leaves `notifyWhenAttacked` damage-side notifications out of scope. |

## Current parity queue

`docs/status.md` currently reports 46 expected-failure classifications: 43 open parity gaps covering 121 tests, plus 3 accepted divergences covering 5 tests.

### Wait for open PRs

- **`rawmemory-set-no-eager-limit-check`** — wait for #140 to land, then verify MEMORY-004.
- **`rawmemory-set-invalidates-parsed-memhack`** — wait for #140 first. It may close the core `RawMemory.set` mutation-preservation issue, but the descriptor-flip and object-memory accessor tests may leave residual work.

### Queue after #140 lands

Split memory residuals into focused PRs after rebasing on #140:

- **`memory-circular-ref-crash`** — add cycle protection around `mods/memory/memory.ts` `crunch`, or move the normalizer under the existing serialization catch if upstream prefers the smaller intervention.
- **`memory-parsed-json-not-refreshed-across-ticks`** — reset module-level parsed Memory state at the tick boundary so the next access re-parses raw memory.
- **`foreign-segment-clear-request`** — make `setActiveForeignSegment(null)` clear the pending foreign-segment request so `RawMemory.foreignSegment` becomes `undefined` next tick.
- **Residual `rawmemory-set-invalidates-parsed-memhack` tests** — if #140 does not close all six tests, route object `.memory` access through the same in-tick pinned Memory binding that plain `Memory` access uses.

### Independent queued PR

- **`shape-flag-extra-id`** — Flag still exposes an `id` field even though vanilla flags are named objects without ids. Use `docs/xxscreeps-flag-id-plan.md` as the starting point, but avoid the shelved Option A diff that disturbed ConstructionSite schema layout.

### Accepted divergences

These remain expected failures in screeps-ok unless upstream changes direction:

- **`controller-my-never-owned-returns-false`** — accepted by upstream in #128.
- **`shape-body-part-always-has-boost`** — #163 was closed as not desired by upstream.
- **`factory-power-effect-not-implemented`** — accepted as blocked until power creep/effects substrate exists upstream.

## Feature queue coordination

For new feature work, do not duplicate the shard-tick processor while #165 is open. Portal landed in #159 and Game.notify queueing landed in #161. The clean next Tier 1 feature area is **`RoomObject.effects`** because it unlocks later Power and InvaderCore/stronghold work without colliding with current PRs. After that, the remaining small standalone Tier 1 choices are construction-site stomping, spawn stomping, and `Game.gpl`.

## Summary

| Stage | Count | Tests |
|---|---:|---:|
| Open PRs expected to close current gaps | 1 | 7+ |
| Open Tier 1 feature PRs | 1 | n/a |
| Queued after #140 | 4 residual areas | up to 12 |
| Independent queued parity PR | 1 | 1 |
| Accepted divergences | 3 | 5 |
