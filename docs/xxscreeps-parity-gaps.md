# xxscreeps parity gaps — working document

Tracks every parity gap in `adapters/xxscreeps/parity.json`. For each gap:

- **Status** — `CONFIRMED` (root cause located in xxscreeps source), `NEEDS-RE-INVESTIGATION` (test still fails but the named code path looks present — gap summary or code may be misleading), or `UNCONFIRMED` (didn't reach the cause this pass).
- **Cause** — one-line mechanism with the smoking-gun `file:line` in xxscreeps source under `/Users/mrwise/Coding/Screeps/xxscreeps/src`.

Last refreshed: 2026-04-11 against `reports/parity-full-20260411-184741.log`.

> When a gap moves to fixed-upstream, drop it from `parity.json` and remove the entry here.

## Confirmed (root cause in hand)

### boost-energy-cost-scales
- Tests: BOOST-BUILD-002, BOOST-UPGRADE-002
- Cause: `calculatePower()` (boosted output) is reused as the energy charge — `mods/controller/processor.ts:173-182`, `mods/construction/processor.ts:89-94`. Energy should derive from unboosted WORK part count.

### container-destroy-no-spill
- Tests: CONTAINER-002
- Cause: `buryCreep`-style resource spill on structure death is not implemented for containers. When `container.hits <= 0` the processor at `mods/resource/processor/container.ts:10-11` removes the object but does not create dropped resources for `container.store`.

### controller-my-undefined-on-unowned
- Tests: CTRL-UNCLAIM-001, CTRL-DOWNGRADE-002
- Cause: `OwnedStructure.my` does strict `#user === me` against an absent `#user` field on neutral controllers, returning `false`/`undefined` rather than `false` cleanly — `mods/structure/structure.ts:108-111`.

### safemode-ignores-downgrade-threshold
- Tests: CTRL-SAFEMODE-005
- Cause: `checkActivateSafeMode` at `mods/controller/controller.ts:103-115` checks `safeModeAvailable`, `safeModeCooldown`, and `safeMode`, but has no `ticksToDowngrade < CONTROLLER_DOWNGRADE_SAFEMODE_THRESHOLD` (15000) guard. Vanilla returns `ERR_TIRED` when the downgrade timer is below the threshold.

### creep-owner-undefined
- Tests: CTRL-SIGN-001, CTRL-SIGN-003, CTRL-RESERVE-001, CTRL-RESERVE-005
- Cause: `Creep.owner` getter returns `userInfo.get(this['#user'])` which can resolve to `undefined` instead of a `{username}` object — `mods/creep/creep.ts:76`.

### death-container-diversion
- Tests: CREEP-DEATH-003
- Cause: `buryCreep` always invokes the standard tombstone path; no same-tile container redirect — `mods/creep/processor.ts:282`.

### destroy-ownership-bypass
- Tests: STRUCTURE-API-001
- Cause: `checkMyStructure` at `mods/structure/structure.ts:206` uses `!structure.my && !structure.room.controller?.my`, returning OK when either is true. Vanilla requires `structure.my` for `OwnedStructure` subclasses — room controller ownership is only a valid fallback for unowned structures (roads, walls, containers). The condition conflates two cases because `checkDestroy` (line 221) passes base `Structure`, while all other callers pass specific `OwnedStructure` subclasses.
- Blast radius: 13 call sites across spawn (5), lab (4), tower, link, observer, terminal, factory, and controller. Every owned structure operation in the game has this bug but it only manifests when a foreign structure exists in a room you own (multi-player scenario).
- Fix shape: branch on `structure instanceof OwnedStructure` — if true, require `structure.my`; otherwise fall back to `room.controller?.my`.

### extractor-cooldown-off-by-one
- Tests: HARVEST-MINERAL-003, EXTRACTOR-006
- Cause: `#cooldownTime = Game.time + EXTRACTOR_COOLDOWN - 1` at `mods/mineral/processor.ts:21`. Reports `EXTRACTOR_COOLDOWN - 1` (5) on the next tick; vanilla expects `EXTRACTOR_COOLDOWN` (6). The `- 1` must be REMOVED — opposite direction from the lab fix.
- Root cause shared with lab-cooldown-no-decrement: xxscreeps advances `shard.time` before processing, so `Game.time` during processing = T+1. But vanilla's constants have different semantics: `EXTRACTOR_COOLDOWN` is pure wait time (next tick shows full value), while `REACTION_TIME` includes the action tick (next tick shows value - 1). The extractor's `- 1` double-corrects.
- Note: Cooldown sub-test split from EXTRACTOR-001 → EXTRACTOR-006 (2026-04-11) to isolate the trap. EXTRACTOR-001 (returns OK, reduces amount) now passes cleanly.

### generate-safe-mode-requires-work
- Tests: CTRL-GENSAFE-001..004
- Cause: `checkGenerateSafeMode` chains `checkCommon(creep, C.WORK)` and rejects bodyless creeps — `mods/controller/creep.ts:155`. Vanilla has no body-part precondition.

### link-cross-owner
- Tests: LINK-006
- Cause: `checkTransferEnergy` has no cross-owner test — `mods/logistics/link.ts:66-82`.

### link-self-transfer
- Tests: LINK-004
- Cause: Same `checkTransferEnergy` — no `link.id === target.id` rejection — `mods/logistics/link.ts:66-82`.

### notifyWhenAttacked-not-implemented
- Tests: STRUCTURE-API-004, STRUCTURE-API-005, STRUCTURE-API-006
- Cause: No `notifyWhenAttacked` method registered anywhere under `mods/structure`; the API simply does not exist.

### rampart-no-protection
- Tests: RAMPART-PROTECT-001, RAMPART-PROTECT-002, DISMANTLE-004, COMBAT-MELEE-005
- Cause: Two co-dependent bugs, both must be fixed:
  1. **Typo in `captureDamage`** — `mods/combat/creep.ts:196` calls `target['#captureDamage']` instead of `object['#captureDamage']`, so non-target objects on the same tile (ramparts) never get their capture method called. The correct pattern exists in `mods/combat/processor.ts:95` (rangedMassAttack) which uses `object['#captureDamage']`.
  2. **Rampart missing overrides** — `StructureRampart` (`mods/defense/rampart.ts`) inherits base `RoomObject` defaults: `#layer` returns 0.5 (same as all objects, so no priority sorting) and `#captureDamage` returns `power` unchanged (no absorption). Ramparts need a higher `#layer` to sort before the target and a `#captureDamage` override that absorbs damage into rampart hits and returns 0.

### renew-while-spawning
- Tests: RENEW-CREEP-006
- Cause: `checkRenewCreep` does not test `spawn.spawning` before returning OK — `mods/spawn/spawn.ts:270-289`.

### safemode-concurrent-allowed
- Tests: CTRL-SAFEMODE-007
- Cause: `checkActivateSafeMode` only inspects the target controller; no per-player single-active-room guard — `mods/controller/controller.ts:103-115`.

### tombstone-corpse-rate
- Tests: CREEP-DEATH-008, CREEP-DEATH-009
- Cause: `buryCreep` uniformly applies `CREEP_CORPSE_RATE`; no body-part energy reclaim on `suicide` — `mods/creep/tombstone.ts:68-74`.

### tough-boost-no-reduction
- Tests: BOOST-TOUGH-001, BOOST-TOUGH-002
- Cause: No TOUGH boost damage reduction exists anywhere in the combat mod. `Creep['#applyDamage']` (`mods/creep/creep.ts:116`) subtracts full power from `tickHitsDelta` without consulting body part boosts. No `#captureDamage` override on Creep either. Grep for `TOUGH` in `src/mods/combat/` returns zero hits. Separate mechanism from rampart-no-protection — ramparts use `#captureDamage`/`#layer`, TOUGH reduction belongs in `#applyDamage`.

### transfer-wrong-resource-err-full
- Tests: TRANSFER-007, TRANSFER-008
- Cause: `checkTransfer` runs `checkHasCapacity` before resource-type compatibility, so wrong-resource transfers to a full structure return `ERR_FULL` instead of `ERR_INVALID_TARGET` — `mods/creep/creep.js:checkTransfer` (per existing summary; not re-verified this pass).

### withdraw-enemy-rampart-no-protection
- Tests: WITHDRAW-005
- Cause: `checkWithdraw` has no enemy-rampart ownership test on the target tile — `mods/creep/creep.js:checkWithdraw` (per existing summary; not re-verified this pass).

## Adapter bugs misclassified as parity gaps

These were filed as xxscreeps engine gaps but the engine code is correct — the bug lives in `adapters/xxscreeps/index.ts`. Fixing the adapter closes the gap entirely, and the parity.json entry should be removed.

### container-decay-not-implemented · road-decay-not-implemented · rampart-decay-not-implemented
- Tests: CONTAINER-001, CONTAINER-002, ROAD-DECAY-001..003, RAMPART-DECAY-001, RAMPART-DECAY-002
- Cause: `adapters/xxscreeps/index.ts:203-222` `placeStructure` ignores `spec.ticksToDecay` — only `hits` and `store` are honored. The engine `#nextDecayTime` field is left at the default `Game.time + (decay constant) - 1`, so test calls like `placeStructure({ ticksToDecay: 5 })` get back ~98/498/998 instead of 5. Engine processors at `mods/resource/processor/container.ts:6`, `mods/road/processor.ts:6`, `mods/defense/processor.ts:94` are correct and already register `wakeAt` schedules.
- Caught by: contract test `tests/00-adapter-contract/setup.test.ts: ticksToDecay override is honored for {container,road,rampart}` — added 2026-04-11. Vanilla 3/3 pass, xxscreeps 3/3 fail with the engine-default values (498/998/98).
- Fix shape: in `placeStructure`, after `buildStructure(...)`, if `spec.ticksToDecay !== undefined` set `(structure as any)['#nextDecayTime'] = this.simulation!.shard.time + spec.ticksToDecay` (mirror of the existing `placeMineral` pattern at lines 280-282).
- **Status: FIXED** (2026-04-11). Adapter patched, contract test green on both adapters, parity entries removed. CONTAINER-001, ROAD-DECAY-001..003, RAMPART-DECAY-001/002 now pass. CONTAINER-002 remains as a separate engine gap (`container-destroy-no-spill`).

## Needs re-investigation (test fails but named fix appears present)

These gaps are still failing in the latest run, but the xxscreeps source contains code that *looks* like the implementation. Either the code is registered-but-not-running, the gap summary points at the wrong mechanism, or there's a subtle bug inside the implementation. Worth a closer trace before committing to a fix.

### extension-rcl-capacity — FIXED (2026-04-11)
- Moved to "Adapter bugs misclassified as parity gaps". `buildStructure` hardcoded level 8 for extensions (`adapters/xxscreeps/index.ts:828`). Fixed by passing `room['#level']` through to `createExtension`. All 7 tests now pass; parity entry removed.

### mineral-regen-not-implemented — FIXED (2026-04-11)
- Moved to "Adapter bugs misclassified as parity gaps". `placeMineral` never set `mineral.density` — defaulted to 0, so `MINERAL_DENSITY[0]` = undefined and regen produced `mineralAmount = 0`. Fixed by setting `mineral.density = 3` (DENSITY_HIGH, matching vanilla). All 8 tests pass; parity entry removed.

### upgrade-controller-no-gcl-progress — FIXED (2026-04-11)
- Moved to "Adapter bugs misclassified as parity gaps". Engine increments GCL in DB (`mods/controller/processor.ts:239`) but `simulate().player()` never populates `Game.gcl`. Adapter polyfill hardcoded `progress: 0`. Fixed by reading `shard.db.data.hget('user/${userId}', 'gcl')` before the player callback. CTRL-UPGRADE-008 now passes; parity entry removed.

## Confirmed — engine bugs (promoted from unconfirmed 2026-04-11)

### lab-cooldown-no-decrement
- Tests: LAB-RUN-004 (got 20, expected 19), LAB-REVERSE-004, UNBOOST-005 (got 30, expected 29)
- Cause: `lab['#cooldownTime'] = Game.time + reactionTime` at `mods/chemistry/processor.ts:32`, `:92`, and `:139`. Reports `reactionTime` on the next tick; vanilla expects `reactionTime - 1`. Fix: add `- 1` to all three lab cooldown assignments.
- Important: this is the OPPOSITE fix direction from extractor-cooldown-off-by-one. The earlier framing "missing the `-1` that extractor uses" was misleading — the extractor's `-1` is itself wrong (needs removal). Both bugs share the same root (Game.time = T+1 during processing) but vanilla's constants differ: `REACTION_TIME` includes the action tick, `EXTRACTOR_COOLDOWN` does not.
- Also at risk: `factory/processor.ts:21` uses `Game.time + recipe.cooldown` (no `-1`). No test data yet to confirm whether factory cooldown follows the lab pattern or extractor pattern. Link cooldown (`logistics/processor.ts:17`, has `-1`) is masked by the `didUpdate()` bug.

### lab-not-owner-precedence + observer-not-owner-precedence
- Tests: LAB-RUN-012, LAB-REVERSE-012, OBSERVER-006 (all got `-14` ERR_RCL_NOT_ENOUGH, expected `-1` ERR_NOT_OWNER)
- Cause: Same root as `destroy-ownership-bypass`. `checkMyStructure` passes because `room.controller?.my` is true even though `structure.my` is false. The chain then reaches `checkIsActive` (line 212) which returns `ERR_RCL_NOT_ENOUGH` because `checkActiveStructures` (line 164) marks structures inactive when `structure['#user'] !== controller['#user']`. Fixing `checkMyStructure` to require `structure.my` for `OwnedStructure` subclasses resolves all three gaps in one change.

### lab-unrestricted-mineral-capacity
- Tests: STORE-RESTRICTED-004 (got 3000, expected null)
- Cause: LabStore `getCapacity` returns `LAB_MINERAL_CAPACITY` for any mineral type, not just the loaded one — `mods/chemistry/store.ts` (per agent review; exact line TBD).

### link-intent-after-idle-tick
- Tests: LINK-002 (got 0, expected 8)
- Cause: Link processor at `mods/logistics/processor.ts:12-20` is the **only** intent processor in xxscreeps that mutates serialized state (store, `#cooldownTime`) without calling `context.didUpdate()`. Without it, `finalize()` falls through to `copyRoomFromPreviousTick` instead of `saveRoom`, so the cooldown and store changes aren't persisted. In real games, piggybacked by any other processor in the room (creep move, controller tick, etc.) that does call `didUpdate()` — only manifests in structure-only test rooms with no creeps or controller activity.
- Verified: audited all ~45 `registerIntentProcessor` call sites. The two other processors without explicit `didUpdate()` are correct: `observeRoom` delegates via `sendRoomIntent` (no local mutation), `requestInvader` uses `setActive()` (different purpose). Link is the sole outlier.
- Fix: add `context.didUpdate()` after `saveAction` at line 18.

### eventlog-attack-missing
- Tests: ROOM-EVENTLOG-001, ROOM-EVENTLOG-002 (got empty array / undefined)
- Cause: Events ARE appended during processing, but `#eventLog` is cleared at the start of each tick (`mods/engine/processor/room.ts:97`). The loaded room state for the next player() call may not carry over the appended events if the save/load cycle doesn't persist them between the processing tick and the next player read.

### route-callback-ignored
- Tests: MAP-ROUTE-003 (got route result, expected ERR_NO_PATH)
- Cause: `routeCallback` is threaded to the astar call at `game/map.ts:161-163` but may not be invoked per-room during the search. The test returns Infinity for a specific room; xxscreeps finds a route through it anyway. Needs side-by-side trace of the astar callback invocation.

## Fixed by terrain capability

### describe-exits-topology (FIXED)
- Tests: ROOM-FIND-003, MAP-ROOM-001
- Root cause: **Terrain data mismatch** — shard.json W1N1 had LEFT/RIGHT borders walled, tests expected all-plain (4 exits).
- Fix: xxscreeps adapter now overrides terrain at simulation creation. Default rooms get all-plain terrain matching vanilla's `new TerrainMatrix()`. MAP-ROOM-001 now passes; ROOM-FIND-003 was already fixed (serialization guard for `Fn.fromEntries` null-prototype objects).

### pathfinder-suboptimal (FIXED)
- Tests: PATHFINDER-001, PATHFINDER-004
- Root cause: **Terrain data mismatch** — shard.json terrain had walls causing longer paths. No JPS/heuristic bug.
- Fix: same terrain capability. Default rooms now all-plain, optimal diagonal paths match vanilla.

## Adapter bugs (not engine)

### observer-room-always-visible — FIXED (2026-04-14)
- `keepRoomsActive` now scopes `visibleRooms` seeding to each player's owned rooms per `shardSpec`; the engine's `flushUsers` and observer processor populate the rest. OBSERVER-001 and ROOM-VIS-003 pass on xxscreeps; parity entry removed.
