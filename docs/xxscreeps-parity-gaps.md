# xxscreeps parity gaps — working document

Tracks every parity gap in `adapters/xxscreeps/parity.json` (50 entries). For each gap:

- **Status** — `CONFIRMED` (root cause located in xxscreeps source) or `UNCONFIRMED` (cause not yet investigated).
- **Cause** — one-line mechanism with the smoking-gun `file:line` in xxscreeps source under `/Users/mrwise/Coding/Screeps/xxscreeps/src`.

Last refreshed: 2026-04-18 against `adapters/xxscreeps/parity.json`.

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

### factory-cooldown-no-decrement
- Tests: FACTORY-PRODUCE-002 (got 10, expected 9 for `RESOURCE_BATTERY` with cooldown=10)
- Cause: `factory['#cooldownTime'] = Game.time + recipe.cooldown` at `mods/factory/processor.ts:21`. Reports full `recipe.cooldown` on the next tick; vanilla expects `recipe.cooldown - 1`. Same pattern as lab-cooldown-no-decrement — add `- 1`.
- Context: factory follows the `REACTION_TIME`-style constant (includes the action tick), not the `EXTRACTOR_COOLDOWN`-style pure-wait constant — confirmed by this test now that factory mod ships upstream.

### factory-not-owner-precedence
- Tests: FACTORY-PRODUCE-010 (got `-14` ERR_RCL_NOT_ENOUGH, expected `-1` ERR_NOT_OWNER)
- Cause: Same root as `destroy-ownership-bypass` / `lab-not-owner-precedence`. `checkMyStructure` at `mods/structure/structure.ts:206` accepts the call because `room.controller?.my` is true for p1 even though the factory is p2's. `checkProduce` then reaches `checkIsActive` which returns `ERR_RCL_NOT_ENOUGH` via `checkActiveStructures`. Fixing `checkMyStructure` to require `structure.my` for `OwnedStructure` subclasses resolves this alongside lab/observer/destroy variants.

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
- Tests: RAMPART-PROTECT-001, RAMPART-PROTECT-002, DISMANTLE-004, COMBAT-MELEE-005, COMBAT-RANGED-006, COMBAT-RMA-004
- Cause: Two co-dependent bugs, both must be fixed:
  1. **Typo in `captureDamage`** — `mods/combat/creep.ts:196` calls `target['#captureDamage']` instead of `object['#captureDamage']`, so non-target objects on the same tile (ramparts) never get their capture method called. The correct pattern exists in `mods/combat/processor.ts:95` (rangedMassAttack) which uses `object['#captureDamage']`.
  2. **Rampart missing overrides** — `StructureRampart` (`mods/defense/rampart.ts`) inherits base `RoomObject` defaults: `#layer` returns 0.5 (same as all objects, so no priority sorting) and `#captureDamage` returns `power` unchanged (no absorption). Ramparts need a higher `#layer` to sort before the target and a `#captureDamage` override that absorbs damage into rampart hits and returns 0.

### renew-while-spawning
- Tests: RENEW-CREEP-009
- Cause: `checkRenewCreep` does not test `spawn.spawning` before returning OK — `mods/spawn/spawn.ts:270-289`.

### safemode-concurrent-allowed
- Tests: CTRL-SAFEMODE-007
- Cause: `checkActivateSafeMode` only inspects the target controller; no per-player single-active-room guard — `mods/controller/controller.ts:103-115`.

### tombstone-corpse-rate (also covers tombstone-store-missing)
- Tests: CREEP-DEATH-008, CREEP-DEATH-009, TOMBSTONE-003
- Cause: `buryCreep` (`mods/creep/tombstone.ts:68-86`) uniformly applies `CREEP_CORPSE_RATE` to carried resources and adds zero body-part energy reclaim. Vanilla formula: tombstone.store[energy] = `floor(sum(BODYPART_COST[part] × CREEP_CORPSE_RATE × ticksToLive / CREEP_LIFE_TIME))` (body reclaim) + carried energy (no rate multiplier on suicide; rate-multiplied on combat death). Same bug bites both the suicide path (CREEP-DEATH-008/009) and combat-kill path (TOMBSTONE-003).
- Fix shape: in `buryCreep`, compute `lifeRate = CREEP_CORPSE_RATE × creep.ticksToLive / CREEP_LIFE_TIME`, then `bodyEnergy = floor(sum(BODYPART_COST[part.type] × lifeRate))`. Add `bodyEnergy` to `tombstone.store[RESOURCE_ENERGY]` after the carried-resource copy. The carried-resource rate handling needs a `dropRate` parameter (`1.0` for suicide, `CREEP_CORPSE_RATE` for combat) — vanilla's `_die(dropRate)` API.

