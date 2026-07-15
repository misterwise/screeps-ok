# xxscreeps PR plan

Companion to `docs/xxscreeps-parity-gaps.md`. Tracks active xxscreeps PRs that affect screeps-ok parity plus the selected submission queue. Full current parity counts are generated in `docs/status.md`.

Last refreshed: 2026-07-15 (pin `427f8677`).

> Source paths: xxscreeps engine at `/Users/mrwise/Coding/Screeps/xxscreeps/packages/xxscreeps`; this repo's adapter at `adapters/xxscreeps/`. PR validation runs in the `screeps-ok-pr` workspace via `XXSCREEPS_LOCAL` (see `conventions/xxscreeps-pr-workspace.md`).

## Current upstream PRs to track

| PR | Title | Relevance |
|---|---|---|
| _None currently tracked_ | n/a | [#317](https://github.com/laverdet/xxscreeps/pull/317) (pathfinder multi-goal lifetime) merged, shipped as `@xxscreeps/pathfinder@0.4.2`, consumed at pin `427f8677`. |

## Active submission queue

`parity.json` currently registers 17 open parity gaps (35 tests) plus 1 intentional expected failure (2 tests). The queue below is the agreed bug-fix focus; everything else is next-up, deferred, or blocked.

1. **`invader-core-collapse-controller-not-reset`** (INVADER-CORE-004) — reset the room controller in the collapse branch of `mods/invader/processor.ts` to match vanilla (user null, level 0, progress 0, timers cleared, `isPowerEnabled` false, effects null). The in-source TODO overstates the prerequisite: vanilla clears any controller in the room, so the fix does not wait for stronghold deployment.
2. **`controller-my-reset-returns-undefined`** (CTRL-DOWNGRADE-002, CTRL-UNCLAIM-001) — `OwnedStructure.my` returns `undefined` instead of `false` after a claimed controller goes neutral via unclaim or RCL 1 downgrade.
3. **`commonjs-main-exports-alias-missing`** (UNDOC-GLOBAL-003) — wire the direct main-path `exports` global as an alias of `module.exports`, mirroring how `driver/runtime/module.ts` executes CommonJS modules.
4. **`structure-active-equal-distance-scan-order`** (STRUCTURE-ACTIVE-005) — break `isActive` ties between equal-distance same-type structures by vanilla object scan order.
5. **`game-object-json-room-tojson-null-crash`** residual (UNDOC-JSONOBJ-001) — parsed JSON snapshots omit nested `pos.x`/`pos.y`/`pos.roomName` for most object classes; include the same representative nested position fields as the live snapshots.

## Next-up areas (not currently queued)

- **Memory subsystem** (3 gaps, 6 tests) — cohesive slice in `mods/memory/memory.ts`: re-parse `Memory` at the tick boundary (`memory-parsed-json-not-refreshed-across-ticks`, 4 tests), cycle protection in `crunch` (`memory-circular-ref-crash`), and vanilla's first-access descriptor flip on `global.Memory` (`rawmemory-set-invalidates-parsed-memhack`).
- **`stale-pickup-target-allowed`** (UNDOC-STALEARG-001:creepPickup) — make `checkTarget` read a schema-backed field so released wrappers trip the guard uniformly; closes the whole stale-argument axis rather than just pickup.
- **`attack-notify-getter-api-missing`** (5 tests) — `notifiesWhenAttacked` getter plus `notifyWhenAttacked` return-code fixes.
- **`renew-creep-energy-structures-option-missing`** (3 tests) — validate the options argument and honor `options.energyStructures`.
- **Pathfinding behavior** — three independent gaps: `legacy-path-cost-callback-false-ignored` (LEGACY-PATH-010), `roomposition-find-closest-by-path-range-ignored` (ROOMPOS-FIND-010), `moveto-all-routes-blocked-walks-into-creeps` (MOVE-COLLISION-007; adjacent to screeps/engine#63 — re-verify canonical behavior before drafting).

## Deferred

- **`terminal-send-check-order-diverges`** (9 test rows) — the fix is a straightforward `checkSend` reorder in `mods/market/terminal.ts`, but that file sits inside laverdet's in-progress market implementation work. Deferred until the market work settles to avoid colliding with it; largest single-PR payoff in the queue once unblocked.

## Needs upstream design conversation first

- **`live-cached-receiver-released`** (UNDOC-STALERECV-002) — end-of-tick wrapper invalidation is a blanket shared-memory buffer release, not per-object liveness. Any fix is architecturally deep (re-attach live wrappers to the new tick's buffer, or route schema access through id re-resolution), so open a design conversation with laverdet before writing code.

## Blocked

- **`look-for-at-unknown-returns-empty`** (ROOM-LOOK-006) — blocked on registering all canonical LOOK_* constants (e.g. `LOOK_POWER_CREEPS`); hardening the fallback to `ERR_INVALID_ARGS` today would break legitimate aliases.
- **`factory-power-effect-not-implemented`** (2 tests, intentional expected failure) — blocked until power-creep/effects substrate exists upstream.

## Accepted divergences

Intentional shape divergences are declared in the adapter's `shapeDivergences` (`adapters/xxscreeps/index.ts`) and folded into shape-test expectations, so their tests pass; only substrate-blocked gaps remain expected failures in `parity.json`:

- **`shape-flag-extra-id`** (declared divergence) — accepted 2026-06-11 per laverdet/xxscreeps#215's shape rule; `flag.id` is always `null` at runtime, so only property presence diverges.
- **`shape-body-part-always-has-boost`** (declared divergence) — #163 was closed as not desired by upstream.
- **`shape-controller-effects-always-enumerable`** (declared divergence) — deliberate `@enumerable` override on the controller's `effects` getter; empty-case key presence only.
- **`factory-power-effect-not-implemented`** (expected failure) — see Blocked above.

## Feature queue coordination

Portal (#159), Game.notify queueing (#161), shard-tick processor (#165), PowerSpawn / `Game.gpl` (#260), and the invader-core mod (#274) have all landed. The clean next Tier 1 feature area remains **`RoomObject.effects`** — it unlocks power and InvaderCore/stronghold work, and prior art exists on the `feature/effects-substrate` / `feature/invader-core` branches. Market is laverdet's active territory; steer clear of `mods/market` until that work lands (see the terminal deferral above).

## Summary

| Stage | Gaps | Tests |
|---|---:|---:|
| Open PRs expected to close current gaps | 0 | 0 |
| Active submission queue | 5 | 6 |
| Next-up areas | 9 | 18 |
| Deferred (market in flight) | 1 | 9 |
| Needs design conversation | 1 | 1 |
| Blocked (open gap + intentional) | 2 | 3 |
