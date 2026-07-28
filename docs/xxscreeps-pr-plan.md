# xxscreeps PR plan

Companion to `docs/xxscreeps-parity-gaps.md`. Tracks active xxscreeps PRs that affect screeps-ok parity plus the selected submission queue. Full current parity counts are generated in `docs/status.md`.

Last refreshed: 2026-07-25 (pin `d2268ac5`).

> Source paths: xxscreeps engine at `/Users/mrwise/Coding/Screeps/xxscreeps/packages/xxscreeps`; this repo's adapter at `adapters/xxscreeps/`. PR validation runs in the `screeps-ok-pr` workspace via `XXSCREEPS_LOCAL` (see `conventions/xxscreeps-pr-workspace.md`).

## Current upstream PRs to track

[#350](https://github.com/laverdet/xxscreeps/pull/350) (driver: decode the runtime source map during initialization) open, awaiting laverdet's direction on shape. `source-map-support` decodes the runtime bundle's map on the first `error.stack` read of an isolate's life, and isolated-vm bills that to the tick doing the reading — the same `isolate.cpuTime` clock `IsolatedSandbox.run` charges against `tickLimit`. UNDOC-MEMJSON-005 throws on a circular `Memory`, so it reliably lands the decode on itself: measured at pin `38ee6170`, 89.9ms of isolate CPU against the adapter's 500ms `tickLimit`, versus ~25ms for a first tick that reads no stack. On 2-core CI that scaled to an observed 629ms and timed out. Upstream `1ccbea9e` (on main, not yet pinned) shrinks the map but only takes the same tick to 63.6ms, so a pin bump alone does not clear it. On 2026-07-28 we proposed withdrawing the PR's warmup in favour of aliasing `source-map` onto `@jridgewell/trace-mapping` (first read 34.8-37.7ms → 6.1-8.7ms, ~7 MiB less isolate heap). Until that lands, `adapters/xxscreeps/sandbox-runner.ts` spends the decode in a throwaway tick during sandbox setup (`warmSourceMap`), which takes the same tick to 6.4ms; drop it when the pin carries the fix.

[#329](https://github.com/laverdet/xxscreeps/pull/329) (memory: skip the save when Memory fails to serialize) merged, consumed at pin `d2268ac5` — pruned `memory-circular-ref-crash` (UNDOC-MEMJSON-005). Trimmed 2026-07-21 before merge to just that fix (`crunch` under the serialization catch + cache drop) after laverdet's spec-chasing pushback; the withdrawn halves became the intentional `memory-parsed-json-not-refreshed-across-ticks` acceptance. The same bump consumed #311's invader-owned `Structure.effects` getter (folded into the adapter's `shapeDivergences`).

[#318](https://github.com/laverdet/xxscreeps/pull/318) (invader: reset room controller on core collapse expiry) merged 2026-07-17, consumed at pin `f01f0a23` — pruned `invader-core-collapse-controller-not-reset` (INVADER-CORE-004) and `controller-unclaim-keeps-safe-mode-charges` (CTRL-UNCLAIM-004). The safeModeCooldown-after-unclaim divergence (CTRL-UNCLAIM-005) is NOT covered and stays queued below. The bump also crossed the shared-runner-context and constants-audit work, absorbed as adapter wiring (`acquireRunnerContext` second hook argument; `DEPOSIT_DECAY_TIME` moved to `mods/modern/deposit/constants.js`).

[#317](https://github.com/laverdet/xxscreeps/pull/317) (pathfinder multi-goal lifetime) merged, shipped as `@xxscreeps/pathfinder@0.4.2`, consumed at pin `427f8677`.

## Active submission queue

`parity.json` currently registers 13 open parity gaps (43 tests) plus 6 intentional expected failures (11 tests). Test counts here are test rows as generated in `docs/status.md`, not catalog IDs — a matrix ID expands to many rows. The queue below is the agreed bug-fix focus; everything else is next-up, deferred, or blocked.

1. **`controller-unclaim-clears-safe-mode-cooldown`** (CTRL-UNCLAIM-005) — vanilla's unclaim SETS `safeModeCooldown` to `gameTime + SAFE_MODE_COOLDOWN` in non-novice rooms; xxscreeps's `release()` clears it. Genuine value bug, not covered by #318; needs its own upstream fix.

`power-bank-shape-exposes-store-extension` (SHAPE-NPC-003) was promoted to this queue and removed again on 2026-07-25 — accepted as an intentional divergence. The promotion assumed the `store` member was storage showing through the overlay; it is not. laverdet's `035d70bf` ("docs: sync with Screeps API", 2026-07-14) annotates the field `@public` as "an xxscreeps extension; the official API only exposes the amount via `power`", and in that 97-file sweep the phrase is used exactly twice, so the member was checked against the official API and kept deliberately. Prototyping the rename against `upstream/main` also found it isn't the ~4-line mod-local change the promotion assumed: `createRuin` (`mods/classic/structure/ruin.ts:68-76`) duck-types the loot out of the public `store` name, so hiding it leaves a destroyed bank's ruin empty, and the blob upgrader looks members up by name, so a renamed composed member arrives `undefined` and the room load throws for any saved world holding a live bank. See Accepted divergences in `docs/xxscreeps-parity-gaps.md`.

`game-object-json-room-tojson-null-crash` (13 tests, UNDOC-JSONOBJ-001) was removed from this queue 2026-07-25 — re-diagnosed. The old framing ("include nested `pos` fields") was wrong: probing both engines shows vanilla serializes a creep's whole public surface while xxscreeps emits `{room, id, name}`, because vanilla installs own enumerable per-instance accessors and xxscreeps uses non-enumerable prototype accessors from its overlay system. `RoomPosition.toJSON` is fine on both. Satisfying the row means reworking xxscreeps's object model, so it moved to Needs upstream design conversation.

`structure-active-equal-distance-scan-order` (STRUCTURE-ACTIVE-005) was removed from this queue 2026-07-25 — accepted as an intentional divergence. Neither engine's `isActive` tie order is specified: vanilla's falls out of scanning an id-keyed hash rebuilt from an unsorted storage query (so "first built wins" is insertion luck, not contract), and xxscreeps's falls out of a stable range sort over an array whose order swap-with-last removal already scrambled. Creation order is unrecoverable upstream and stable removal would cost an engine hot path, so a PR would be pure query-artifact chasing. See Accepted divergences below.

`controller-my-reset-returns-undefined` (CTRL-DOWNGRADE-002, CTRL-UNCLAIM-001) was removed from this queue 2026-07-20 — accepted as an intentional divergence per laverdet's undefined-shapes rulings (#128, #193, #215); see Accepted divergences below.

`memory-parsed-json-not-refreshed-across-ticks` (UNDOC-MEMJSON-001/-003/-004, UNDOC-MEMHACK-011) was removed from this queue 2026-07-21 — submitted in #329 and withdrawn per laverdet's spec-chasing bar; accepted as an intentional divergence (no observed script breakage; the real-bot `delete RawMemory._parsed` shippers all clobber `Memory` or use `RawMemory.set`, so the cached parse can't leak for them). The circular-ref half survived the trim and rides #329 above.

## Next-up areas (not currently queued)

- **`commonjs-main-exports-alias-missing`** (UNDOC-GLOBAL-003) — demoted from the queue 2026-07-20: no player-bot replication (row came from the 2026-05-02 systematic vanilla-coverage sweep, no upstream reports), failing the real-replication bar. Root cause reframed after code inspection: module execution is fine (`makeRequire` already aliases `exports` to `module.exports`); the gap is the eval channel (player console + adapter delivery), where the isolated sandbox leaks build plumbing — global `exports` is the webpack bootstrap `{}`, global `module` is the runtime library — so `module.exports.x =` throws TypeError. Reported upstream as an encapsulation-leak observation in [#328](https://github.com/laverdet/xxscreeps/issues/328); wait for laverdet's read before spending a PR slot. If a PR does happen: delete the plumbing globals after boot, give eval expressions a fresh throwaway `module = { exports: {} }`/aliased `exports` pair per command, and do NOT wire eval to the main module record (vanilla's console doesn't expose it).

- **`power-bank-ruin-spills-one-tick-late`** (POWER-BANK-004) — the ruin processor waits for `ticksToDecay === 0` while vanilla spills at `gameTime >= decayTime - 1`, so the dropped-power observation lands a tick late. Small and self-contained; the readiest one-tick timing fix in the set.
- **`stale-pickup-target-allowed`** (UNDOC-STALEARG-001:creepPickup) — make `checkTarget` read a schema-backed field so released wrappers trip the guard uniformly; closes the whole stale-argument axis rather than just pickup.

## PR-derived rows — pending upstream vanilla, NOT xxscreeps work

The 2026-05-07 catalog sweep (`633718e`, "Add PR-derived behavior catalog coverage") mined open screeps/engine PRs and wrote canonical rows for the behavior those PRs propose, registering vanilla expected-failures in the same commit. The provenance citations were lost from most entries over time, which made these read like ordinary xxscreeps gaps; both adapters' `parity.json` entries now carry the source PR in their `expected` text. **These are not xxscreeps bugs — never queue them as upstream xxscreeps work.** They resolve when stable vanilla ships the PR (then the row becomes `verified_vanilla` and both adapters are re-checked), or when a row is retired as never-shipping.

Registered on both adapters (4 gaps, 6 xxscreeps tests):

- **`legacy-path-cost-callback-false-ignored`** (LEGACY-PATH-010) — screeps/engine#113 (open, needs-testing): support a `false` return from `Room.findPath`'s `costCallback`, mirroring `PathFinder.roomCallback`. Stable vanilla `instanceof`-checks the return and silently ignores anything that is not a CostMatrix.
- **`renew-creep-energy-structures-option-missing`** (3 tests) — screeps/engine#153 (open): add the `energyStructures` option to `Spawn.renewCreep`. Stable vanilla's `renewCreep` has no `options` parameter at all.
- **`roomposition-find-closest-by-path-range-ignored`** (ROOMPOS-FIND-010) — screeps/engine#121 (open, enhancement/needs-testing; #136 closed dup): honor `opts.range`. Stable vanilla hardcodes goal range 1 and post-filters with `isNearTo`.
- **`moveto-all-routes-blocked-walks-into-creeps`** (MOVE-COLLISION-007) — screeps/engine#63: the walk-into-creeps behavior is a reported vanilla bug and the row asserts the intended outcome. Deliberately aspirational; inverting it would bless the bug as canonical.

Same class, tracked elsewhere: `structure-active-equal-distance-scan-order` (screeps/engine#150/#107, now an accepted divergence — see below) and `attack-notify-getter-api-missing` (no matching upstream PR found; see Blocked). Vanilla-only rows from the same sweep carry their citations in `adapters/vanilla/parity.json` — #112 (EVENT_BUILD `energySpent`), #131 (`Game.market.getHistory` return types), #152 (fatigued `moveTo` with `visualizePathStyle`), #148 (unspawned power-creep TTL); three rows there have unrecovered provenance and say so.

## Deferred

- **`terminal-send-check-order-diverges`** (9 test rows) — the fix is a straightforward `checkSend` reorder in `mods/classic/brokerage/terminal.ts`, but that file sits inside laverdet's in-progress market implementation work (the wallstreet order book landed in the `f01f0a23` bump range and is still moving). Deferred until the market work settles to avoid colliding with it; largest single-PR payoff in the queue once unblocked.

## Needs upstream design conversation first

- **`live-cached-receiver-released`** (2 tests, UNDOC-STALERECV-002) — end-of-tick wrapper invalidation is a blanket shared-memory buffer release, not per-object liveness. Any fix is architecturally deep (re-attach live wrappers to the new tick's buffer, or route schema access through id re-resolution), so open a design conversation with laverdet before writing code.
- **`game-object-json-room-tojson-null-crash`** (13 tests, UNDOC-JSONOBJ-001) — `JSON.stringify(creep)` yields `{room, id, name}` on xxscreeps versus vanilla's full public surface, because xxscreeps's overlay system exposes properties as non-enumerable prototype accessors while vanilla installs own enumerable per-instance accessors. Satisfying the row means making every object's public surface own-and-enumerable — a rework of the object model for serialization ergonomics, with no upstream report behind it. Discuss with laverdet before writing code; do not pitch it as the nested-`pos` fix the entry used to describe.

## Blocked

- **`look-for-at-unknown-returns-empty`** (ROOM-LOOK-006) — blocked on registering all canonical LOOK_* constants (e.g. `LOOK_POWER_CREEPS`); hardening the fallback to `ERR_INVALID_ARGS` today would break legitimate aliases.
- **`factory-power-effect-not-implemented`** (2 tests, intentional expected failure) — blocked until power-creep/effects substrate exists upstream.
- **`attack-notify-getter-api-missing`** (8 tests) — pulled from PR consideration 2026-07-20: the `notifiesWhenAttacked()` getter does not exist in stable vanilla either (the gap is registered on BOTH adapters; vanilla's `parity.json` documents the engine-source check), so the ATTACK-NOTIFY-001..004 / STRUCTURE-API-006 rows are aspirational `needs_vanilla_verification` claims. An upstream PR adding the getter would rightly get the "not even Screeps does this" response (cf. #213). Blocked on re-triaging the catalog rows against real vanilla. The one PR-able slice hiding here is different and smaller: xxscreeps's `Creep.notifyWhenAttacked` reportedly returns `null` where vanilla's setter returns `OK` (real bot pattern) — that needs its own `verified_vanilla` catalog row + test before any upstream PR.

## Accepted divergences

Intentional shape divergences are declared in the adapter's `shapeDivergences` (`adapters/xxscreeps/index.ts`) and folded into shape-test expectations, so their tests pass; only substrate-blocked gaps remain expected failures in `parity.json`:

- **`shape-flag-extra-id`** (declared divergence) — accepted 2026-06-11 per laverdet/xxscreeps#215's shape rule; `flag.id` is always `null` at runtime, so only property presence diverges.
- **`shape-body-part-always-has-boost`** (declared divergence) — #163 was closed as not desired by upstream.
- **`shape-controller-effects-always-enumerable`** (declared divergence) — deliberate `@enumerable` override on the controller's `effects` getter; empty-case key presence only.
- **`shape-structure-effects-always-enumerable`** (declared divergence) — #311's stronghold work extends base `Structure` with an enumerable derived `effects` getter so every peer type can expose its collapse timer; empty-case key presence only.
- **`factory-power-effect-not-implemented`** (expected failure) — see Blocked above.
- **`memory-parsed-json-not-refreshed-across-ticks`** (intentional expected failure) — accepted 2026-07-21 per laverdet's #329 spec-chasing bar; see the queue-removal note above and the gaps doc.
- **`rawmemory-set-invalidates-parsed-memhack`** (intentional expected failure) — accepted 2026-07-25. UNDOC-MEMHACK-012 asserts the `global.Memory` descriptor flip, an engine mechanism; the player-observable consequences it protects (MEMORY-002, UNDOC-MEMHACK-007/008/009/010) all pass on xxscreeps, which pins the in-tick reference another way, and the MemHack pattern still works because the accessor descriptor is configurable. Row stays as a regression trap.
- **`structure-active-equal-distance-scan-order`** (intentional expected failure) — accepted 2026-07-25. `isActive` ties between equal-distance same-type structures resolve by each engine's room-object collection order, and neither order is specified. Vanilla never sorts: `checkStructureAgainstController` scans the id-keyed `objectsByRoom` hash with a `foundSelf` sentinel, and that hash is rebuilt each tick from an unsorted storage query. xxscreeps batch-computes `#active` and stably sorts by range over `room['#objects']`, whose order `Room['#flushObjects']` scrambles via swap-with-last removal. That batch-compute design is exactly what screeps/engine#150 and #107 propose for vanilla (an `off` flag set during room processing; #150 cites vanilla issue #140 as the real defect), so the row penalizes xxscreeps for shipping the fix vanilla hasn't merged. Creation order is also unrecoverable upstream (no timestamp, random ids). Revisit only if #150/#107 lands and defines a tie order; row stays as a regression trap.
- **`controller-my-reset-returns-undefined`** (intentional expected failure) — accepted 2026-07-20. `controller.my` reads `undefined` instead of `false` after a claimed controller goes neutral; truthiness identical, only strict `=== false` diverges. laverdet ruled against exact undefined-shape conformance (#215 review), called vanilla's `controller.my === undefined` "a dumb quirk" (#128 review), and steered `structure.my` to `undefined` for null users (#193). Not shape-foldable (runtime value, not key presence), so it stays in `parity.json` with `intentional: true`; rows run as regression traps.

## Feature queue coordination

Portal (#159), Game.notify queueing (#161), shard-tick processor (#165), PowerSpawn / `Game.gpl` (#260), and the invader-core mod (#274) have all landed. The clean next Tier 1 feature area remains **`RoomObject.effects`** — it unlocks power and InvaderCore/stronghold work, and prior art exists on the `feature/effects-substrate` / `feature/invader-core` branches. Market is laverdet's active territory; steer clear of `mods/classic/brokerage` and `mods/mmo/wallstreet` until that work lands (see the terminal deferral above).

## Summary

| Stage | Gaps | Tests |
|---|---:|---:|
| Active submission queue | 2 | 2 |
| Next-up areas | 3 | 3 |
| PR-derived (pending upstream vanilla) | 4 | 6 |
| Deferred (market in flight) | 1 | 9 |
| Needs design conversation | 2 | 15 |
| Blocked (open gaps + intentional) | 3 | 11 |
| Accepted divergence (intentional expected failures) | 4 | 8 |
| **Total** | **19** | **54** |