### tough-boost-no-reduction
- Tests: BOOST-TOUGH-001, BOOST-TOUGH-002
- Cause: No TOUGH boost damage reduction exists anywhere in the combat mod. `Creep['#applyDamage']` (`mods/creep/creep.ts:116`) subtracts full power from `tickHitsDelta` without consulting body part boosts. No `#captureDamage` override on Creep either. Grep for `TOUGH` in `src/mods/combat/` returns zero hits. Separate mechanism from rampart-no-protection — ramparts use `#captureDamage`/`#layer`, TOUGH reduction belongs in `#applyDamage`.

### transfer-wrong-resource-err-full
- Tests: TRANSFER-007, TRANSFER-008
- Cause: `checkTransfer` runs `checkHasCapacity` before resource-type compatibility, so wrong-resource transfers to a full structure return `ERR_FULL` instead of `ERR_INVALID_TARGET` — `mods/creep/creep.js:checkTransfer` (per existing summary; not re-verified this pass).

### withdraw-enemy-rampart-no-protection
- Tests: WITHDRAW-005
- Cause: `checkWithdraw` has no enemy-rampart ownership test on the target tile — `mods/creep/creep.js:checkWithdraw` (per existing summary; not re-verified this pass).

### lab-cooldown-no-decrement
- Tests: LAB-RUN-004 (got 20, expected 19), LAB-REVERSE-004, UNBOOST-005 (got 30, expected 29)
- Cause: `lab['#cooldownTime'] = Game.time + reactionTime` at `mods/chemistry/processor.ts:32`, `:92`, and `:139`. Reports `reactionTime` on the next tick; vanilla expects `reactionTime - 1`. Fix: add `- 1` to all three lab cooldown assignments.
- Important: this is the OPPOSITE fix direction from extractor-cooldown-off-by-one. The earlier framing "missing the `-1` that extractor uses" was misleading — the extractor's `-1` is itself wrong (needs removal). Both bugs share the same root (Game.time = T+1 during processing) but vanilla's constants differ: `REACTION_TIME` includes the action tick, `EXTRACTOR_COOLDOWN` does not.
- Factory follows the lab pattern — see `factory-cooldown-no-decrement` below.

### lab-not-owner-precedence + observer-not-owner-precedence
- Tests: LAB-RUN-012, LAB-REVERSE-012, OBSERVER-006 (all got `-14` ERR_RCL_NOT_ENOUGH, expected `-1` ERR_NOT_OWNER)
- Cause: Same root as `destroy-ownership-bypass`. `checkMyStructure` passes because `room.controller?.my` is true even though `structure.my` is false. The chain then reaches `checkIsActive` (line 212) which returns `ERR_RCL_NOT_ENOUGH` because `checkActiveStructures` (line 164) marks structures inactive when `structure['#user'] !== controller['#user']`. Fixing `checkMyStructure` to require `structure.my` for `OwnedStructure` subclasses resolves all three gaps in one change.

### link-cooldown-not-persisted
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

### rawmemory-set-no-eager-limit-check
- Tests: MEMORY-004
- Cause: `RawMemory.set` at `mods/memory/memory.ts:82-89` only stashes the string and marks the buffer dirty — no length check. The 2MB throw lives in `flush()` at `mods/memory/memory.ts:200-202` (`if (length > kMaxMemoryLength) throw new Error(...)`), which runs during driver send well after user code has returned, so a user-code `try/catch` never sees it.
- Fix shape: add `if (value.length > kMaxMemoryLength) throw new Error(...)` inside `set()` before the `string = value` assignment.

### rawmemory-set-invalidates-parsed-memhack
- Tests: MEMORY-002
- Cause: `RawMemory.set` unconditionally clears the parsed cache at `mods/memory/memory.ts:86` (`RawMemory._parsed = json = undefined;`). The next `Memory.x` access falls through to `get()` (lines 142-159) which re-parses the just-set string, dropping any in-tick mutations made before the `set`. Vanilla's memhack preserves the already-parsed `Memory` object identity for the rest of the tick.
- Fix shape: in `set()`, only invalidate `json`/`_parsed` when the parsed cache hasn't been touched (`!accessedJson`). When the user has already accessed `Memory`, leave the parsed object live so reads return the in-tick mutations.

