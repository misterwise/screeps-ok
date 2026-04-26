# xxscreeps PR plan

Companion to `docs/xxscreeps-parity-gaps.md`. Groups the 49 confirmed entries (50 parity.json keys + 1 won't-fix) into PR-sized batches by mod/code area, ordered for low-blast-radius-first submission.

Last refreshed: 2026-04-25 (PR-7 noted merged as #136; PR-10 split — PR-10a submitted as #152; PR-10b submitted as #153; PR-6 split — PR-6a logged as #135, PR-6b submitted as #154).

PR-1 was submitted as #128 and landed one bonus gap closure: `factory-not-owner-precedence` (FACTORY-PRODUCE-010) shared the same root cause in `checkMyStructure` and cleared without a separate fix.

## Merged upstream

| Plan | PR | Title |
|---|---|---|
| PR-16 | [laverdet/xxscreeps#118](https://github.com/laverdet/xxscreeps/pull/118) | Fix Flag.setPosition to use parsed position id |
| PR-7 | [laverdet/xxscreeps#136](https://github.com/laverdet/xxscreeps/pull/136) | Reclaim body energy and divert into containers on creep death |
| PR-9 (partial) | [laverdet/xxscreeps#145](https://github.com/laverdet/xxscreeps/pull/145) | Destroy dismantled structures, spill container contents on decay (closed 2 of 3 entries; `ruin-spill-decay-on-spill-tick` deferred) |

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
| PR-15 | [laverdet/xxscreeps#131](https://github.com/laverdet/xxscreeps/pull/131) | Fix RawMemory.set guards and implement foreign/public memory segments |
| PR-13 | [laverdet/xxscreeps#132](https://github.com/laverdet/xxscreeps/pull/132) | Add notifyWhenAttacked and missing structure surface getters |
| PR-14a | [laverdet/xxscreeps#133](https://github.com/laverdet/xxscreeps/pull/133) | Add Game.cpuLimit, Game.powerCreeps, Room.survivalInfo |
| PR-14b | [laverdet/xxscreeps#134](https://github.com/laverdet/xxscreeps/pull/134) | Remove hits/hitsMax/my leak from RoomObject base |
| PR-6a | [laverdet/xxscreeps#135](https://github.com/laverdet/xxscreeps/pull/135) | Fix renewCreep busy/boost guards and spawnCreep check order |
| PR-10a | [laverdet/xxscreeps#152](https://github.com/laverdet/xxscreeps/pull/152) | Fix Creep.transfer redirect to upgradeController; reject pull on spawning |
| PR-10b | [laverdet/xxscreeps#153](https://github.com/laverdet/xxscreeps/pull/153) | Add Creep.withdraw enemy-rampart guard; fix moveTo noPathFinding return code |
| PR-6b | [laverdet/xxscreeps#154](https://github.com/laverdet/xxscreeps/pull/154) | Reclaim body energy on Spawn.recycleCreep |

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

### PR-6: Spawn intents (`mods/spawn/`) — split
- **Closes overall (4 entries / 6 tests):** `renew-while-spawning` (RENEW-CREEP-009), `renew-rejects-boosted-creep` (RENEW-CREEP-004/005/006), `recycle-no-body-reclaim` (RECYCLE-CREEP-002), `spawn-duplicate-name-allowed` (SPAWN-CREATE-003).
- **PR-6a (#135) — submitted:** items 1, 2, 4. Closes `renew-while-spawning` (RENEW-CREEP-009), `renew-rejects-boosted-creep` (RENEW-CREEP-004/005/006), `spawn-duplicate-name-allowed` (SPAWN-CREATE-003).
  1. `spawn.ts:273` `checkRenewCreep`: prepend `() => spawn.spawning ? C.ERR_BUSY : C.OK` so the user-side guard short-circuits before target validation, matching vanilla `structures.js` (`if (this.spawning) return C.ERR_BUSY` ahead of all target checks).
  2. `spawn.ts:283` `checkRenewCreep`: drop the `bodyPart.boost !== undefined → ERR_NO_BODYPART` rejection. Vanilla accepts boosted creeps; the processor strips boosts.
  3. `processor.ts:139-145` `renewCreep`: after the energy/time updates, set each `part.boost = undefined` and call the new exported `dropOverflowResources` helper to recompute capacity and drop excess. Helper extracted from the overflow-drop half of `recalculateBody` in `mods/creep/processor.ts` so both call sites share one path.
  4. `spawn.ts:319` `checkSpawnCreep`: move `checkIsActive(spawn)` to after the name / directions / busy closure. Vanilla returns `ERR_NAME_EXISTS` ahead of `ERR_RCL_NOT_ENOUGH` (`structures.js`: name branch sits above the `data(this.id).off` branch).
- **PR-6b (#154) — submitted:** item 5. Closes `recycle-no-body-reclaim` (RECYCLE-CREEP-002).
  5. `processor.ts:125` `recycleCreep`: replaced `// TODO: This stuff` (was only setting `creep.hits = 0`, falling through to natural-death rate=0.2) with `buryCreep(creep, 1)` from `mods/creep/tombstone.ts`. Vanilla `recycle-creep.js:22` calls `_die(target, 1.0, false, scope)`; PR-7 already implements the body-reclaim + container-diversion path, recycle just invokes it at `rate=1`.
- **Blast radius (PR-6a):** Low — three guards, one shared helper. Watch RENEW-CREEP-* and SPAWN-CREATE-* tests.
- **Blast radius (PR-6b):** Low — 2-line diff, single existing helper. Required a companion test fix in this repo: `9.5-recycle.test.ts` now captures user-tick gameTime + ttl alongside the recycle invocation and derives intent-tick TTL via `tomb.deathTime`. Vanilla and xxscreeps's test simulators process intents at different gameTime offsets from user code (vanilla: same tick; xxscreeps: user time + 1); the original test observed TTL in a separate runPlayer, which placed the expected value 1-2 ticks ahead of bury's TTL. With recycle's rate=1 amplifying per-tick energy delta, vanilla passed by floor coincidence and xxscreeps failed by one. The new derivation collapses to userTtl on vanilla (deathTime == userTime) and userTtl - 1 on xxscreeps (deathTime == userTime + 1), matching each adapter's bury TTL exactly.

### PR-7: Creep death — body energy reclaim + container diversion — merged as #136
- **Closes (3 entries / 5 tests):**
  - `tombstone-corpse-rate` — CREEP-DEATH-008 (`source=suicide`, `source=ticksToLive`), CREEP-DEATH-009
  - `tombstone-store-missing` — TOMBSTONE-003
  - `death-container-diversion` — CREEP-DEATH-003
- **Root cause:** `buryCreep` scales the creep's carried store by `rate` and never reclaims body energy, while vanilla's `_die.js` (`@screeps/engine/src/processor/intents/creeps/_die.js:39-91`) copies the creep's store over at full amount, adds reclaimed body energy at `lifeRate = dropRate × ticksToLive / lifeTime`, and diverts every deposit into a same-tile container first before tombstone remainder. The failing tests observe the full-store + body-reclaim contract directly (TOMBSTONE-003 computes `floor(Σ BODYPART_COST[part] × lifeRate) + carried`; CREEP-DEATH-009 asserts `tomb.store.energy === 19` for a `[CARRY, MOVE]` suicide — which requires `lifeRate × (50+50)` to be reclaimed, not zero).
- **Fix (one file, `mods/creep/tombstone.ts`):** rewrite `buryCreep(creep, rate = C.CREEP_CORPSE_RATE)` around a `deposits: Map<ResourceType, number>` and a container-diversion helper, mirroring `_die.js:39-91`:
  1. `const lifeTime = creep.body.some(p => p.type === C.CLAIM) ? C.CREEP_CLAIM_LIFE_TIME : C.CREEP_LIFE_TIME;` `const lifeRate = rate * (creep.ticksToLive ?? 0) / lifeTime;`. `creep.ticksToLive` returns `undefined` when `#ageTime - Game.time` is `≤ 0` (aging death), so the nullish fallback pins lifeRate to 0 on natural TTL death — matches vanilla's `_ticksToLive = 0` at that moment and explains why CREEP-DEATH-008:`source=ticksToLive` only asserts carried power, not body energy.
  2. Guard body reclaim behind `rate > 0` (collapses vanilla's `dropRate > 0 && !userSummoned && !strongholdId` — `userSummoned`/`strongholdId` aren't modeled; the existing suicide-site check `creep['#user'].length > 2 ? undefined : 0` already routes NPC suicides through rate=0).
  3. For each body part: `deposit(C.RESOURCE_ENERGY, Math.min(C.CREEP_PART_MAX_ENERGY, C.BODYPART_COST[part.type] * lifeRate))`. Floor each resource total after accumulation, before depositing. **Skip boost-mineral reclaim** — vanilla also adds `LAB_BOOST_MINERAL × lifeRate` per boosted part, but importing `mods/chemistry/constants` into `mods/creep/tombstone.ts` inverts mod dependency (today only `mods/combat/test.ts` and `mods/resource/test.ts` cross into chemistry, both tests). Park behind a `registerBodyReclaim` hook when a boost-reclaim test arrives; no current parity test requires it.
  4. Add the creep's carried store verbatim (no `rate` scaling — matches vanilla `_die.js:75-91`, which iterates `object.store` with the raw `amount` and only scales `bodyResources`).
  5. `const container = lookForStructureAt(creep.room, creep.pos, C.STRUCTURE_CONTAINER)`. For each `(type, amount)` deposit: if `container && container.hits > 0`, divert `Math.min(amount, container.store.getFreeCapacity(type) ?? 0)` via `container.store['#add']`; whatever remains flows into `tombstone.store['#add']`. (Pulling `lookForStructureAt` and `STRUCTURE_CONTAINER` into tombstone.ts is safe — `mods/resource/container.ts` → `mods/structure/structure.ts` → `game/object.ts`, no back-edge to creep.)
  6. Keep `tombstone.deathTime`, `tombstone['#creep']`, and `tombstone['#decayTime']` wiring unchanged.
- **Caller audit (no behavior change — just confirming the existing call sites already pass the right rate):**
  - `processor.ts:228` suicide intent: `buryCreep(creep, creep['#user'].length > 2 ? undefined : 0)` — default `C.CREEP_CORPSE_RATE` for real users (playerSlots are length 3: `'100'`..`'103'`), `0` for NPC ids `'2'`/`'3'`. Matches `_die.js` callers in `suicide.js:15 object.user == '2' ? 0 : undefined`.
  - `processor.ts:282` TTL/hits-zero path: `buryCreep(creep)` — default `C.CREEP_CORPSE_RATE`. Matches `tick.js:94,111,115 require('./_die')(object, undefined, ...)`.
- **Out of scope (one-line TODOs at the relevant code sites, no new tests):**
  - Boost-mineral body reclaim (`LAB_BOOST_MINERAL` / `LAB_BOOST_ENERGY` per boosted part) — needs a hook to avoid a chemistry→creep back-dependency.
  - `EVENT_OBJECT_DESTROYED` event-log entry (`_die.js:97`) — belongs with PR-8's `eventlog-attack-missing` surface work.
  - NPC `userSummoned` / `strongholdId` body-reclaim suppression — not modeled upstream.
  - Nuke-skips-tombstone branch (`_die.js:20`) — no nuke mod yet.
- **Blast radius:** Low. One file, no signature change, no new cross-mod imports beyond `mods/structure/structure.js` (already imported transitively elsewhere). Expected unexpected passes: 5. Watch CREEP-DEATH-004 / CREEP-DEATH-005 / CREEP-DEATH-007 — their assertions (`tomb.store` defined, amount-stability across ticks, decay-to-drop) are preserved by the new path; confirm on the PR test run before submit.

### PR-8: Combat damage (`mods/combat/`, `mods/defense/rampart.ts`, `mods/creep/creep.ts`, `mods/engine/processor/room.ts`)
- **Closes (3 entries / 7 tests):** `rampart-no-protection` (RAMPART-PROTECT-001/002, DISMANTLE-004, COMBAT-MELEE-005, COMBAT-RANGED-006, COMBAT-RMA-004), `tough-boost-no-reduction` (BOOST-TOUGH-001/002), `eventlog-attack-missing` (ROOM-EVENTLOG-001/002)
- **Plan:**
  1. `combat/creep.ts:196`: fix typo — `target['#captureDamage']` → `object['#captureDamage']`.
  2. `defense/rampart.ts`: add `#layer` getter returning higher value than 0.5; add `#captureDamage` override that absorbs damage into rampart hits.
  3. `creep/creep.ts:116` `#applyDamage`: iterate body parts for TOUGH boosts; multiply incoming damage by the boost's damage-reduction factor before subtracting.
  4. `engine/processor/room.ts:97` `#eventLog` clear: ensure event-log persists across save/load cycle (verify save path includes appended events).
- **Blast radius:** Combat behavior wide; needs all COMBAT-* tests re-run. Could split rampart/TOUGH/eventlog into 3 sub-PRs if maintainer prefers — they're independent code paths.

### PR-9: Hits-zero destruction + ruin spill timing (`mods/construction/processor.ts`, `mods/resource/processor/container.ts`, `mods/structure/processor.ts`)
- **Status:** Parts 1 + 2 merged as [#145](https://github.com/laverdet/xxscreeps/pull/145); part 3 deferred. Net closure: 2 of 3 entries.
- **Closed (2 entries / 2 tests):** `dismantle-no-destroy-at-zero-hits` (DISMANTLE-007), `container-destroy-no-spill` (CONTAINER-002)
- **Still open (1 entry / 1 test):** `ruin-spill-decay-on-spill-tick` (STRUCTURE-HITS-005) — needs a separate PR.
- **Plan (remaining work):**
  1. ~~`construction/processor.ts:75-78`: dismantle destroy hook.~~ Landed.
  2. ~~`resource/processor/container.ts:10-11`: spill on decay.~~ Landed.
  3. `structure/processor.ts:19-29` Ruin tick processor: change `ResourceIntent.drop(now=true)` path to deferred insertion (use `room['#insertObject'](resource, false)`) so spill piles flush after iteration and skip same-tick decay.
- **Blast radius:** Affects structure-destruction patterns. The ruin-spill fix needs evaluation — `Resource.drop`'s `now=true` is used by other paths (harvest overflow); may need a tagged "spilled-this-tick" flag instead of changing the drop API.

### PR-10: Creep client API (`mods/creep/creep.ts`) — split
- **Closes overall (5 entries / 5 tests):** `transfer-controller-no-upgrade-redirect` (TRANSFER-011), `withdraw-enemy-rampart-no-protection` (WITHDRAW-005), `moveto-nopathfinding-returns-ok` (MOVE-BASIC-019), `pull-spawning-no-guard` (MOVE-PULL-007:spawning), `shape-body-part-always-has-boost` (SHAPE-CREEP-002/003).
- **PR-10a (#152) — submitted:** items 1 and 4. Closes `transfer-controller-no-upgrade-redirect` (TRANSFER-011) and `pull-spawning-no-guard` (MOVE-PULL-007:spawning).
  1. `creep.ts:388` `transfer`: prepend `if (target instanceof StructureController && resourceType === C.RESOURCE_ENERGY) return this.upgradeController(target);`. Imports `StructureController` from `mods/controller/controller.js` — no cycle (controller.ts pulls only from structure/schema; the controller-mod's edge into mods/creep is via `mods/controller/creep.ts`, not `controller.ts`).
  2. `creep.ts:512` `checkPull`: append `() => target!.spawning ? C.ERR_INVALID_TARGET : C.OK` to the existing chain — preserves target/range error precedence.
- **PR-10b (#153) — submitted:** items 3 and 4. Closes `withdraw-enemy-rampart-no-protection` (WITHDRAW-005) and `moveto-nopathfinding-returns-ok` (MOVE-BASIC-019).
  3. `checkWithdraw`: added a `checkEnemyRampart(target)` step in the chain after `checkTarget` and before `checkRange`. Gated on `target instanceof OwnedStructure && !target.my` so neutral structures, tombstones, and ruins are unaffected; uses `lookForStructureAt(target.room, target.pos, STRUCTURE_RAMPART)` (one rampart per tile is enforced at construction in `mods/defense/rampart.ts:71-76`); rejects with `ERR_NOT_OWNER` when `rampart && !rampart.my && !rampart.isPublic`. Public ramparts allow withdraw, matching vanilla `creeps.js:525-527`.
  4. `moveTo`: changed the `if (!path) return C.ERR_NO_PATH` branch at the searchOrFetchPath caller to `return C.ERR_NOT_FOUND`. `searchOrFetchPath` only returns `null` from the `noPathFinding && !cachedPath` branch (`findPathTo` always returns an array, cache hits return arrays), so the `null` sentinel uniquely identifies the noPathFinding-no-cache case. Empty-path fallback still returns `ERR_NO_PATH` for genuinely unreachable targets.
- **Still open (1 entry):**
  5. `shape-body-part-always-has-boost` is **not** the one-line `create()` literal change the plan originally suggested. The body schema declares `boost: optionalResourceEnumFormat`, which makes `boost` a required own property on every deserialized body part — even when undefined. Removing the literal `boost: undefined` from `create()` is masked by the next tick's blob round-trip. Closing this needs schema-level work: either a custom struct reader that skips writing properties when the optional resolves to `undefined`, or a `compose()` overlay class with a getter that conditionally exposes `boost`. Track separately as PR-10c (or fold into a future schema-shape PR).
- **Blast radius (PR-10a, PR-10b):** Low — narrow guards and one error-code change. Full xxscreeps parity confirmed clean for both: 2 intended unexpected passes each, 0 regressions.

### PR-11: PathFinder + Map — split and submitted as #120 + #121
- **Closed (2 entries / 2 tests):** `findpath-same-pos-not-empty` (LEGACY-PATH-006) via #120; `route-callback-ignored` (MAP-ROUTE-003) via #121.
- **PR-11a (#120):** `path.ts:127`: added `if (origin.isEqualTo(goal)) return options.serialize ? '' : [];`. Mirrors vanilla `_findPath2` (`@screeps/engine/src/game/rooms.js:227-229`).
- **PR-11b (#121):** Two bugs, both in `game/map.ts`'s astar wiring. First, `routeCallback` args were reversed — xxscreeps passed `(from, to)`, vanilla calls `(roomName, fromRoomName)` with neighbor first (`@screeps/engine/src/game/map.js:164`). Second, `describeExits` returns null for rooms with no terrain data, and `Object.values(null)` throws once astar starts actually exploring (unmasked by the arg-order fix) — vanilla's `for...in` no-ops on null. Both fixed together.
- The original "trace astar callback invocation; may not be invoked" diagnosis was wrong — callback was invoked, but with swapped args.

### PR-12: Boost energy cost — submitted as #125
- **Closes (1 entry / 2 tests):** `boost-energy-cost-scales` (BOOST-BUILD-002, BOOST-UPGRADE-002).
- **Fix:** Added `calculateBoundedEffect` in `mods/creep/creep.ts` returning `{ unboosted, boosted }`, mirroring vanilla's sort-boost-deltas-desc-and-slice-to-effect pattern so energy-limited mixed-boost creeps use their most-boosted WORK parts first. Rewired `upgradeController` (`mods/controller/processor.ts:173-182`), `build` (`mods/construction/processor.ts:46-51`), and `repair` (`mods/construction/processor.ts:89-94`) to charge unboosted energy and apply boosted output. Level-8 `upgradePowerThisTick` now tracks unboosted spend, matching vanilla's `target._upgraded`. Dismantle/harvest/combat intents keep `calculatePower` — their yield is supposed to scale with the boost.

### PR-13: Structure API surface (`mods/structure/structure.ts`, `mods/structure/processor.ts`, `mods/defense/wall.ts`, `mods/structure/ruin.ts`, `mods/logistics/storage.ts`)
- **Closes on its own (6 tests):** `notifyWhenAttacked-not-implemented` (STRUCTURE-API-004/005/006/007/008), `shape-struct-missing-legacy-compat:storage` (SHAPE-STRUCT-001:storage). STRUCTURE-API-007/008 were added alongside the PR to cover the unowned-structure-in-own-room and controller-owner-mismatch branches that the original three didn't exercise.
- **Closes jointly with PR-14 (2 tests):** SHAPE-STRUCT-001:constructedWall and SHAPE-RUIN-001 need PR-13's `ticksToLive`/`structureType` getters AND PR-14's RoomObject cleanup (removing leaked `hits`/`hitsMax`/`my` from the base). Either PR alone leaves the other side failing. Both sub-tests stay under `shape-extra-hits-my` (PR-14's entry) because the RoomObject leak is the dominant blocker; PR-13 contributes the missing getters.
- **Fix:**
  1. `structure.ts`: wrap the base Structure shape in `struct(objectFormat, { '#noAttackNotify': 'bool' })` — negated so the zero-default matches vanilla's "notifications on" default. Add `notifyWhenAttacked(enabled)` method + `checkNotifyWhenAttacked` helper on Structure, mirroring `@screeps/engine/src/game/structures.js:89` — reject if `my === false` or the room controller has an owner who isn't the caller, then validate boolean arg. `mods/structure/processor.ts` registers the intent processor on `Structure` to persist `!enabled`, matching the `setPublic` pattern at `mods/defense/processor.ts:83`. A TODO at the write site flags the missing consumer — damage processors need to read `'#noAttackNotify'` to actually emit attack notifications, which is out of scope for this surface-only PR.
  2. `defense/wall.ts`: add `@enumerable get ticksToLive()` returning `undefined` for persistent walls. Mirrors `@screeps/engine/src/game/structures.js:840`; NPC-spawned temporary walls are not modeled.
  3. `structure/ruin.ts`: add top-level `@enumerable get structureType()` delegating to `this['#structure'].type`. The inner `structure` sub-object already exposed it via `defineProperty`, but vanilla's canonical shape puts `structureType` on the ruin itself.
  4. `logistics/storage.ts`: add `@deprecated @enumerable get storeCapacity()` returning `this.store.getCapacity()`. Mirrors the `@deprecated energy`/`energyCapacity` pair on `StructureLab` at `mods/chemistry/lab.ts:36-38`.
- **Blast radius:** Surface additions + one schema field (`'bool'`, 1 byte per structure; negated so zero-default matches the common case). No behavior change. Full parity confirmed clean — 6 unexpected passes, 0 new regressions.

### PR-14: Object/Room/Game runtime shape — split and submitted as #133 + #134
- **Closes (3 entries / 11+ tests):** `shape-extra-hits-my` family (SHAPE-SOURCE/MINERAL/SITE/RESOURCE/TOMBSTONE/RUIN/STRUCT-001 + SHAPE-FLAG-001) via #134; `shape-room-missing-survivalInfo` (SHAPE-ROOM-001) + `shape-game-surface-mismatch` (SHAPE-GAME-001) via #133. `SHAPE-STRUCT-001:constructedWall` and `SHAPE-RUIN-001` flip jointly with PR-13 (#132).
- **PR-14a (#133) — Game/Room surface additions:**
  - `game/game.ts`: `Game.cpuLimit` getter derived from `this.cpu.limit`.
  - `mods/power/game.ts`: `Game.powerCreeps = {}` with `@deprecated` marker.
  - `game/room/room.ts`: `get survivalInfo() { return null; }`.
  - Scope trimmed: Flag-id restructure deferred (maintainer feedback — flag id should stay narrow to Flag, not a base-schema change).
- **PR-14b (#134) — RoomObject base cleanup:**
  - Delete base `hits`/`hitsMax`/`my` getters + `hits` setter from `game/object.ts`.
  - Narrow `#applyDamage` receiver via `this: RoomObject & { hits: number; '#destroy'(): unknown }` — type-level parallel to the existing `this:` patterns in `game/room/room.ts` (`#initialize`, `#flushObjects`, `find`). Base genuinely has no `hits` after this, at type level and runtime.
  - Add `hasHits(object)` type guard (parallel to `hasSpawn`) for four call sites that previously narrowed via `object.hits === undefined`.
  - Drop now-redundant `override` on `hits`/`hitsMax`/`my` in `Creep`, `Structure`, `ConstructionSite`, `OwnedStructure`.
  - Narrow `FIND_MY_STRUCTURES`/`FIND_HOSTILE_STRUCTURES` and `checkMyStructure` via `instanceof OwnedStructure` instead of reading `my` through the base leak.
- **Flag `id: never` (deferred):** Option A (schema-layout split) was shelved after breaking ConstructionSite on 2026-04-21 (`docs/xxscreeps-flag-id-plan.md`). Not pursued further pending maintainer direction — `SHAPE-FLAG-001` remains open until a follow-up.

### PR-15: Memory mod (`mods/memory/{memory.ts,driver.ts,model.ts,game.ts}`)
- **Closes (3 entries / 6 tests):** `rawmemory-set-no-eager-limit-check` (MEMORY-004), `rawmemory-set-invalidates-parsed-memhack` (MEMORY-002), `foreign-segment-not-supported` (RAWMEMORY-FOREIGN-002/003/004).

- **Self-contained fixes** — no new storage, can split off as a mini-PR if foreign-segment scope is too wide:
  1. `memory.ts:82-89` `RawMemory.set`: add `if (value.length > kMaxMemoryLength) throw new Error(...)` before `string = value`. Closes MEMORY-004.
  2. `memory.ts:86`: only clear `_parsed`/`json` when `!accessedJson`. Preserves memhack identity when user already accessed `Memory` this tick. Closes MEMORY-002.

- **Foreign/public segments — vanilla storage split (via `@screeps/driver/lib/runtime/{runtime,make,data}.js`):**

  | State | Vanilla | Shard scope | Persistent? |
  |---|---|---|---|
  | `defaultPublicSegment` | Mongo `users` doc field (`make.js:203-204`) | cross-shard | yes |
  | `activeForeignSegment` `{username, user_id, id}` | Mongo `users` doc field (`make.js:216-247`) | cross-shard | yes |
  | `publicSegments` | `env.set(PUBLIC_MEMORY_SEGMENTS+userId, ids.join(','))` (`make.js:250`) | **per-shard** (env is per-shard) | yes (Redis AOF/RDB) |
  | segment blobs | `env.hmget(MEMORY_SEGMENTS+userId, ids)` (`data.js:229`) | per-shard | yes |

  Per-shard `publicSegments` is load-bearing: each shard has its own env, and vanilla's foreign-read authorization (`data.js:254`) reads the current-shard env only. Blob storage is per-shard too, so "segment N is public" only makes sense relative to the shard that holds segment N.

- **xxscreeps storage mapping — reuses existing primitives, no new abstractions:**

  xxscreeps tiers: `db.data` (cross-shard persistent, hosts `user/${userId}` hash → `engine/db/user/index.ts:6`), `shard.data` (per-shard persistent, hosts segment blobs → `mods/memory/model.ts:23-36`), `shard.scratch` (per-shard **ephemeral** per `config/config.ts:218` — wrong home for this).

  | Vanilla | xxscreeps | Reused pattern |
  |---|---|---|
  | `users.defaultPublicSegment` | `db.data.hset(User.infoKey(userId), 'defaultPublicSegment', id)` (`hdel` on null) | `engine/db/user/badge.ts:47` |
  | `users.activeForeignSegment` | `db.data.hset(User.infoKey(userId), 'activeForeignSegment', JSON.stringify({username, user_id, id}))` | Same |
  | `env.PUBLIC_MEMORY_SEGMENTS+userId` string | `shard.data` set at `user/${userId}/publicSegments` via `sadd`/`srem`/`sismember` | `KeyValProvider` set ops already used by `shard.scratch` for `user/${id}/{intentRooms,visibleRooms,...}` (`mods/cli/cli.ts:794-801`); moved to `shard.data` for persistence parity |
  | Segment blob fetch | `loadMemorySegmentBlob(shard, userId, id)` — unchanged | `model.ts:23` |
  | `username → user_id` | `User.findUserByName(db, username)` — unchanged | `engine/db/user/index.ts:68` |
  | Flush pattern | mirror `flushActiveSegments`/`flushForeignSegment` (`memory.ts:247,259`) | Same module |

  `sismember` is O(1) — strict improvement over vanilla's comma-string parse at `data.js:254`, at zero design cost because the primitive is already in the provider interface (`storage/provider.ts:65`).

- **Plan (in order):**
  1. Self-contained fixes (items 1-2 above).
  2. `model.ts` helpers — no new files, just add:
     - `saveDefaultPublicSegment(db, userId, id | null)` → `hset`/`hdel`
     - `loadActiveForeignSegment(db, userId)` / `saveActiveForeignSegment(db, userId, req | null)` → `hget`/`hset`/`hdel`
     - `savePublicSegments(shard, userId, ids)` → `del` then `sadd` (rewrite-each-call semantics)
     - `isPublicSegment(shard, userId, id)` → `sismember`
  3. `memory.ts`: replace the two stubs with module-local capture (mirror `activeSegments`/`requestedForeignSegment`); add `flushDefaultPublicSegment()` + `flushPublicSegments()`. Declare `RawMemory.foreignSegment` shape; add a `loadForeignSegment(payload)` runtime hook.
  4. `game.ts:54`: extend `save` hook to also emit `defaultPublicSegmentUpdate` and `publicSegmentsUpdate`. Declare the new fields on `TickResult` in `driver.ts:16-24`; add `foreignSegment` to `TickPayload`.
  5. `driver.ts save()`: persist the three fields via the model helpers. Mirror vanilla's resolution logic (`make.js:216-247`): if prior `activeForeignSegment.username` matches and the new request carries an explicit `id`, just update `id`; else `findUserByName` → fill `user_id`, then if no `id` supplied fall back to target's `defaultPublicSegment` via `hget`.
  6. `driver.ts refresh()`: replace the `// TODO`. Read stored `activeForeignSegment`; if `user_id && id && isPublicSegment(shard, user_id, id)`, `loadMemorySegmentBlob(shard, user_id, id)` and set `payload.foreignSegment = { username, id, data }`. Gate blob load on `sismember` rather than fetching first and filtering — strict improvement over vanilla.

- **Vanilla alignment check:**
  - Cross-shard: `defaultPublicSegment`, `activeForeignSegment` — ✓ `db.data` user hash is cross-shard.
  - Per-shard: `publicSegments`, segment blobs — ✓ `shard.data` is per-shard.
  - Persistence: all four slots — ✓ both `db.data` and `shard.data` are persistent tiers.
  - Resolution timing: username→user_id + defaultPublicSegment fallback happens at save, not refresh — ✓ mirror of `make.js:233-244`.

- **Blast radius:** memory mod only; no engine/processor touches. If upstream prefers smaller surface, ship items 1-2 as PR-15a and the foreign-segment work as PR-15b — the self-contained fixes are independent.

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
| Spawn | PR-6 | 4 (PR-6a closes 3; PR-6b closes 1) |
| Creep death | PR-7 | 3 |
| Combat | PR-8 | 3 |
| Hits→destroy | PR-9 | 2 (#145; ruin-spill deferred) |
| Creep client API | PR-10 | 5 (PR-10a closes 2; PR-10b closes 2; 1 open) |
| PathFinder/Map | PR-11 | 2 |
| Boost energy | PR-12 | 1 |
| Structure API surface | PR-13 | 6 tests (+2 joint with PR-14) |
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
13. ~~**PR-13**~~ submitted as #132 — notifyWhenAttacked + wall ticksToLive + ruin structureType + storage storeCapacity (flips 6 tests alone, 2 more jointly with PR-14)
14. ~~**PR-15**~~ submitted as #131 — RawMemory.set guards + foreign/public memory segments
15. ~~**PR-14**~~ split + submitted as #133 (Game/Room surface) + #134 (RoomObject base cleanup)
16. ~~**PR-7**~~ submitted + merged as #136 — body energy reclaim + container diversion on death
17. ~~**PR-10a**~~ submitted as #152 — Creep.transfer→upgradeController redirect + pull-spawning guard
18. ~~**PR-10b**~~ submitted as #153 — Creep.withdraw enemy-rampart guard + moveTo noPathFinding return code
19. ~~**PR-6a**~~ submitted as #135 — renewCreep busy/boost guards + spawnCreep check order
20. ~~**PR-6b**~~ submitted as #154 — Spawn.recycleCreep body-energy reclaim
21. Remaining work (PR-8 combat damage, PR-9 residual ruin-spill, PR-10c body-part-shape) in any order based on capacity

## Adapter changes (do these first)

Before any xxscreeps PR, land **AD-1** and **AD-2** in this repo. They:
- Close 5 gaps without engine changes
- Reduce noise in the parity baseline so xxscreeps PR test runs are cleaner
- Are independent of xxscreeps merge timing
