# xxscreeps PR plan

Companion to `docs/xxscreeps-parity-gaps.md`. Tracks active xxscreeps PRs that affect screeps-ok parity plus the selected submission queue. Full current parity counts are generated in `docs/status.md`.

Last refreshed: 2026-07-20 (pin `f01f0a23`).

> Source paths: xxscreeps engine at `/Users/mrwise/Coding/Screeps/xxscreeps/packages/xxscreeps`; this repo's adapter at `adapters/xxscreeps/`. PR validation runs in the `screeps-ok-pr` workspace via `XXSCREEPS_LOCAL` (see `conventions/xxscreeps-pr-workspace.md`).

## Current upstream PRs to track

None currently open.

[#318](https://github.com/laverdet/xxscreeps/pull/318) (invader: reset room controller on core collapse expiry) merged 2026-07-17, consumed at pin `f01f0a23` — pruned `invader-core-collapse-controller-not-reset` (INVADER-CORE-004) and `controller-unclaim-keeps-safe-mode-charges` (CTRL-UNCLAIM-004). The safeModeCooldown-after-unclaim divergence (CTRL-UNCLAIM-005) is NOT covered and stays queued below. The bump also crossed the shared-runner-context and constants-audit work, absorbed as adapter wiring (`acquireRunnerContext` second hook argument; `DEPOSIT_DECAY_TIME` moved to `mods/modern/deposit/constants.js`).

[#317](https://github.com/laverdet/xxscreeps/pull/317) (pathfinder multi-goal lifetime) merged, shipped as `@xxscreeps/pathfinder@0.4.2`, consumed at pin `427f8677`.

## Active submission queue

`parity.json` currently registers 16 open parity gaps (33 tests) plus 2 intentional expected failures (4 tests). The queue below is the agreed bug-fix focus; everything else is next-up, deferred, or blocked.

1. **`memory-parsed-json-not-refreshed-across-ticks`** (UNDOC-MEMJSON-001/-003/-004, UNDOC-MEMHACK-011) — promoted 2026-07-20 on the real-replication bar: re-parse `Memory` from raw at the tick boundary (`mods/memory/memory.ts`) instead of reusing the cached mutated `json` object. Memhack and `RawMemory._parsed` manipulation are widespread real bot patterns, and laverdet himself flagged the user expectation in his #131 review ("Users will muck with `RawMemory._parsed` and expect certain behavior to follow") — cite that, not vanilla conformance. Largest single-PR test payoff currently unblocked (4 tests).
2. **`structure-active-equal-distance-scan-order`** (STRUCTURE-ACTIVE-005) — break `isActive` ties between equal-distance same-type structures by vanilla object scan order.
3. **`game-object-json-room-tojson-null-crash`** residual (UNDOC-JSONOBJ-001) — parsed JSON snapshots omit nested `pos.x`/`pos.y`/`pos.roomName` for most object classes; include the same representative nested position fields as the live snapshots.
4. **`controller-unclaim-clears-safe-mode-cooldown`** (CTRL-UNCLAIM-005) — vanilla's unclaim SETS `safeModeCooldown` to `gameTime + SAFE_MODE_COOLDOWN` in non-novice rooms; xxscreeps's `release()` clears it. Genuine value bug, not covered by #318; needs its own upstream fix.

`controller-my-reset-returns-undefined` (CTRL-DOWNGRADE-002, CTRL-UNCLAIM-001) was removed from this queue 2026-07-20 — accepted as an intentional divergence per laverdet's undefined-shapes rulings (#128, #193, #215); see Accepted divergences below.

## Next-up areas (not currently queued)

- **`commonjs-main-exports-alias-missing`** (UNDOC-GLOBAL-003) — demoted from the queue 2026-07-20: no player-bot replication (row came from the 2026-05-02 systematic vanilla-coverage sweep, no upstream reports), failing the real-replication bar. Root cause reframed after code inspection: module execution is fine (`makeRequire` already aliases `exports` to `module.exports`); the gap is the eval channel (player console + adapter delivery), where the isolated sandbox leaks build plumbing — global `exports` is the webpack bootstrap `{}`, global `module` is the runtime library — so `module.exports.x =` throws TypeError. Reported upstream as an encapsulation-leak observation in [#328](https://github.com/laverdet/xxscreeps/issues/328); wait for laverdet's read before spending a PR slot. If a PR does happen: delete the plumbing globals after boot, give eval expressions a fresh throwaway `module = { exports: {} }`/aliased `exports` pair per command, and do NOT wire eval to the main module record (vanilla's console doesn't expose it).

- **Memory subsystem residual** (2 gaps, 2 tests) — the re-parse slice is queued above; remaining in `mods/memory/memory.ts`: cycle protection in `crunch` (`memory-circular-ref-crash` — also real-replication-worthy: a bot accidentally storing a circular ref stack-overflows the player runtime where vanilla degrades gracefully) and vanilla's first-access descriptor flip on `global.Memory` (`rawmemory-set-invalidates-parsed-memhack`).
- **`stale-pickup-target-allowed`** (UNDOC-STALEARG-001:creepPickup) — make `checkTarget` read a schema-backed field so released wrappers trip the guard uniformly; closes the whole stale-argument axis rather than just pickup.
- **`renew-creep-energy-structures-option-missing`** (3 tests) — validate the options argument and honor `options.energyStructures`.
- **Pathfinding behavior** — three independent gaps: `legacy-path-cost-callback-false-ignored` (LEGACY-PATH-010), `roomposition-find-closest-by-path-range-ignored` (ROOMPOS-FIND-010), `moveto-all-routes-blocked-walks-into-creeps` (MOVE-COLLISION-007; adjacent to screeps/engine#63 — re-verify canonical behavior before drafting).

## Deferred

- **`terminal-send-check-order-diverges`** (9 test rows) — the fix is a straightforward `checkSend` reorder in `mods/classic/brokerage/terminal.ts`, but that file sits inside laverdet's in-progress market implementation work (the wallstreet order book landed in the `f01f0a23` bump range and is still moving). Deferred until the market work settles to avoid colliding with it; largest single-PR payoff in the queue once unblocked.

## Needs upstream design conversation first

- **`live-cached-receiver-released`** (UNDOC-STALERECV-002) — end-of-tick wrapper invalidation is a blanket shared-memory buffer release, not per-object liveness. Any fix is architecturally deep (re-attach live wrappers to the new tick's buffer, or route schema access through id re-resolution), so open a design conversation with laverdet before writing code.

## Blocked

- **`look-for-at-unknown-returns-empty`** (ROOM-LOOK-006) — blocked on registering all canonical LOOK_* constants (e.g. `LOOK_POWER_CREEPS`); hardening the fallback to `ERR_INVALID_ARGS` today would break legitimate aliases.
- **`factory-power-effect-not-implemented`** (2 tests, intentional expected failure) — blocked until power-creep/effects substrate exists upstream.
- **`attack-notify-getter-api-missing`** (5 tests) — pulled from PR consideration 2026-07-20: the `notifiesWhenAttacked()` getter does not exist in stable vanilla either (the gap is registered on BOTH adapters; vanilla's `parity.json` documents the engine-source check), so the ATTACK-NOTIFY-001..004 / STRUCTURE-API-006 rows are aspirational `needs_vanilla_verification` claims. An upstream PR adding the getter would rightly get the "not even Screeps does this" response (cf. #213). Blocked on re-triaging the catalog rows against real vanilla. The one PR-able slice hiding here is different and smaller: xxscreeps's `Creep.notifyWhenAttacked` reportedly returns `null` where vanilla's setter returns `OK` (real bot pattern) — that needs its own `verified_vanilla` catalog row + test before any upstream PR.

## Accepted divergences

Intentional shape divergences are declared in the adapter's `shapeDivergences` (`adapters/xxscreeps/index.ts`) and folded into shape-test expectations, so their tests pass; only substrate-blocked gaps remain expected failures in `parity.json`:

- **`shape-flag-extra-id`** (declared divergence) — accepted 2026-06-11 per laverdet/xxscreeps#215's shape rule; `flag.id` is always `null` at runtime, so only property presence diverges.
- **`shape-body-part-always-has-boost`** (declared divergence) — #163 was closed as not desired by upstream.
- **`shape-controller-effects-always-enumerable`** (declared divergence) — deliberate `@enumerable` override on the controller's `effects` getter; empty-case key presence only.
- **`factory-power-effect-not-implemented`** (expected failure) — see Blocked above.
- **`controller-my-reset-returns-undefined`** (intentional expected failure) — accepted 2026-07-20. `controller.my` reads `undefined` instead of `false` after a claimed controller goes neutral; truthiness identical, only strict `=== false` diverges. laverdet ruled against exact undefined-shape conformance (#215 review), called vanilla's `controller.my === undefined` "a dumb quirk" (#128 review), and steered `structure.my` to `undefined` for null users (#193). Not shape-foldable (runtime value, not key presence), so it stays in `parity.json` with `intentional: true`; rows run as regression traps.

## Feature queue coordination

Portal (#159), Game.notify queueing (#161), shard-tick processor (#165), PowerSpawn / `Game.gpl` (#260), and the invader-core mod (#274) have all landed. The clean next Tier 1 feature area remains **`RoomObject.effects`** — it unlocks power and InvaderCore/stronghold work, and prior art exists on the `feature/effects-substrate` / `feature/invader-core` branches. Market is laverdet's active territory; steer clear of `mods/classic/brokerage` and `mods/mmo/wallstreet` until that work lands (see the terminal deferral above).

## Summary

| Stage | Gaps | Tests |
|---|---:|---:|
| Active submission queue | 4 | 7 |
| Next-up areas | 8 | 10 |
| Deferred (market in flight) | 1 | 9 |
| Needs design conversation | 1 | 1 |
| Blocked (open gaps + intentional) | 3 | 8 |
| Accepted divergence (intentional expected failure) | 1 | 2 |