### shape-flag-crash (misnamed — same root as shape-extra-hits-my)
- Tests: SHAPE-FLAG-001
- Cause: Misnamed in `parity.json` — the crash is gone (resolved by `e515285`'s sandbox-per-user). Test now fails for the same root as `shape-extra-hits-my`: base `RoomObject` (`game/object.ts:60-62`) declares getters for `hits`, `hitsMax`, `my` that return `undefined` and leak onto every subclass's data-property surface, including Flag. Plus a Flag-specific extra: the schema struct on RoomObject (`game/object.ts:21`) contributes an `id` field that surfaces on Flag despite `Flag.id` being declared `never` (`mods/flag/flag.ts:30`) because flags don't actually have ids in vanilla.
- Concrete diff: actual `[color, hits, hitsMax, id, memory, my, name, pos, room, secondaryColor]` vs expected `[color, memory, name, pos, room, secondaryColor]` — the four extras are `hits`, `hitsMax`, `id`, `my`.
- Fix shape: solve `shape-extra-hits-my` first (move the three getters off the base, opt in per subclass). Flag separately needs the schema `id` field suppressed for its serialization, since the base struct can't be made conditional. Worth merging this entry into `shape-extra-hits-my` once the broader fix lands.

### adapter-finalize-missing-room (covers reserve-007, claim-reserved-no-guard, upgrade-blocked-no-guard)
- Tests: CTRL-RESERVE-007, CTRL-CLAIM-003, CTRL-UPGRADE-009
- Cause: Adapter bug, not engine. The xxscreeps adapter `tick` at `adapters/xxscreeps/index.ts:1075` calls `shard.loadRoom(roomName)` for every room in the engine's `finalizeExtraRoomsSetKey(time)` set, with no fallback when the room wasn't created by the test. The engine's `publishInterRoomIntents` (`engine/processor/model.ts:154-164`) populates that set whenever a processor emits a cross-room intent — which `reserveController`, `attackController`, and `claimController` processors all do for adjacent rooms (e.g. p2 reserving W3N1 enqueues W4N1; p1 attacking W2N1's controller enqueues W3N1). `BlobStorage.req` then throws `"room0/<name>" does not exist` and the test crashes before its assertion runs.
- The two sibling gaps were misdiagnosed as missing intent-layer guards. They're not: `checkClaimController` (`mods/controller/creep.ts:144-148`) DOES check `roomOwner !== creep['#user']` and return `ERR_INVALID_TARGET`; `checkUpgradeController` (`mods/controller/creep.ts:190-191`) DOES check `target.upgradeBlocked` and return `ERR_INVALID_TARGET`. Both guards work — the tests just crash before reaching the call site.
- Fix shape: in the adapter's finalize-extras loop, either (a) catch `loadRoom` errors and skip the room (simplest, drops cross-room finalize work for unmodelled rooms), or (b) eagerly create stub rooms for all 8 neighbors of every placed room (heavier, but lets the engine's neighbor-routing code run). Once fixed, all three parity.json entries should collapse into "fixed by adapter" and be removed.

### renew-rejects-boosted-creep
- Tests: RENEW-CREEP-004, RENEW-CREEP-005, RENEW-CREEP-006
- Cause: Explicit boost rejection in `checkRenewCreep` at `mods/spawn/spawn.ts:280-284` — `creep.body.some(bodyPart => bodyPart.boost !== undefined)` returns `ERR_NO_BODYPART`. Vanilla accepts boosted creeps and strips the boosts during renew (no rejection at the check layer).
- Fix shape: drop the boost-presence test from `checkRenewCreep`. Add boost-stripping to the renewCreep processor (`mods/spawn/processor.ts:131-141`), which currently only consumes energy and bumps `#ageTime`. Strip-on-renew should iterate `creep.body`, set each `boost = undefined`, and free the boost minerals back to the room/spawn (or per vanilla, just discard them).

### recycle-no-body-reclaim
- Tests: RECYCLE-CREEP-002
- Cause: Literal `// TODO: This stuff` at `mods/spawn/processor.ts:125`. The recycleCreep processor only sets `creep.hits = 0` (line 126) and calls `context.didUpdate()` — no energy reclaim. Vanilla deposits `floor(bodyCost × ttlRemaining / CREEP_LIFE_TIME)` of the body's energy cost into the spawn (or surrounding extensions) via `_die` with `dropRate=1.0`.
- Fix shape: replace the TODO with the deposit math. Compute `bodyCost = sum(BODYPART_COST[part] for part in body)`, `reclaimRatio = (creep.ticksToLive ?? 0) / CREEP_LIFE_TIME`, `reclaimed = floor(bodyCost × reclaimRatio)`. Deposit into the spawn's energy structures (mirror of `consumeEnergy` at lines 45-60 but in reverse) before calling `buryCreep` instead of bare `creep.hits = 0`.

