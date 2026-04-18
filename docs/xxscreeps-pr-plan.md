# xxscreeps PR plan

Companion to `docs/xxscreeps-parity-gaps.md`. Groups the 49 confirmed entries (50 parity.json keys + 1 won't-fix) into PR-sized batches by mod/code area, ordered for low-blast-radius-first submission.

Last refreshed: 2026-04-18.

## Submitted (awaiting review)

| Plan | PR | Title |
|---|---|---|
| PR-16 | [laverdet/xxscreeps#118](https://github.com/laverdet/xxscreeps/pull/118) | Fix Flag.setPosition to use parsed position id |
| PR-17 | [laverdet/xxscreeps#119](https://github.com/laverdet/xxscreeps/pull/119) | Match vanilla corner-exit branch order in creep room transition |
| PR-11a | [laverdet/xxscreeps#120](https://github.com/laverdet/xxscreeps/pull/120) | Short-circuit Room.findPath when origin === goal |
| PR-11b | [laverdet/xxscreeps#121](https://github.com/laverdet/xxscreeps/pull/121) | Fix Game.map.findRoute: routeCallback arg order and null-exit guard |
| PR-18 | [laverdet/xxscreeps#122](https://github.com/laverdet/xxscreeps/pull/122) | Scale ConstructionSite.progressTotal for roads by terrain ratio |

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

### PR-1: Structure ownership precedence (`mods/structure/structure.ts`)
- **Closes (3 entries / 6 tests):** `destroy-ownership-bypass` (STRUCTURE-API-001), `lab-not-owner-precedence + observer-not-owner-precedence` (LAB-RUN-012, LAB-REVERSE-012, OBSERVER-006), `controller-my-undefined-on-unowned` (CTRL-UNCLAIM-001, CTRL-DOWNGRADE-002)
- **Plan:**
  1. `checkMyStructure` (line 206): branch on `structure instanceof OwnedStructure` — if true, require `structure.my`; otherwise fall back to `room.controller?.my`. Today the condition `!structure.my && !structure.room.controller?.my` conflates two cases.
  2. `OwnedStructure.my` (lines 108-111): return `false` cleanly when `#user` is absent, not `undefined`.
- **Blast radius:** 13 owned-structure call sites; only manifests in multi-player rooms or unowned-controller scenarios. Single source-of-truth fix unblocks lab/observer/destroy gates simultaneously.

### PR-2: Resource store mechanics (`mods/resource/store.ts`)
- **Closes (3 entries / 6 tests):** `mineral-harvest-no-overflow-drop` (HARVEST-MINERAL-012), `transfer-wrong-resource-err-full` (TRANSFER-007/008) + `withdraw-wrong-resource-not-enough-energy` (WITHDRAW-014), `lab-bound-getfreecapacity-returns-zero` (STORE-BIND-002:H/O/G)
- **Plan:**
  1. Override `OpenStore.getFreeCapacity` to return `this['#capacity'] - this._sum` regardless of `resourceType` (shared-capacity stores need shared free-cap math).
  2. Base `Store.getFreeCapacity` (line 74): short-circuit on `null` from `getCapacity`/`getUsedCapacity` (returns `null` instead of `null - null === 0`).
  3. `checkHasResource` and `checkHasCapacity` (lines 331-348): if `target.store.getCapacity(resourceType) === null`, return `ERR_INVALID_TARGET` before the amount comparison.
- **Blast radius:** Wide — every place using `getFreeCapacity(specificType)` on shared-cap stores. Likely fixes or exposes other gaps; rerun parity post-fix.

### PR-3: Controller safe-mode + generateSafeMode guards (`mods/controller/`)
- **Closes (3 entries / 6 tests):** `safemode-ignores-downgrade-threshold` (CTRL-SAFEMODE-005), `safemode-concurrent-allowed` (CTRL-SAFEMODE-007), `generate-safe-mode-requires-work` (CTRL-GENSAFE-001..004)
- **Plan:**
  1. `checkActivateSafeMode` (`controller.ts:103-115`): add `ticksToDowngrade < CONTROLLER_DOWNGRADE_SAFEMODE_THRESHOLD` → `ERR_TIRED` guard.
  2. Same function: scan all owned controllers per player (iterate `Game.rooms` filtering by `room.controller?.my`) for an active safe mode; return `ERR_BUSY` if any.
  3. `checkGenerateSafeMode` (`creep.ts:155`): change `checkCommon(creep, C.WORK)` to `checkCommon(creep)` — drop the WORK-part requirement.
- **Blast radius:** Tight; only affects safe-mode call paths.

### PR-4: Cooldown anchoring (`mods/chemistry/processor.ts` + `mods/mineral/processor.ts`)
- **Closes (2 entries / 5 tests):** `lab-cooldown-no-decrement` (LAB-RUN-004, LAB-REVERSE-004, UNBOOST-005), `extractor-cooldown-off-by-one` (HARVEST-MINERAL-003, EXTRACTOR-006)
- **Plan:** Both bugs share root: `Game.time` during processing equals T+1 because xxscreeps advances `shard.time` before processing. Vanilla constants have different semantics — `REACTION_TIME` includes the action tick, `EXTRACTOR_COOLDOWN` doesn't.
  1. `chemistry/processor.ts:32, 92, 139`: change `Game.time + reactionTime` → `Game.time + reactionTime - 1`.
  2. `mineral/processor.ts:21`: change `Game.time + EXTRACTOR_COOLDOWN - 1` → `Game.time + EXTRACTOR_COOLDOWN`.
  3. Audit `factory/processor.ts:21` (`Game.time + recipe.cooldown`, no `-1`) — needs vanilla comparison to determine which pattern applies.
- **Blast radius:** Off-by-one tick visibility for cooldown getters. Could split into two PRs if maintainer prefers; one PR is more cohesive.

### PR-5: Link mod (`mods/logistics/`)
- **Closes (4 entries / 4 tests):** `link-cross-owner` (LINK-006), `link-self-transfer` (LINK-004), `link-cooldown-not-persisted` (LINK-002), `shape-struct-missing-legacy-compat:link` (SHAPE-STRUCT-001:link)
- **Plan:**
  1. `link.ts:66-82` `checkTransferEnergy`: add `link.id === target.id` → `ERR_INVALID_TARGET`; add `target['#user'] !== link['#user']` → `ERR_NOT_OWNER`.
  2. `processor.ts:18` add `context.didUpdate()` after `saveAction` (link is the only intent processor that mutates serialized state without it).
  3. `link.ts`: add `get energy()` and `get energyCapacity()` legacy compat getters delegating to store.
- **Blast radius:** Self-contained.

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

### PR-12: Boost energy cost (`mods/controller/processor.ts`, `mods/construction/processor.ts`)
- **Closes (1 entry / 2 tests):** `boost-energy-cost-scales` (BOOST-BUILD-002, BOOST-UPGRADE-002)
- **Plan:** `controller/processor.ts:173-182` and `construction/processor.ts:89-94`: separate boosted output (`calculatePower`) from energy charge. Energy should derive from unboosted WORK part count, not the boosted multiplier.
- **Blast radius:** Affects boosted upgrade/build energy economy.

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

### PR-16: Flag setPosition — submitted as #118
- **Closed (1 entry / 1 test):** `flag-setposition-ignored` (FLAG-006).
- **Fix:** `flag.ts:81`: `this.pos['#id']` → `pos!['#id']`.

### PR-17: Corner-exit branch order — submitted as #119
- **Closed (1 entry / 1 test):** `corner-exit-branch-order` (ROOM-TRANSITION-006).
- **Fix:** `processor.ts:311-319`: swap branches 2 and 3 so the order is `x=0 → y=0 → x=49 → y=49`, matching vanilla (`@screeps/engine/src/processor/intents/creeps/tick.js:58-73`). Verified all four corners: only (49, 0) diverged; the other three resolve identically in both orderings.

### PR-18: Road construction site terrain scaling — submitted as #122
- **Closed (1 entry / 2 tests):** `road-site-progresstotal-no-terrain-scaling` (CONSTRUCTION-COST-003:wall, CONSTRUCTION-COST-003:swamp).
- **Fix:** `mods/construction/construction-site.ts:34`: extend the `progressTotal` getter so that for `STRUCTURE_ROAD` it multiplies `CONSTRUCTION_COST[structureType]` by `CONSTRUCTION_COST_ROAD_WALL_RATIO` on wall or `CONSTRUCTION_COST_ROAD_SWAMP_RATIO` on swamp, via `this.room.getTerrain().get(this.pos.x, this.pos.y)`. Every other structureType short-circuits through the same single-cost path as before. Mirrors the existing ratio application in `mods/road/road.ts` `checkPlacement` and the post-build hits scaling in the shared `build.js` completion branch.

---

## Summary

| Area | PR | Gaps closed |
|---|---|---|
| Adapter (this repo) | AD-1, AD-2 | 6 (AD-1: 3 inc. STRUCTURE-HITS-005 bonus; AD-2: 3 via border-position test fix) |
| Structure ownership | PR-1 | 3 |
| Resource store | PR-2 | 3 |
| Controller safe-mode | PR-3 | 3 |
| Cooldowns | PR-4 | 2 |
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
| Flag setPosition | PR-16 | 1 |
| Corner-exit branch order | PR-17 | 1 |
| Road-site terrain scaling | PR-18 | 1 |
| **Total xxscreeps PRs** | **18** | **47** |
| **Grand total** | | **49 entries / 50 parity.json keys** |

## Suggested submission order

Lowest blast radius first, builds reviewer trust before submitting wider changes.

1. ~~**PR-16**~~ submitted as #118 — flag setPosition
2. ~~**PR-17**~~ submitted as #119 — corner-exit reorder
3. ~~**PR-11**~~ split + submitted as #120 (findPath same-pos) and #121 (routeCallback)
4. ~~**PR-18**~~ submitted as #122 — road-site terrain scaling
5. **PR-12** (boost energy cost) — 2-file targeted fix ← next
6. **PR-3** (safe-mode guards) — tight area
7. **PR-5** (link) — self-contained mod
8. **PR-1** (structure ownership) — high-impact but localized; unblocks lab/observer
9. **PR-4** (cooldowns) — well-explained shared root
10. **PR-2** (resource store) — wide-impact, needs careful review; better after some trust built
11. **PR-15** (memory) — depends on DB schema for public segments; could need design discussion
12. Remaining PRs (PR-6, 7, 8, 9, 10, 13, 14) in any order based on capacity

## Adapter changes (do these first)

Before any xxscreeps PR, land **AD-1** and **AD-2** in this repo. They:
- Close 5 gaps without engine changes
- Reduce noise in the parity baseline so xxscreeps PR test runs are cleaner
- Are independent of xxscreeps merge timing
