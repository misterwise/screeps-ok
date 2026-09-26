# xxscreeps PR plan

Companion to `docs/xxscreeps-parity-gaps.md`. Tracks active xxscreeps PRs that affect screeps-ok parity plus the selected submission queue. Full current parity counts are generated in `docs/status.md`.

Last refreshed: 2026-09-25 (pin `4795a332`).

> Source paths: xxscreeps engine at `/Users/mrwise/Coding/Screeps/xxscreeps/packages/xxscreeps`; this repo's adapter at `adapters/xxscreeps/`. PR validation runs in the `screeps-ok-pr` workspace via `XXSCREEPS_LOCAL` (see `conventions/xxscreeps-pr-workspace.md`).

## Current upstream PRs to track

[#388](https://github.com/laverdet/xxscreeps/pull/388) (controller: credit a renewed reservation by the creep's CLAIM power, not power + 1) merged, external contributor, consumed at pin `4795a332` (2026-09-25) — pruned `reserve-renewal-credits-one-extra-tick` (CTRL-RESERVE-009, 2 rows). The cap half of the same branch (`reserve-cap-clamps-instead-of-rejecting`) still fails and stays queued below. The same bump consumed #384/#385/#386 and the `@xxscreeps/pathfinder@0.4.6` move, none of which move parity rows. Full suite at this pin: 2543 passed, 66 expected-failure, 0 genuine, 128 skipped.

[#374](https://github.com/laverdet/xxscreeps/pull/374) (game: compose effects and renderers across mods) merged, consumed at pin `e9380f4d` (2026-08-24) — no parity rows, but it moves the cached `effects` getter onto `RoomObject` over a `'#effects'` generator chain, so the accepted structure/controller `effects` divergence widens to every room object and the adapter now declares it once as `roomObject: { extra: ['effects'] }`. This closes out the `RoomObject.effects` substrate that the feature queue below had held as the next Tier 1 area. The same bump consumed #370/#371/#372/#373/#375/#376/#378, none of which move parity rows. Full suite at this pin: 2510 passed, 55 expected-failure, 0 genuine, 128 skipped.

[#349](https://github.com/laverdet/xxscreeps/pull/349) (terminal: reorder checkSend validation precedence) and [#352](https://github.com/laverdet/xxscreeps/pull/352) (powercreep: lose movement ties and die at nuke impact) merged, consumed at pin `6d0ffb7e` (2026-08-19) — pruned `terminal-send-check-order-diverges` (TERMINAL-SEND-005 + 8 TERMINAL-SEND-013 rows), `power-creep-wins-movement-ties` (MOVE-POWER-001), and `power-creep-survives-nuke-impact` (NUKE-IMPACT-008:powerCreepRoomwideRemoved). The same bump consumed [#350](https://github.com/laverdet/xxscreeps/pull/350) (driver: decode the runtime source map with trace-mapping) — no parity rows, but it removes the 33-40ms first-`error.stack` decode that made UNDOC-MEMJSON-005 graze the tick wall-clock deadline on CI (now 7-10ms; the test passes in ~45ms locally at this pin). Full suite at this pin: 2510 passed, 55 expected-failure, 0 genuine, 128 skipped.

[#329](https://github.com/laverdet/xxscreeps/pull/329) (memory: skip the save when Memory fails to serialize) merged, consumed at pin `d2268ac5` — pruned `memory-circular-ref-crash` (UNDOC-MEMJSON-005). Trimmed 2026-07-21 before merge to just that fix (`crunch` under the serialization catch + cache drop) after laverdet's spec-chasing pushback; the withdrawn halves became the intentional `memory-parsed-json-not-refreshed-across-ticks` acceptance. The same bump consumed #311's invader-owned `Structure.effects` getter (folded into the adapter's `shapeDivergences`).

[#318](https://github.com/laverdet/xxscreeps/pull/318) (invader: reset room controller on core collapse expiry) merged 2026-07-17, consumed at pin `f01f0a23` — pruned `invader-core-collapse-controller-not-reset` (INVADER-CORE-004) and `controller-unclaim-keeps-safe-mode-charges` (CTRL-UNCLAIM-004). The safeModeCooldown-after-unclaim divergence (CTRL-UNCLAIM-005) is NOT covered and stays queued below. The bump also crossed the shared-runner-context and constants-audit work, absorbed as adapter wiring (`acquireRunnerContext` second hook argument; `DEPOSIT_DECAY_TIME` moved to `mods/modern/deposit/constants.js`).

[#317](https://github.com/laverdet/xxscreeps/pull/317) (pathfinder multi-goal lifetime) merged, shipped as `@xxscreeps/pathfinder@0.4.2`, consumed at pin `427f8677`.

## Active submission queue

`parity.json` currently registers 25 open parity gaps (35 catalog IDs) plus 5 intentional expected failures (9 catalog IDs), 68 expected-failure test rows in all as generated in `docs/status.md` — a matrix ID expands to many rows. The queue below is the agreed bug-fix focus; everything else is next-up, deferred, or blocked.

1. **`controller-unclaim-clears-safe-mode-cooldown`** (CTRL-UNCLAIM-005) — vanilla's unclaim SETS `safeModeCooldown` to `gameTime + SAFE_MODE_COOLDOWN` in non-novice rooms; xxscreeps's `release()` clears it. Genuine value bug, not covered by #318; needs its own upstream fix.
2. **`reserve-cap-clamps-instead-of-rejecting`** (CTRL-RESERVE-010) — vanilla drops a reserve intent whose credit would overshoot `gameTime + CONTROLLER_RESERVE_MAX` (no update, no event, timer decays that tick); xxscreeps `Math.min`-clamps it to the ceiling. Same processor branch as [#388](https://github.com/laverdet/xxscreeps/pull/388), which has merged, so this is unblocked. Bundled with **`reserve-fresh-reservation-one-tick-long`** (CTRL-RESERVE-011, INVADER-CORE-006), a fresh reservation reading one tick long, because CTRL-RESERVE-010's saturation phase depends on it. The invader core's copy of the arithmetic carried both slips, so the fix moves start, credit and cap into the shared `reserve()`. Built on xxscreeps branch `fix/reserve-cap-overshoot`, not yet submitted.

`power-bank-shape-exposes-store-extension` (SHAPE-NPC-003) was promoted to this queue and removed again on 2026-07-25 — accepted as an intentional divergence. The promotion assumed the `store` member was storage showing through the overlay; it is not. laverdet's `035d70bf` ("docs: sync with Screeps API", 2026-07-14) annotates the field `@public` as "an xxscreeps extension; the official API only exposes the amount via `power`", and in that 97-file sweep the phrase is used exactly twice, so the member was checked against the official API and kept deliberately. Prototyping the rename against `upstream/main` also found it isn't the ~4-line mod-local change the promotion assumed: `createRuin` (`mods/classic/structure/ruin.ts:68-76`) duck-types the loot out of the public `store` name, so hiding it leaves a destroyed bank's ruin empty, and the blob upgrader looks members up by name, so a renamed composed member arrives `undefined` and the room load throws for any saved world holding a live bank. See Accepted divergences in `docs/xxscreeps-parity-gaps.md`.

`game-object-json-omits-prototype-accessors` (formerly `game-object-json-room-tojson-null-crash`, UNDOC-JSONOBJ-001) was removed from this queue 2026-07-25 — re-diagnosed. The old framing ("include nested `pos` fields") was wrong: vanilla serializes a creep's whole public surface while xxscreeps emits `{room, id, name}`. `RoomPosition.toJSON` is fine on both. The 2026-07-25 mechanism (own vs non-enumerable accessors) was itself corrected 2026-09-25; see Needs upstream design conversation below.

`structure-active-equal-distance-scan-order` (STRUCTURE-ACTIVE-005) was removed from this queue 2026-07-25 — accepted as an intentional divergence. Neither engine's `isActive` tie order is specified: vanilla's falls out of scanning an id-keyed hash rebuilt from an unsorted storage query (so "first built wins" is insertion luck, not contract), and xxscreeps's falls out of a stable range sort over an array whose order swap-with-last removal already scrambled. Creation order is unrecoverable upstream and stable removal would cost an engine hot path, so a PR would be pure query-artifact chasing. See Accepted divergences below.

`controller-my-reset-returns-undefined` (CTRL-DOWNGRADE-002, CTRL-UNCLAIM-001) was removed from this queue 2026-07-20 — accepted as an intentional divergence per laverdet's undefined-shapes rulings (#128, #193, #215); see Accepted divergences below.

`memory-parsed-json-not-refreshed-across-ticks` (UNDOC-MEMJSON-001/-003/-004, UNDOC-MEMHACK-011) was removed from this queue 2026-07-21 — submitted in #329 and withdrawn per laverdet's spec-chasing bar; accepted as an intentional divergence (no observed script breakage; the real-bot `delete RawMemory._parsed` shippers all clobber `Memory` or use `RawMemory.set`, so the cached parse can't leak for them). The circular-ref half survived the trim and rides #329 above.

## Next-up areas (not currently queued)

- **`commonjs-main-exports-alias-missing`** (UNDOC-GLOBAL-003) — demoted from the queue 2026-07-20: no player-bot replication (row came from the 2026-05-02 systematic vanilla-coverage sweep, no upstream reports), failing the real-replication bar. Root cause reframed after code inspection: module execution is fine (`makeRequire` already aliases `exports` to `module.exports`); the gap is the eval channel (player console + adapter delivery), where the isolated sandbox leaks build plumbing — global `exports` is the webpack bootstrap `{}`, global `module` is the runtime library — so `module.exports.x =` throws TypeError. Reported upstream as an encapsulation-leak observation in [#328](https://github.com/laverdet/xxscreeps/issues/328); wait for laverdet's read before spending a PR slot. If a PR does happen: delete the plumbing globals after boot, give eval expressions a fresh throwaway `module = { exports: {} }`/aliased `exports` pair per command, and do NOT wire eval to the main module record (vanilla's console doesn't expose it).

- **`power-bank-ruin-spills-one-tick-late`** (POWER-BANK-004) — the ruin processor waits for `ticksToDecay === 0` while vanilla spills at `gameTime >= decayTime - 1`, so the dropped-power observation lands a tick late. Small and self-contained; the readiest one-tick timing fix in the set.
- **`circular-memory-tick-completes`** (UNDOC-MEMJSON-005) — `flush()` catches the tick-end stringify failure and completes the tick, where vanilla loses the tick's intents and Memory. The code already carries a TODO asking whether to reset the sandbox there instead; apply laverdet's observed-breakage bar before proposing a change.
- **`stale-pickup-target-allowed`** (UNDOC-STALEARG-001:creepPickup) — make `checkTarget` read a schema-backed field so released wrappers trip the guard uniformly; closes the whole stale-argument axis rather than just pickup.

Three residual rows from the `38ee6170` bump that opened the `strongholdDeploy` and `powerCreeps` capabilities. #349/#352 already took the other two from that set; these are diagnosed in the gaps doc and unqueued only for lack of a slot:

- **`stronghold-deploy-trigger-one-tick-late`** (STRONGHOLD-LAYOUT-001, 5 rows) — the deploy processor fires a tick after vanilla's trigger boundary.
- **`creep-attack-cannot-target-power-creep`** (POWERCREEP-DEATH-002) — `checkTarget` rejects a `PowerCreep` as an attack target.
- **`power-creep-renew-stamps-next-tick-age`** (POWERCREEP-RENEW-001) — intent processors run with `Game.time` already advanced, so `renew` stamps `#ageTime` one tick beyond vanilla's. The only exact-value row pinning that convention; check whether other processors stamp absolute ticks the same way before proposing a fix.
- **`factory-power-effect-not-implemented`** (FACTORY-PRODUCE-011:powerEffect, :powerEffectBeforeNotEnough) — the `PWR_OPERATE_FACTORY` branch is unimplemented. The 38ee6170 re-triage dropped its intentional hold: the rows never needed a live power creep, only `checkProduce` reading the factory's stored level.

## PR-derived rows — pending upstream vanilla, NOT xxscreeps work

The 2026-05-07 catalog sweep (`633718e`, "Add PR-derived behavior catalog coverage") mined open screeps/engine PRs and wrote canonical rows for the behavior those PRs propose, registering vanilla expected-failures in the same commit. The provenance citations were lost from most entries over time, which made these read like ordinary xxscreeps gaps; both adapters' `parity.json` entries now carry the source PR in their `expected` text. **These are not xxscreeps bugs — never queue them as upstream xxscreeps work.** They resolve when stable vanilla ships the PR (then the row becomes `verified_vanilla` and both adapters are re-checked), or when a row is retired as never-shipping.

Rows are kept only when the documented API or an upstream bug report backs the claim. On 2026-09-25 the rows that only restated a feature-addition PR were dropped: LEGACY-PATH-010 (#113, `costCallback` returning `false`), RENEW-CREEP-012..014 (#153, `renewCreep` `energyStructures`), ATTACK-NOTIFY-001..004 (#149, `notifiesWhenAttacked()` and the spawn option), CONSTRUCTION-SITE-015 (`Array.prototype` pollution, no upstream source), and ROOM-EVENTLOG-013's `energySpent` claim (#112; the documented `EVENT_BUILD` payload omits it).

Registered on both adapters (2 gaps, 2 xxscreeps tests):

- **`roomposition-find-closest-by-path-range-ignored`** (ROOMPOS-FIND-010) — screeps/engine#121 (open, enhancement/needs-testing; #136 closed dup): honor `opts.range`. Stable vanilla hardcodes goal range 1 and post-filters with `isNearTo`.
- **`moveto-all-routes-blocked-walks-into-creeps`** (MOVE-COLLISION-007) — screeps/engine#63: the walk-into-creeps behavior is a reported vanilla bug and the row asserts the intended outcome. Deliberately aspirational; inverting it would bless the bug as canonical.

Same class, tracked elsewhere: `structure-active-equal-distance-scan-order` (screeps/engine#150/#107, now an accepted divergence — see below). Vanilla-only rows carry their citations in `adapters/vanilla/parity.json` — #131 (`Game.market.getHistory` return types), #152 (fatigued `moveTo` with `visualizePathStyle`), #148 (unspawned power-creep TTL), #156 (pull fatigue on puller death), plus two backed by the API docs alone (100-char power-creep names, `EVENT_OBJECT_DESTROYED` on `destroy()`).

## Needs upstream design conversation first

- **`live-cached-receiver-released`** (2 tests, UNDOC-STALERECV-002) — end-of-tick wrapper invalidation is a blanket shared-memory buffer release, not per-object liveness. Any fix is architecturally deep (re-attach live wrappers to the new tick's buffer, or route schema access through id re-resolution), so open a design conversation with laverdet before writing code.
- **`game-object-json-omits-prototype-accessors`** (15 tests, UNDOC-JSONOBJ-001) — `JSON.stringify(creep)` yields `{room, id, name}` on xxscreeps versus vanilla's full public surface. Re-diagnosed 2026-09-25: both engines put the public surface on enumerable prototype accessors (xxscreeps `schema/overlay.ts:65`); the difference is that vanilla also installs a game-object `toJSON` that walks them with `for...in` (`@screeps/engine/src/utils.js:535`). The likely fix is a `toJSON` on `RoomObject`, not an object-model rework, but there is still no upstream report behind the row, so raise it with laverdet before writing code.

## Accepted divergences

Intentional shape divergences are declared in the adapter's `shapeDivergences` (`adapters/xxscreeps/index.ts`) and folded into shape-test expectations, so their tests pass; only substrate-blocked gaps remain expected failures in `parity.json`:

- **`shape-flag-extra-id`** (declared divergence) — accepted 2026-06-11 per laverdet/xxscreeps#215's shape rule; `flag.id` is always `null` at runtime, so only property presence diverges.
- **`shape-body-part-always-has-boost`** (declared divergence) — #163 was closed as not desired by upstream.
- **`shape-room-object-effects-always-present`** (declared divergence) — started with #311's stronghold work extending base `Structure` with a derived `effects` getter, and widened at pin `e9380f4d` when #374 moved the cached getter onto `RoomObject`; the getter returns `undefined` on an empty chain, so this is empty-case key presence only.
- **`memory-parsed-json-not-refreshed-across-ticks`** (intentional expected failure) — accepted 2026-07-21 per laverdet's #329 spec-chasing bar; see the queue-removal note above and the gaps doc.
- **`rawmemory-set-invalidates-parsed-memhack`** (intentional expected failure) — accepted 2026-07-25. UNDOC-MEMHACK-012 asserts the `global.Memory` descriptor flip, an engine mechanism; the player-observable consequences it protects (MEMORY-002, UNDOC-MEMHACK-007/008/009/010) all pass on xxscreeps, which pins the in-tick reference another way, and the MemHack pattern still works because the accessor descriptor is configurable. Row stays as a regression trap.
- **`structure-active-equal-distance-scan-order`** (intentional expected failure) — accepted 2026-07-25. `isActive` ties between equal-distance same-type structures resolve by each engine's room-object collection order, and neither order is specified. Vanilla never sorts: `checkStructureAgainstController` scans the id-keyed `objectsByRoom` hash with a `foundSelf` sentinel, and that hash is rebuilt each tick from an unsorted storage query. xxscreeps batch-computes `#active` and stably sorts by range over `room['#objects']`, whose order `Room['#flushObjects']` scrambles via swap-with-last removal. That batch-compute design is exactly what screeps/engine#150 and #107 propose for vanilla (an `off` flag set during room processing; #150 cites vanilla issue #140 as the real defect), so the row penalizes xxscreeps for shipping the fix vanilla hasn't merged. Creation order is also unrecoverable upstream (no timestamp, random ids). Revisit only if #150/#107 lands and defines a tie order; row stays as a regression trap.
- **`controller-my-reset-returns-undefined`** (intentional expected failure) — accepted 2026-07-20. `controller.my` reads `undefined` instead of `false` after a claimed controller goes neutral; truthiness identical, only strict `=== false` diverges. laverdet ruled against exact undefined-shape conformance (#215 review), called vanilla's `controller.my === undefined` "a dumb quirk" (#128 review), and steered `structure.my` to `undefined` for null users (#193). Not shape-foldable (runtime value, not key presence), so it stays in `parity.json` with `intentional: true`; rows run as regression traps.

## Feature queue coordination

Portal (#159), Game.notify queueing (#161), shard-tick processor (#165), PowerSpawn / `Game.gpl` (#260), the invader-core mod (#274), and now the `RoomObject.effects` substrate (#374) have all landed, which clears the Tier 1 feature list this section tracked; the remaining parity work is the per-row queue above rather than a feature area. Market is laverdet's active territory; steer clear of `mods/classic/brokerage` and `mods/mmo/wallstreet` until that work lands.

## Summary

| Stage | Gaps | Tests |
|---|---:|---:|
| Active submission queue | 1 | 1 |
| Next-up areas | 8 | 13 |
| PR-derived (pending upstream vanilla) | 2 | 2 |
| Needs design conversation | 2 | 17 |
| Accepted divergence (intentional expected failures) | 5 | 9 |
| **Total** | **18** | **42** |