### spawn-duplicate-name-allowed (misdiagnosed)
- Tests: SPAWN-CREATE-003
- Cause: Misdiagnosed in `parity.json`. Actual return is `ERR_RCL_NOT_ENOUGH` (-14), not "spawnCreep allows name". Two interlocking issues:
  1. **Check order** — `checkSpawnCreep` (`mods/spawn/spawn.ts:308-310`) runs `checkMyStructure` and `checkIsActive` BEFORE the name check at line 312. The test places 2 spawns at RCL 2 (limit is 1), so spawn2 is over-the-limit and `checkIsActive` returns `ERR_RCL_NOT_ENOUGH` before the name check ever runs.
  2. **isActive in user-side validation** — Vanilla's user-facing `spawnCreep` doesn't enforce active-structure status; that's only checked at processing time. xxscreeps validates it eagerly which masks the name-collision case.
- The parity.json claim "no check against currently spawning creeps" is incorrect: `runPlayer` advances a tick after each call (`adapters/xxscreeps/index.ts:717`), so by the time spawn2's check runs, spawn1's intent has been processed and `Game.creeps['UniqueTest']` IS populated via `#addToMyGame` (`mods/creep/creep.ts:113`). The name check at spawn.ts:312 would catch the collision if it ran first.
- Fix shape: either (a) remove `checkIsActive(spawn)` from the user-side `checkSpawnCreep` and rely on processor-time enforcement (vanilla parity), or (b) reorder so the name/string checks run before `checkIsActive`. Option (a) is correct semantically; option (b) is the smaller diff but leaves a vanilla-parity drift in place.

### transfer-controller-no-upgrade-redirect
- Tests: TRANSFER-011
- Cause: `Creep.transfer` (`mods/creep/creep.ts:384-392`) has no controller-specific dispatch. It falls through to `checkTransfer` (line 513) which requires range 1 (`checkRange(creep, target, 1)`). Vanilla detects `target instanceof StructureController && resourceType === RESOURCE_ENERGY` and redirects to `upgradeController`, which has range 3. Tests placing the creep at range 2-3 from the controller pass on vanilla (via the redirect) and fail on xxscreeps with `ERR_NOT_IN_RANGE` because the redirect is absent.
- Fix shape: at the top of `Creep.transfer`, branch on `target instanceof StructureController && resourceType === C.RESOURCE_ENERGY` and call `this.upgradeController(target)` (returning its result). Mirror the vanilla wrapper. The intent path can stay as-is for non-controller targets.

### withdraw-wrong-resource-not-enough-energy
- Tests: WITHDRAW-014
- Cause: Same shape as the existing `transfer-wrong-resource-err-full` gap. `checkWithdraw` (`mods/creep/creep.ts:532`) calls `checkHasResource(target, resourceType, amount)` which at `mods/resource/store.ts:344-348` does `target.store[resourceType] >= Math.max(1, amount)` — for a wrong resource type, `target.store[resourceType]` is `undefined`, `undefined >= 1` is false, returns `ERR_NOT_ENOUGH_RESOURCES` (= ERR_NOT_ENOUGH_ENERGY = -6). The check reports the symptom ("no resource of that type") instead of the cause ("target can't hold that type at all"). Vanilla returns `ERR_INVALID_TARGET`.
- Fix shape: same intervention solves both gaps. Add a resource-type-compatibility branch in `checkHasResource` and `checkHasCapacity` (`mods/resource/store.ts:331-349`) — if `target.store.getCapacity(resourceType) === null` (or equivalent "this store can't hold this resource"), return `ERR_INVALID_TARGET` before falling through to the amount/capacity comparison. LabStore's `getCapacity` already returns `null` correctly (see `lab-bound-getfreecapacity-returns-zero` analysis); other stores need an analogous signal for energy-only stores like extension/spawn when called with a mineral type.

### moveto-nopathfinding-returns-ok
- Tests: MOVE-BASIC-019
- Cause: Wrong error code, not "returns OK". `searchOrFetchPath` at `mods/creep/creep.ts:258-260` returns `null` when `extra?.noPathFinding && !cachedPath`. The caller at `mods/creep/creep.ts:312-313` then returns `C.ERR_NO_PATH` (-2) for any `null` path. Vanilla returns `ERR_NOT_FOUND` (-5) specifically for the noPathFinding-no-cache case (different from "no path exists between these points").
- Fix shape: distinguish the two failure modes. Either return a special sentinel from `searchOrFetchPath` for the noPathFinding miss and translate it to `ERR_NOT_FOUND` at the caller, or hoist the check into `moveTo` directly: after the cached-path lookup, if `extra?.noPathFinding` and no cache hit, return `ERR_NOT_FOUND` before computing a fresh path.

