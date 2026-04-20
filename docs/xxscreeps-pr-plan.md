# xxscreeps PR plan

Companion to `docs/xxscreeps-parity-gaps.md`. Groups the 49 confirmed entries (50 parity.json keys + 1 won't-fix) into PR-sized batches by mod/code area, ordered for low-blast-radius-first submission.

Last refreshed: 2026-04-19.

PR-1 was submitted as #128 and landed one bonus gap closure: `factory-not-owner-precedence` (FACTORY-PRODUCE-010) shared the same root cause in `checkMyStructure` and cleared without a separate fix.

## Merged upstream

| Plan | PR | Title |
|---|---|---|
| PR-16 | [laverdet/xxscreeps#118](https://github.com/laverdet/xxscreeps/pull/118) | Fix Flag.setPosition to use parsed position id |

## Submitted (awaiting review)

| Plan | PR | Title |
|---|---|---|
| PR-11a | [laverdet/xxscreeps#120](https://github.com/laverdet/xxscreeps/pull/120) | Short-circuit Room.findPath when origin === goal |
| PR-11b | [laverdet/xxscreeps#121](https://github.com/laverdet/xxscreeps/pull/121) | Fix Game.map.findRoute: routeCallback arg order and null-exit guard |
| PR-18 | [laverdet/xxscreeps#122](https://github.com/laverdet/xxscreeps/pull/122) | Scale ConstructionSite.progressTotal for roads by terrain ratio |
| PR-19 | [laverdet/xxscreeps#123](https://github.com/laverdet/xxscreeps/pull/123) | Respect roads over wall terrain in the movement resolver |
| PR-20 | [laverdet/xxscreeps#124](https://github.com/laverdet/xxscreeps/pull/124) | Fix Terrain.getRawBuffer Uint8Array destination overload |
| PR-12 | [laverdet/xxscreeps#125](https://github.com/laverdet/xxscreeps/pull/125) | Decouple boost output from energy cost for build, repair, and upgradeController |
| PR-3 | [laverdet/xxscreeps#126](https://github.com/laverdet/xxscreeps/pull/126) | Fix controller safe-mode guards and generateSafeMode intent |
| PR-5 | [laverdet/xxscreeps#127](https://github.com/laverdet/xxscreeps/pull/127) | Guard link.transferEnergy, persist cooldown, restore legacy getters |
| PR-1 | [laverdet/xxscreeps#128](https://github.com/laverdet/xxscreeps/pull/128) | Fix structure ownership precedence in checkMyStructure and destroy |
| PR-4 | [laverdet/xxscreeps#129](https://github.com/laverdet/xxscreeps/pull/129) | Fix cooldown anchoring for lab, factory, and extractor intents |
| PR-2 | [laverdet/xxscreeps#130](https://github.com/laverdet/xxscreeps/pull/130) | Fix Store.getFreeCapacity null propagation and OpenStore pool semantics |

PR-11 was split into two PRs (`11a` same-pos findPath; `11b` routeCallback arg order + a latent `describeExits`-returns-null crash exposed by the arg-order fix). The original plan's "needs side-by-side debug" note on route-callback-ignored is stale — the real cause was a single swapped-arg line at `map.ts:162`, not an un-invoked callback.

> Source paths: xxscreeps engine at `/Users/mrwise/Coding/Screeps/xxscreeps/src`; this repo's adapter at `adapters/xxscreeps/`.

## Adapter changes (NOT xxscreeps PRs — this repo)

### AD-1: `placeTombstone` / `placeRuin` ticksToDecay anchoring
- **File:** `adapters/xxscreeps/index.ts:452, 483`
- **Closes:** `tombstone-place-low-decay` (TOMBSTONE-004), `ruin-place-low-decay` (RUIN-005)
- **Plan:** Replace `(spec.deathTime ?? 0) + (spec.ticksToDecay ?? 500)` and `(spec.destroyTime ?? 0) + ...` with `this.simulation!.shard.time + (spec.ticksToDecay ?? 500)` (mirror of the 2026-04-11 placeStructure fix). Keep death/destroyTime for cosmetic property setters.
- **Risk:** None — adapter-only, contract test catches regressions.

### AD-2: Finalize-extras error handler (landed; closes nothing on its own)
- **File:** `adapters/xxscreeps/index.ts:1156` (`sim.tick` phase-2 extras loop)
- **Closes (after follow-up fix):** `reserve-007-processor-finalize-missing-room` (CTRL-RESERVE-007), `claim-reserved-no-guard` (CTRL-CLAIM-003), `upgrade-blocked-no-guard` (CTRL-UPGRADE-009).
- **What landed (commit 1):** Wrap `shard.loadRoom(roomName)` in try/catch; `continue` past rooms that don't exist. Correct on its own merits — the engine's `publishInterRoomIntents` enqueues neighbor rooms for cross-room intents (reserve/attack/claim) that test setups don't always create, and silently dropping that finalize work is correct test-harness behavior.
- **What landed (commit 2):** All three tests placed a creep at `(ctrlPos.x - 1, ctrlPos.y)` = `(0, 1)` — a room-exit tile. xxscreeps's creep tick processor (`mods/creep/processor.ts:308`) auto-transitions creeps at border positions (`isBorder(pos) && user.length > 2`), removing them on the first tick. Vanilla doesn't auto-transition without a move intent, so the tests passed there. Fix: shift to `(ctrlPos.x, ctrlPos.y + 1)` = `(1, 2)`, which is adjacent to the canonical (1,1) controller and off-border. No test logic changed.
- **Risk:** Low (position-only test fix + localized try/catch).

---

## xxscreeps PRs

### PR-1: Structure ownership precedence — submitted as #128
- **Closes (4 entries / 7 tests):** `destroy-ownership-bypass` (STRUCTURE-API-001), `lab-not-owner-precedence` (LAB-RUN-012, LAB-REVERSE-012), `observer-not-owner-precedence` (OBSERVER-006), `controller-my-undefined-on-unowned` (CTRL-UNCLAIM-001, CTRL-DOWNGRADE-002), plus bonus `factory-not-owner-precedence` (FACTORY-PRODUCE-010) sharing the same root cause.
- **Fix:**
  1. `structure.ts:108` `OwnedStructure.my`: return `user ? user === me : false` instead of `user === null ? undefined : user === me`. Vanilla's `_ownerGetter` exposes `my` as a boolean — `undefined` on absent `#user` broke `===`-against-`false` assertions after unclaim/downgrade.
  2. `structure.ts:203` `checkMyStructure`: replace `!structure.my && !structure.room.controller?.my` with `!(structure instanceof OwnedStructure) || !structure.my`. Vanilla's per-structure intents (lab reactions, observer, factory, terminal, spawn, tower) gate on `!this.my` alone; the old disjunction let a structure owned by another player succeed if the caller owned the room controller.
  3. `structure.ts:219` `checkDestroy`: stopped delegating to `checkMyStructure`. Vanilla `Structure.prototype.destroy` checks only `this.room.controller.my` (`@screeps/engine/src/game/structures.js:72-78`). The shared helper accepted self-ownership on `OwnedStructure`, letting a player destroy their own rampart placed in another player's room.

### PR-2: Resource store mechanics — submitted as #130
- **Closes (3 entries / 7 tests):** `mineral-harvest-no-overflow-drop` (HARVEST-MINERAL-012), `transfer-wrong-resource-err-full` (TRANSFER-007/008) + `withdraw-wrong-resource-not-enough-energy` (WITHDRAW-014), `lab-bound-getfreecapacity-returns-zero` (STORE-BIND-002:H/O/G).
- **Fix:** Three edits in `mods/resource/store.ts`, all keyed off the invariant `Store.getCapacity(rt) === null` is the canonical "wrong type" signal.
  1. `Store.getFreeCapacity` (line 74): short-circuit to `null` when `getCapacity(rt)` or `getUsedCapacity(rt)` is `null`. Closes `lab-bound-getfreecapacity-returns-zero` — restricted/lab stores now report null free-cap for unsupported types instead of `null - null === 0`.
  2. `OpenStore.getFreeCapacity` override: return `this['#capacity'] - this._sum` regardless of `resourceType`. Shared-pool semantics. Closes `mineral-harvest-no-overflow-drop` — `creep.store.getFreeCapacity('H')` on a partially-loaded creep now reports remaining pool, not full capacity, so `mods/mineral/processor.ts:14` overflow math triggers.
  3. `checkHasResource` and `checkHasCapacity` (lines 331-348): gate on `target.store.getCapacity(rt) === null → ERR_INVALID_TARGET` before the amount/capacity comparison. Closes `transfer-wrong-resource-err-full` and `withdraw-wrong-resource-not-enough-energy` — energy-only structures (spawn/extension/tower SingleStore) and bound labs now reject wrong types with the right error.
- Wide blast radius confirmed clean by full parity: 0 regressions, exactly the 7 expected unexpected passes (plus one stale-baseline FLAG-006 already fixed in pin).

### PR-3: Controller safe-mode + generateSafeMode guards — submitted as #126
- **Closes (3 entries / 6 tests):** `safemode-ignores-downgrade-threshold` (CTRL-SAFEMODE-005), `safemode-concurrent-allowed` (CTRL-SAFEMODE-007), `generate-safe-mode-requires-work` (CTRL-GENSAFE-001..004).
- **Fix (3 files, `mods/controller/`):**
  1. `controller.ts:103-126` `checkActivateSafeMode`: match vanilla's guard order — `ERR_NOT_ENOUGH_RESOURCES` → `ERR_TIRED` (cooldown, `upgradeBlocked`, **or** `ticksToDowngrade < CONTROLLER_DOWNGRADE[level]/2 - CONTROLLER_DOWNGRADE_SAFEMODE_THRESHOLD`) → `ERR_BUSY` via `Object.values(Game.rooms)` scan for any owned controller already in safe mode. The cross-room scan subsumes the old single-target `safeMode → ERR_BUSY` branch.
  2. `creep.ts:155` `checkGenerateSafeMode`: drop the `WORK` requirement from `checkCommon(creep, C.WORK)` → `checkCommon(creep)`. Vanilla `Creep.prototype.generateSafeMode` (`@screeps/engine/src/game/creeps.js:1049`) only checks `my`, `!spawning`, ghodium, and range.
  3. `processor.ts:126` `generateSafeMode` processor: replace `creep.store[C.RESOURCE_GHODIUM] -= C.SAFE_MODE_COST` (no-op on the schema-backed Store proxy) with `creep.store['#subtract'](C.RESOURCE_GHODIUM, C.SAFE_MODE_COST)`. Latent bug — masked by the user-side WORK guard rejecting every call before the processor ran.

### PR-4: Cooldown anchoring — submitted as #129
- **Closes (3 entries / 6 tests):** `lab-cooldown-no-decrement` (LAB-RUN-004, LAB-REVERSE-004, UNBOOST-005), `extractor-cooldown-off-by-one` (HARVEST-MINERAL-003, EXTRACTOR-006), `factory-cooldown-no-decrement` (FACTORY-PRODUCE-002).
- **Root cause:** xxscreeps runs intent processing and the cooldown getter at the same `Game.time`, while vanilla writes `cooldownTime` at processor `gameTime = T` and reads it at runtime `runtimeData.time = T+1`. That asymmetry gives vanilla an implicit `DURATION - 1` that xxscreeps doesn't have — so every `Game.time + X` write reports `X` instead of `X - 1`. Extractor is the odd one out in vanilla because it uses a raw counter + tick-processor decrement (`@screeps/engine/src/processor/intents/extractors/tick.js`) rather than `cooldownTime`, so it never had the `-1` to begin with.
- **Fix:**
  1. `chemistry/processor.ts:32, 92, 139` (runReaction / reverseReaction / unboostCreep): subtract 1 from the `Game.time + X` write.
  2. `factory/processor.ts:22` (produce): subtract 1 — same root cause as chemistry; folded in because the fix is a single character and closes `factory-cooldown-no-decrement` for free.
  3. `mineral/processor.ts:21` (harvest): drop the existing `-1` so the raw `EXTRACTOR_COOLDOWN` is visible at the first observer tick. Mirrors vanilla's counter pattern.
- Mirrors PR-5's link fix (`mods/logistics/processor.ts:17`), which already used the `-1` compensation that this PR propagates.

### PR-5: Link mod — submitted as #127
- **Closed (4 entries / 4 tests):** `link-cross-owner` (LINK-006), `link-self-transfer` (LINK-004), `link-cooldown-not-persisted` (LINK-002), `shape-struct-missing-legacy-compat:link` (SHAPE-STRUCT-001:link).
- **Fix:**
  1. `link.ts:66` `checkTransferEnergy`: add `target === link` → `ERR_INVALID_TARGET`; add `!target.my` → `ERR_NOT_OWNER` (matching `checkUnboostCreep` in `mods/chemistry/lab.ts:196-198` rather than a raw `#user` comparison).
  2. `processor.ts:18` add `context.didUpdate()` after `saveAction` — link was the only state-mutating intent processor missing it, so local mutations fell through to `copyRoomFromPreviousTick` in structure-only rooms.
  3. `link.ts`: add `@deprecated` `energy` and `energyCapacity` getters delegating to store, mirroring `StructureLab`'s pair at `mods/chemistry/lab.ts:36-38`.

### PR-6: Spawn intents (`mods/spawn/`)
- **Closes (4 entries / 6 tests):** `renew-while-spawning` (RENEW-CREEP-009), `renew-rejects-boosted-creep` (RENEW-CREEP-004/005/006), `recycle-no-body-reclaim` (RECYCLE-CREEP-002), `spawn-duplicate-name-allowed` (SPAWN-CREATE-003)
- **Plan:**
  1. `spawn.ts:270-289` `checkRenewCreep`: add `spawn.spawning ? ERR_BUSY : OK` check; remove `bodyPart.boost !== undefined` rejection at line 282.
  2. `processor.ts:131-141` `renewCreep`: strip boosts from body parts during renew (set each `boost = undefined`).
  3. `processor.ts:122-129` `recycleCreep`: replace `// TODO` with energy reclaim — compute `bodyCost × ttlRemaining / CREEP_LIFE_TIME` and deposit into spawn's energy structures via `consumeEnergy`-inverse.
  4. `spawn.ts:308-310` `checkSpawnCreep`: drop `checkIsActive(spawn)` from user-side validation (vanilla parity — only enforced at processing time).
- **Blast radius:** Affects all spawn lifecycle tests; needs careful re-run.

### PR-7: Creep death + tombstone (`mods/creep/tombstone.ts`, `mods/creep/processor.ts`)
- **Closes (2 entries / 4 tests):** `tombstone-corpse-rate + tombstone-store-missing` (CREEP-DEATH-008/009, TOMBSTONE-003), `death-container-diversion` (CREEP-DEATH-003)
- **Plan:**
  1. `tombstone.ts:68-86` `buryCreep`: take a `dropRate` parameter (`1.0` for suicide, `CREEP_CORPSE_RATE` for combat). Add body-energy reclaim: `lifeRate = CREEP_CORPSE_RATE × ticksToLive / CREEP_LIFE_TIME; bodyEnergy = floor(sum(BODYPART_COST[part] × lifeRate))`. Add to tombstone.store.energy.
  2. `processor.ts:282`: before calling `buryCreep`, check for a same-tile container; if present and has capacity, divert resources there before tombstone path.
- **Blast radius:** Tombstone behavior wide-impact; verify with all CREEP-DEATH tests.

### PR-8: Combat damage (`mods/combat/`, `mods/defense/rampart.ts`, `mods/creep/creep.ts`, `mods/engine/processor/room.ts`)
- **Closes (3 entries / 7 tests):** `rampart-no-protection` (RAMPART-PROTECT-001/002, DISMANTLE-004, COMBAT-MELEE-005, COMBAT-RANGED-006, COMBAT-RMA-004), `tough-boost-no-reduction` (BOOST-TOUGH-001/002), `eventlog-attack-missing` (ROOM-EVENTLOG-001/002)
- **Plan:**
  1. `combat/creep.ts:196`: fix typo — `target['#captureDamage']` → `object['#captureDamage']`.
  2. `defense/rampart.ts`: add `#layer` getter returning higher value than 0.5; add `#captureDamage` override that absorbs damage into rampart hits.
  3. `creep/creep.ts:116` `#applyDamage`: iterate body parts for TOUGH boosts; multiply incoming damage by the boost's damage-reduction factor before subtracting.
  4. `engine/processor/room.ts:97` `#eventLog` clear: ensure event-log persists across save/load cycle (verify save path includes appended events).
- **Blast radius:** Combat behavior wide; needs all COMBAT-* tests re-run. Could split rampart/TOUGH/eventlog into 3 sub-PRs if maintainer prefers — they're independent code paths.

### PR-9: Hits-zero destruction + ruin spill timing (`mods/construction/processor.ts`, `mods/resource/processor/container.ts`, `mods/structure/processor.ts`)
- **Closes (3 entries / 3 tests):** `dismantle-no-destroy-at-zero-hits` (DISMANTLE-007), `container-destroy-no-spill` (CONTAINER-002), `ruin-spill-decay-on-spill-tick` (STRUCTURE-HITS-005)
- **Plan:**
  1. `construction/processor.ts:75-78`: after `target.hits -= effect`, if `target.hits <= 0` → `createRuin(target); target['#destroy']()`. Also append `EVENT_OBJECT_DESTROYED` (or appropriate constant) to event log.
  2. `resource/processor/container.ts:10-11`: when `container.hits <= 0`, iterate `container.store` and `Resource.drop` each entry before removing the container.
  3. `structure/processor.ts:19-29` Ruin tick processor: change `ResourceIntent.drop(now=true)` path to deferred insertion (use `room['#insertObject'](resource, false)`) so spill piles flush after iteration and skip same-tick decay.
- **Blast radius:** Affects structure-destruction patterns. The ruin-spill fix needs evaluation — `Resource.drop`'s `now=true` is used by other paths (harvest overflow); may need a tagged "spilled-this-tick" flag instead of changing the drop API.

### PR-10: Creep client API (`mods/creep/creep.ts`)
- **Closes (5 entries / 5 tests):** `transfer-controller-no-upgrade-redirect` (TRANSFER-011), `withdraw-enemy-rampart-no-protection` (WITHDRAW-005), `moveto-nopathfinding-returns-ok` (MOVE-BASIC-019), `pull-spawning-no-guard` (MOVE-PULL-007:spawning), `shape-body-part-always-has-boost` (SHAPE-CREEP-002/003)
- **Plan:**
  1. `Creep.transfer` (line 384): if `target instanceof StructureController && resourceType === RESOURCE_ENERGY` → `return this.upgradeController(target)`.
  2. `checkWithdraw` (line 527): add enemy-rampart ownership check on target tile (look for hostile rampart at `target.pos`; reject with `ERR_NOT_OWNER` unless rampart is public).
  3. `searchOrFetchPath` (line 258-260) / `moveTo` (line 312-313): distinguish noPathFinding-no-cache from path-not-found. Either return a sentinel or hoist the check — `ERR_NOT_FOUND` when noPathFinding and no cache; `ERR_NO_PATH` otherwise.
  4. `checkPull` (line 497-502): add `target.spawning ? ERR_INVALID_TARGET : OK` after `checkRange`.
  5. `create` (line 414): drop `boost: undefined` from the literal — `parts.map(type => ({ type, hits: 100 }))`.
- **Blast radius:** Mixed — each fix is local but together they touch all creep client-side intents. Could split into two PRs (intents vs. shape) if too large.

### PR-11: PathFinder + Map — split and submitted as #120 + #121
- **Closed (2 entries / 2 tests):** `findpath-same-pos-not-empty` (LEGACY-PATH-006) via #120; `route-callback-ignored` (MAP-ROUTE-003) via #121.
- **PR-11a (#120):** `path.ts:127`: added `if (origin.isEqualTo(goal)) return options.serialize ? '' : [];`. Mirrors vanilla `_findPath2` (`@screeps/engine/src/game/rooms.js:227-229`).
- **PR-11b (#121):** Two bugs, both in `game/map.ts`'s astar wiring. First, `routeCallback` args were reversed — xxscreeps passed `(from, to)`, vanilla calls `(roomName, fromRoomName)` with neighbor first (`@screeps/engine/src/game/map.js:164`). Second, `describeExits` returns null for rooms with no terrain data, and `Object.values(null)` throws once astar starts actually exploring (unmasked by the arg-order fix) — vanilla's `for...in` no-ops on null. Both fixed together.
- The original "trace astar callback invocation; may not be invoked" diagnosis was wrong — callback was invoked, but with swapped args.

### PR-12: Boost energy cost — submitted as #125
- **Closes (1 entry / 2 tests):** `boost-energy-cost-scales` (BOOST-BUILD-002, BOOST-UPGRADE-002).
- **Fix:** Added `calculateBoundedEffect` in `mods/creep/creep.ts` returning `{ unboosted, boosted }`, mirroring vanilla's sort-boost-deltas-desc-and-slice-to-effect pattern so energy-limited mixed-boost creeps use their most-boosted WORK parts first. Rewired `upgradeController` (`mods/controller/processor.ts:173-182`), `build` (`mods/construction/processor.ts:46-51`), and `repair` (`mods/construction/processor.ts:89-94`) to charge unboosted energy and apply boosted output. Level-8 `upgradePowerThisTick` now tracks unboosted spend, matching vanilla's `target._upgraded`. Dismantle/harvest/combat intents keep `calculatePower` — their yield is supposed to scale with the boost.

### PR-13: Structure API surface (`mods/structure/structure.ts`, `mods/defense/wall.ts`, `mods/structure/ruin.ts`, `mods/logistics/storage.ts`)
- **Closes (3 entries / 4 tests):** `notifyWhenAttacked-not-implemented` (STRUCTURE-API-004/005/006), `shape-extra-hits-my:wall+ruin` (SHAPE-STRUCT-001:constructedWall, SHAPE-RUIN-001), `shape-struct-missing-legacy-compat:storage` (SHAPE-STRUCT-001:storage)
- **Plan:**
  1. Add `notifyWhenAttacked(enabled)` method on `Structure` base — validate ownership, validate boolean arg, persist via a `#notifyWhenAttacked` schema field.
  2. `defense/wall.ts`: add `get ticksToLive()` getter (return null for permanent walls or actual ticks for temporary).
  3. `structure/ruin.ts`: add top-level `get structureType()` delegating to `this['#structure'].type` (currently only on inner sub-object).
  4. `logistics/storage.ts`: add `get storeCapacity()` legacy compat getter.
- **Blast radius:** Surface additions only; doesn't change behavior.

### PR-14: Object/Room/Game runtime shape (`game/object.ts`, `game/room/room.ts`, `game/game.ts`, `mods/flag/game.ts`)
- **Closes (3 entries / 11+ tests):** `shape-extra-hits-my:base+flag` (SHAPE-SOURCE/MINERAL/SITE/RESOURCE/TOMBSTONE/RUIN/STRUCT-001 family + SHAPE-FLAG-001), `shape-room-missing-survivalInfo` (SHAPE-ROOM-001), `shape-game-surface-mismatch` (SHAPE-GAME-001)
- **Plan:**
  1. `game/object.ts:60-62`: remove `hits`/`hitsMax`/`my` getters from base RoomObject. Add per-subclass — every class that has those concepts gets explicit getters; Source/Mineral/Resource/etc. inherit nothing.
  2. `game/object.ts:21`: Flag declares `id: never` — the schema struct's `id` field still surfaces. Either suppress it via Flag-specific serialization or accept the divergence and update test expectation.
  3. `game/room/room.ts`: add `get survivalInfo() { return null; }`.
  4. `game/game.ts`: add `Game.cpuLimit` to gameInitializer (mirror of `cpu.limit`).
  5. `mods/flag/game.ts:74` and `mods/power/game.ts` (powerCreeps): convert `Game.foo = bar` to `Object.defineProperty(Game, 'foo', { get: () => bar, enumerable: true, configurable: true })` to match vanilla's prototype-getter descriptor shape.
- **Blast radius:** Wide — every RoomObject subclass needs review for which getters to expose. Mechanical refactor.

### PR-15: Memory mod (`mods/memory/memory.ts`, `mods/memory/driver.ts`)
- **Closes (3 entries / 6 tests):** `rawmemory-set-no-eager-limit-check` (MEMORY-004), `rawmemory-set-invalidates-parsed-memhack` (MEMORY-002), `foreign-segment-not-supported` (RAWMEMORY-FOREIGN-002/003/004)
- **Plan:**
  1. `memory.ts:82-89` `RawMemory.set`: add `if (value.length > kMaxMemoryLength) throw new Error(...)` before the assignment.
  2. `memory.ts:86`: gate the cache invalidation — only clear `_parsed`/`json` when `!accessedJson`. Preserves memhack identity when user has already accessed `Memory`.
  3. `memory.ts:129, 136`: implement `setDefaultPublicSegment` and `setPublicSegments` (persist to user record).
  4. `driver.ts:55-57`: replace `// TODO` with actual foreign segment fetch (read user/${username}/segments/${id} from DB; pass back via `payload.foreignSegment`).
  5. `memory.ts`: add `RawMemory.foreignSegment` declaration on the object; add `loadForeignSegment(payload)` runtime hook that assigns it.
  6. `mods/memory/driver.ts`: add `payload.foreignSegment` to TickPayload type declaration.
- **Blast radius:** New surface area; needs DB schema confirmation for public-segment storage.

### PR-16: Flag setPosition — merged as #118
- **Closed (1 entry / 1 test):** `flag-setposition-ignored` (FLAG-006). Merged to upstream/main; entry removed from `parity.json`.
- **Fix:** `flag.ts:81`: `this.pos['#id']` → `pos!['#id']`.

### PR-18: Road construction site terrain scaling — submitted as #122
- **Closed (1 entry / 2 tests):** `road-site-progresstotal-no-terrain-scaling` (CONSTRUCTION-COST-003:wall, CONSTRUCTION-COST-003:swamp).
- **Fix:** `mods/construction/construction-site.ts:34`: extend the `progressTotal` getter so that for `STRUCTURE_ROAD` it multiplies `CONSTRUCTION_COST[structureType]` by `CONSTRUCTION_COST_ROAD_WALL_RATIO` on wall or `CONSTRUCTION_COST_ROAD_SWAMP_RATIO` on swamp, via `this.room.getTerrain().get(this.pos.x, this.pos.y)`. Every other structureType short-circuits through the same single-cost path as before. Mirrors the existing ratio application in `mods/road/road.ts` `checkPlacement` and the post-build hits scaling in the shared `build.js` completion branch.

### PR-20: Terrain.getRawBuffer Uint8Array destination — submitted as #124
- **Closes (1 entry / 1 test):** `getrawbuffer-uint8-truncation` (MAP-TERRAIN-003).
- **Fix:** `game/terrain.ts:68-85`: the Screeps-API-compat path wrote a 32-bit packed word via `buffer[ii] = <value>`, which truncates to the low byte when `destinationArray` is `Uint8Array`. Replaced with a byte-wise decode — one mask per tile, 2500 iterations, no packing — which works for both the `Uint8Array(2500)` overload and the default no-arg call. The `'xxscreeps'` variant is untouched. Previously masked by the test harness using all-plain terrain; exposed by enforcing map-generator corner walls in `src/terrain-fixture.ts`.

### PR-19: Wall-road movement resolver — submitted as #123
- **Closed (1 entry / 3 tests):** `wall-road-not-traversable` (ROAD-TRAVERSAL-001, ROAD-FATIGUE-003, ROAD-WEAR-003).
- **Fix:** `engine/processor/movement.ts:117-120`: before failing the move on a wall tile, scan `room.lookForAt(LOOK_STRUCTURES, nextPosition)` for a `STRUCTURE_ROAD`. If present, fall through to the existing obstacle checks. Mirrors vanilla's `checkObstacleAtXY` in `@screeps/engine/src/processor/intents/movement.js:17-37` (`checkTerrain(... WALL) && !hasRoad`). Used `room.lookForAt` rather than `lookForStructureAt` to avoid an `engine/` → `mods/` import; downstream fatigue and `ROAD_WEAROUT` paths in `mods/creep/processor.ts` already key off `lookForStructureAt(..., STRUCTURE_ROAD)` and don't re-examine terrain, so the single resolver change unblocks all three tests.

---

## Summary

| Area | PR | Gaps closed |
|---|---|---|
| Adapter (this repo) | AD-1, AD-2 | 6 (AD-1: 3 inc. STRUCTURE-HITS-005 bonus; AD-2: 3 via border-position test fix) |
| Structure ownership | PR-1 | 4 (inc. factory bonus) |
| Resource store | PR-2 | 3 |
| Controller safe-mode | PR-3 | 3 |
| Cooldowns | PR-4 | 3 (inc. factory-cooldown-no-decrement) |
| Link | PR-5 | 4 |
| Spawn | PR-6 | 4 |
| Creep death | PR-7 | 2 |
| Combat | PR-8 | 3 |
| Hits→destroy | PR-9 | 3 |
| Creep client API | PR-10 | 5 |
| PathFinder/Map | PR-11 | 2 |
| Boost energy | PR-12 | 1 |
| Structure API surface | PR-13 | 3 |
| Object/Game shape | PR-14 | 3 |
| Memory | PR-15 | 3 |
| Flag setPosition | PR-16 | 1 (merged; entry removed) |
| Road-site terrain scaling | PR-18 | 1 |
| Wall-road movement resolver | PR-19 | 1 |
| Terrain.getRawBuffer Uint8Array | PR-20 | 1 |
| **Total xxscreeps PRs** | **19** | **48** |
| **Grand total** | | **49 entries / 50 parity.json keys** |

## Suggested submission order

Lowest blast radius first, builds reviewer trust before submitting wider changes.

1. ~~**PR-16**~~ merged as #118 — flag setPosition
2. ~~**PR-17**~~ — dropped. laverdet rejected #119 as intentional divergence: the map generator always walls corner tiles, so the divergent branch is unreachable in real gameplay. `ROOM-TRANSITION-006` was invalid and the test fixture now enforces corner walls so the state can't be constructed.
3. ~~**PR-11**~~ split + submitted as #120 (findPath same-pos) and #121 (routeCallback)
4. ~~**PR-18**~~ submitted as #122 — road-site terrain scaling
5. ~~**PR-19**~~ submitted as #123 — wall-road movement resolver
6. ~~**PR-20**~~ submitted as #124 — getRawBuffer Uint8Array
7. ~~**PR-12**~~ submitted as #125 — boost energy cost decoupling
8. ~~**PR-3**~~ submitted as #126 — controller safe-mode + generateSafeMode guards
9. ~~**PR-5**~~ submitted as #127 — link transferEnergy guards, cooldown persistence, legacy getters
10. ~~**PR-1**~~ submitted as #128 — structure ownership precedence (also closed factory-not-owner-precedence bonus)
11. ~~**PR-4**~~ submitted as #129 — cooldown anchoring for lab, factory, and extractor intents (also closed factory-cooldown-no-decrement bonus)
12. ~~**PR-2**~~ submitted as #130 — Store.getFreeCapacity null propagation and OpenStore pool semantics
13. **PR-15** (memory) — depends on DB schema for public segments; could need design discussion ← next
14. Remaining PRs (PR-6, 7, 8, 9, 10, 13, 14) in any order based on capacity

## Adapter changes (do these first)

Before any xxscreeps PR, land **AD-1** and **AD-2** in this repo. They:
- Close 5 gaps without engine changes
- Reduce noise in the parity baseline so xxscreeps PR test runs are cleaner
- Are independent of xxscreeps merge timing