### pull-spawning-no-guard
- Tests: MOVE-PULL-007:spawning
- Cause: `checkPull` at `mods/creep/creep.ts:497-502` checks the puller (via `checkCommon` which rejects spawning) and the target type/range, but never checks the target's spawning state. Vanilla rejects pulling a spawning target with `ERR_INVALID_TARGET`.
- Fix shape: add `() => target.spawning ? C.ERR_INVALID_TARGET : C.OK` to the chain after `checkRange`. One-line addition.

### findpath-same-pos-not-empty
- Tests: LEGACY-PATH-006
- Cause: `Room#findPath` at `game/room/path.ts:127-162` runs `PathFinder.roomSearch` (which returns `result.path = []` for same-position) but then the "auto-add last position for range:1 paths" branch at lines 132-140 fires unconditionally for same-pos: `result.path.length` is 0 (falsy), so the OR falls through to `origin.isNearTo(goal)`, which is `true` for same-position (range 0 ≤ 1). The branch pushes `goal` onto the empty path, yielding a 1-step path. The downstream loop at lines 143-157 then builds a single entry with `dx = dy = 0` and `direction = origin.getDirectionTo(goal)`.
- Fix shape: short-circuit at the top of `findPath` — `if (origin.isEqualTo(goal)) return options.serialize ? '' : [];`. Or tighten the auto-add condition at line 137 to `origin.isNearTo(goal) && !origin.isEqualTo(goal)`.

### mineral-harvest-no-overflow-drop (misnamed — actually OpenStore.getFreeCapacity bug)
- Tests: HARVEST-MINERAL-012
- Cause: Misdiagnosed. The "no overflow drop" symptom is a downstream effect — the real bug is that `OpenStore.getFreeCapacity(specificResource)` returns wrong values for shared-capacity stores. Confirmed via instrumentation: a creep with `{ energy: 45 }` in a 50-cap store reports `getFreeCapacity('H') === 50` instead of 5. The mineral overflow check at `mods/mineral/processor.ts:14` then computes `overflow = max(10 - 50, 0) = 0`, so the harvest absorbs all 10 H into the creep (final state: `{energy: 45, H: 10}`, store at 55/50, over capacity) and never calls `Resource.drop`.
- Mechanism: `OpenStore` (`mods/resource/store.ts:103-171`) overrides `getCapacity` (returns `#capacity` always) and `getUsedCapacity` (returns `this[resourceType]` per-type or `_sum` for no-arg) but does NOT override `getFreeCapacity`. It inherits the base `Store.getFreeCapacity` at line 74-76 which does `getCapacity(resourceType) - getUsedCapacity(resourceType)` — per-resource subtraction. For an empty resource slot, `this['H'] === 0`, so `50 - 0 = 50`. Vanilla's open-store semantics: free space depends on TOTAL used regardless of resourceType (because all resources share one capacity pool).
- Why other tests don't catch this: most callers use the no-arg form `getFreeCapacity()`, which works correctly (`50 - _sum = 5`). Only callers that pass a specific resource type to a shared-capacity store hit the bug. The mineral overflow calculation is one of the few that does.
- Fix shape: override `getFreeCapacity` on `OpenStore` to use `_sum` regardless of resourceType:
  ```typescript
  override getFreeCapacity(_resourceType?: ResourceType) {
      return this['#capacity'] - this._sum;
  }
  ```
- Blast radius (worth verifying after fix): every place that calls `creep.store.getFreeCapacity(specificResource)` — likely affects transfer/withdraw amount calculations when the destination is empty for that resource type, possibly creep death/tombstone math, possibly construction site overflow handling. May fix or expose other gaps.

### shape-extra-hits-my
- Tests: SHAPE-SOURCE-001, SHAPE-MINERAL-001, SHAPE-SITE-001, SHAPE-RESOURCE-001, SHAPE-TOMBSTONE-001, SHAPE-RUIN-001, SHAPE-STRUCT-001:road, SHAPE-STRUCT-001:constructedWall, SHAPE-STRUCT-001:container (also rolls in SHAPE-FLAG-001 per the merged entry above)
- Cause: Three sub-causes:
  1. **Base RoomObject getters leak** — `game/object.ts:60-62` declares `get hits()`, `get hitsMax()`, `get my()` returning `undefined` on the base class. These appear on the prototype chain of every subclass. `dataProps` (the test helper) walks `Object.getOwnPropertyNames(proto)` per prototype level and finds them. Vanilla doesn't have them on the base — they're added per-subclass that actually has the concept.
  2. **Wall missing `ticksToLive`** — `StructureWall` (`mods/defense/wall.ts:15-22`) overrides `hitsMax` and `structureType` but has no `ticksToLive` getter at all. Vanilla constructedWall exposes `ticksToLive` (returns null for permanent player walls; ticks for temporary boundary/swamp walls).
  3. **Ruin missing `structureType`** — `mods/structure/ruin.ts:60` defines `structureType` via `Object.defineProperties(structure, ...)` on the INNER `ruin.structure` sub-object, not on the Ruin itself. Vanilla exposes `structureType` directly on the ruin.
- Fix shape: (1) move `hits`/`hitsMax`/`my` from base to per-subclass — every subclass that has those concepts gets explicit getters. Subclasses without them (Source, Mineral, Resource, etc.) inherit nothing. (2) Add `ticksToLive` getter to `StructureWall`. (3) Add a top-level `structureType` getter on `Ruin` that delegates to `this['#structure'].type`.

### shape-struct-missing-legacy-compat
- Tests: SHAPE-STRUCT-001:link, SHAPE-STRUCT-001:storage
- Cause: Confirmed via grep — no `energy`, `energyCapacity`, or `storeCapacity` getters defined anywhere in `mods/logistics/` (link/storage live there). Vanilla provides legacy compat aliases: `link.energy` → `link.store[RESOURCE_ENERGY]`, `link.energyCapacity` → `link.store.getCapacity(RESOURCE_ENERGY)`, `storage.storeCapacity` → `storage.store.getCapacity()`.
- Fix shape: add three getters — `StructureLink#get energy()`, `StructureLink#get energyCapacity()`, `StructureStorage#get storeCapacity()` — each delegating to the corresponding `store` method.

### shape-body-part-always-has-boost
- Tests: SHAPE-CREEP-002, SHAPE-CREEP-003
- Cause: `mods/creep/creep.ts:414` constructs body parts as `parts.map(type => ({ type, hits: 100, boost: undefined }))`. The explicit `boost: undefined` makes it an own enumerable property on every part. `Object.getOwnPropertyNames(part)` includes `boost` even when unboosted. Vanilla only sets `boost` when the part has actually been boosted (via `applyBoost` or similar).
- Fix shape: drop `boost: undefined` from the literal: `parts.map(type => ({ type, hits: 100 }))`. Add `boost` later only when `applyBoost` runs. Test suite already expects this — no other changes.

### shape-room-missing-survivalInfo
- Tests: SHAPE-ROOM-001
- Cause: Confirmed via grep — `survivalInfo` appears NOWHERE in xxscreeps source. Property doesn't exist on the Room class at all. Vanilla returns `null` for non-survival rooms (and a `{ mode, status, timer }` object during survival/training mode).
- Fix shape: add `Room#get survivalInfo()` returning `null` (xxscreeps has no survival-mode implementation, so null is the canonical never-in-survival value). Cheap one-line fix that closes the shape gap without implementing survival semantics.

### shape-game-surface-mismatch
- Tests: SHAPE-GAME-001
- Cause: Two distinct issues:
  1. **`Game.cpuLimit` missing** — grep confirms `cpuLimit` is only used in `backend/endpoints/game/shards.ts:12`, never assigned to the runtime `Game` object. The CPU interface at `game/game.ts:115-137` has `Game.cpu.{bucket, limit, tickLimit, getUsed}` but no top-level `Game.cpuLimit`. Vanilla has both.
  2. **`Game.flags` / `Game.powerCreeps` own-property surface mismatch** — these are assigned as plain own data properties (e.g., `mods/flag/game.ts:74`: `Game.flags = flags`), which gives a different `Object.getOwnPropertyDescriptor` shape than vanilla's getter-on-prototype pattern. The surfaces look "the same" to user code but the data-property descriptors differ (`{ value, writable, enumerable, configurable }` vs `{ get, enumerable, configurable }`), which the SHAPE-GAME-001 test detects.
- Fix shape: (1) Add `Game.cpuLimit` to the gameInitializer hook (mirror of `cpu.limit`). (2) Convert `Game.flags` and `Game.powerCreeps` from `Game.foo = bar` assignments to `Object.defineProperty(Game, 'foo', { get: () => bar, enumerable: true, configurable: true })` to match vanilla's prototype-getter shape.

### dismantle-no-destroy-at-zero-hits
- Tests: DISMANTLE-007
- Cause: Literal `// TODO: dismantle event + destroy hook` at `mods/construction/processor.ts:76`. Lines 75-78:
  ```typescript
  target.hits -= effect;
  // TODO: dismantle event + destroy hook
  // saveAction(creep, 'dismantle', target.pos.x, target.pos.y);
  context.didUpdate();
  ```
  When `target.hits` reaches 0 the structure stays present with `hits=0`. Vanilla destroys the structure in the same tick (and creates a ruin).
- Fix shape: after `target.hits -= effect`, if `target.hits <= 0` call `createRuin(target)` then `target['#destroy']()` (`game/object.ts:87` already provides the base hook). Mirror the pattern used by `Creep['#applyDamage']` (`mods/creep/creep.ts:78-80`) which calls `this['#destroy']()` when hits drop. Also add the dismantle EVENT_LOG append while you're there.

### ruin-spill-decay-on-spill-tick
- Tests: STRUCTURE-HITS-005
- Cause: `mods/structure/processor.ts:19-29`. The Ruin object-tick processor calls `ResourceIntent.drop(ruin.pos, resourceType, amount)` when `ticksToDecay === 0`. `Resource.drop` (`mods/resource/processor/resource.ts:9-42`) inserts a Resource via `room['#insertObject'](resource, true)` (in-tick visible). The Resource's own `registerObjectTickProcessor` (lines 44-50) then runs in the same object-tick phase, applying decay to the freshly-spilled pile. Vanilla inserts spill piles AFTER the iteration phase so they skip same-tick decay.
- Fix shape: defer the spill insert until after the object-tick iteration. Two options:
  1. In the Ruin processor, queue the spill via the deferred `#insertObject(resource, false)` path so it goes to `#insertObjects` and gets flushed at end-of-tick.
  2. Tag spilled resources with a "skip-decay-this-tick" flag (e.g., set `#nextDecayTime` to `Game.time + 1`) so the in-tick decay processor short-circuits.
- Option 1 is cleaner but breaks `Resource.drop`'s "immediately visible" contract used elsewhere (e.g., harvest overflow). Option 2 is local to the Ruin processor.

### lab-bound-getfreecapacity-returns-zero
- Tests: STORE-BIND-002:H, STORE-BIND-002:O, STORE-BIND-002:G
- Cause: Two-file interaction. `LabStore` (`mods/chemistry/store.ts:41-67`) has correct `getCapacity` and `getUsedCapacity` overrides that return `null` for a wrong mineral type, but no `getFreeCapacity` override. The base `Store.getFreeCapacity` at `mods/resource/store.ts:74-76` does `this.getCapacity(resourceType)! - this.getUsedCapacity(resourceType)!` — the `!` non-null assertions silence TypeScript but add no runtime handling, and `null - null` coerces to `0` in JavaScript (`Number(null) === 0`).
- Fix shape: short-circuit on null in `Store.getFreeCapacity` — return `null` if either `getCapacity(resourceType)` or `getUsedCapacity(resourceType)` returns `null`. This is the general invariant for any store with restricted resource types (LabStore today, NukerStore would have the same issue if it ever gained restrictions). One-method change in the base, no LabStore override needed.

### tombstone-place-low-decay · ruin-place-low-decay
- Tests: TOMBSTONE-004, RUIN-005
- Cause: Adapter bug, not engine. Same shape as the 2026-04-11 `placeStructure` ticksToDecay fix. `placeTombstone` (`adapters/xxscreeps/index.ts:452`) and `placeRuin` (`adapters/xxscreeps/index.ts:483`) compute the absolute decay anchor as `(spec.deathTime ?? 0) + (spec.ticksToDecay ?? 500)` and `(spec.destroyTime ?? 0) + (spec.ticksToDecay ?? 500)` respectively. With the death/destroy time defaulted to 0, the resulting absolute `#decayTime` is just `ticksToDecay` — already in the past once `shard.time` advances. Engine processors anchor correctly: `mods/creep/tombstone.ts:83` does `Game.time + body.length × TOMBSTONE_DECAY_PER_PART`, `mods/structure/ruin.ts:84` does `Game.time + decayTimeout`.
- Fix shape: anchor on live shard time, mirror of the `setStructureNextDecayTime` call at `index.ts:330`. Replace the `(deathTime ?? 0) + (ticksToDecay ?? 500)` argument with `this.simulation!.shard.time + (spec.ticksToDecay ?? 500)`. The `deathTime`/`destroyTime` spec fields should remain as cosmetic setters for `tombstone.deathTime` / `ruin.destroyTime` (already done at index.ts:435 / 468) but stop participating in the decay-anchor math.

### foreign-segment-not-supported
- Tests: RAWMEMORY-FOREIGN-002, RAWMEMORY-FOREIGN-003, RAWMEMORY-FOREIGN-004
- Cause: Three holes:
  1. **Driver fetch unimplemented** — `mods/memory/driver.ts:55-57` captures `foreignSegmentRequest` from the runtime but the refresh handler is a literal `// TODO` (never loads the foreign user's segment from the DB).
  2. **`setDefaultPublicSegment` no-op** — `mods/memory/memory.ts:129` is `console.error('TODO: setDefaultPublicSegment')`.
  3. **`setPublicSegments` no-op** — `mods/memory/memory.ts:136` is a silent stub (`/* console.error('TODO: setPublicSegments') */`).
- Plus: `RawMemory.foreignSegment` is never declared on the `RawMemory` object (`mods/memory/memory.ts:56-137`) — even if the driver fetched the blob, there's no return path. Needs a new `payload.foreignSegment` field on `TickPayload` mirroring `memorySegments`, plus a `loadForeignSegment(payload.foreignSegment)` in the runtime connector that assigns onto `RawMemory.foreignSegment`.

### road-site-progresstotal-no-terrain-scaling
- Tests: CONSTRUCTION-COST-003:wall, CONSTRUCTION-COST-003:swamp
- Cause: `ConstructionSite.progressTotal` getter at `mods/construction/construction-site.ts:34` is `C.CONSTRUCTION_COST[this.structureType]` — no terrain lookup. A road site on wall reports 300 (vanilla expects 300 × 150 = 45000); on swamp it reports 300 (vanilla expects 1500). Hits and decay already scale correctly via `mods/road/road.ts:26` and `:55`; only the site cost getter is missing the same branch.
- Fix shape: teach `progressTotal` (or a helper it delegates to) to multiply by `CONSTRUCTION_COST_ROAD_WALL_RATIO` / `CONSTRUCTION_COST_ROAD_SWAMP_RATIO` when `structureType === STRUCTURE_ROAD` and the underlying terrain is wall/swamp. Mirror the pattern used in `road.ts:23-28`.

### wall-road-not-traversable
- Tests: ROAD-TRAVERSAL-001, ROAD-FATIGUE-003, ROAD-WEAR-003
- Cause: Movement resolver at `engine/processor/movement.ts:117-120` rejects any target on `TERRAIN_MASK_WALL` before looking at structures on that tile, so a road covering a natural wall never makes the tile walkable. Vanilla's `checkMovement` only blocks wall terrain when no road is present. The downstream fatigue and wear code at `mods/creep/processor.ts:152-165` already handles road-on-any-terrain correctly, so fixing the resolver also unblocks the fatigue and wear assertions.
- Note: `Room.findPath` is *not* affected — xxscreeps's path cost matrix correctly treats a wall-road as walkable (`ROAD-TRAVERSAL-002` passes), creating an observable inconsistency where the pathfinder happily routes creeps onto wall-roads that the resolver then refuses to enter.
- Fix shape: in the terrain branch of `dispatch()`, if `terrain.get(nextPosition) === TERRAIN_MASK_WALL`, look for a `STRUCTURE_ROAD` at that position via `room['#lookAt']` (or the existing `lookForStructureAt`) and only return `false` when no road is present. One-block change; the pathfinder side already agrees.

### getrawbuffer-uint8-truncation
- Tests: MAP-TERRAIN-003
- Cause: `Terrain.getRawBuffer(destinationArray)` in `game/terrain.ts:68-85` has a non-`'xxscreeps'` branch (the Screeps-compat path) that builds a 32-bit-packed value per source byte and assigns it with `buffer[ii] = <32-bit-value>`. The code works when `destinationArray` is a `Uint32Array` (each slot holds 4 tiles' masks, 8 bits each, and the final `new Uint8Array(buffer.buffer)` view unpacks them into the correct 2500 byte positions). Given a `Uint8Array` — which is what the Screeps API documents and what `screeps-game-api.d.ts` types — `buffer[ii] =` truncates to the low byte, so only tile `4*ii+0` survives at byte `ii`; tiles `4*ii+1..4*ii+3` are lost, and bytes 625..2499 stay uninitialised. The bug was previously masked because every tile in the test harness was plain (mask 0), so the truncated output and the true mask agreed everywhere. Corner walls in generated maps (now enforced by `src/terrain-fixture.ts:withCornerWalls`) land on offsets `49`, `2450`, `2499` which all fall on truncated-or-untouched bytes, producing exactly 3 mismatches vs `terrain.get(49, 0)` / `get(0, 49)` / `get(49, 49)`.
- Fix shape: when `destinationArray` is a `Uint8Array`, write one mask per tile: `for (let i = 0; i < 2500; ++i) buffer[i] = (source[i >>> 2] >>> ((i & 0x03) << 1)) & 0x03;`. Keep the existing `Uint32Array` path for internal callers. Simplest: dispatch on `destinationArray instanceof Uint8Array`.

