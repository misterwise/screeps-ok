# screeps-ok Behavioral Catalog

A comprehensive enumeration of every testable Screeps gameplay behavior,
organized by game system and facet. Each checkbox maps 1:1 to a conformance
test.

**How to read this document:**
- **Area** = major game system (top-level heading)
- **Facet** = specific mechanic within that system (sub-heading)
- `- [ ]` = untested, `- [x]` = tested
- Facets marked with a capability tag require that adapter capability

**How to give feedback:**
- "You're missing X" — which area/facet should it live in?
- "X and Y overlap" — which facet should own it?
- "X is engine-specific, not behavioral" — should it be dropped or tagged?

---

## 1. Movement

### 1.1 Basic Movement
- [ ] `move()` to an adjacent tile in a valid direction returns OK.
- [ ] `move()` with no MOVE body parts returns ERR_NO_BODYPART.
- [ ] `move()` while fatigue > 0 returns ERR_TIRED.
- [ ] `move()` into a wall tile returns OK but the creep does not move.
- [ ] `move()` into an occupied tile returns OK but the creep may not move (collision).
- [ ] `move()` accepts all 8 direction constants (TOP through TOP_LEFT).
- [ ] `moveByPath()` follows a serialized path one step per tick.
- [ ] `moveTo()` computes a path to the target and moves one step toward it.
- [ ] `moveTo()` returns OK when the creep successfully moves.
- [ ] `moveTo()` returns ERR_NO_PATH when no path to the target exists.
- [ ] `moveTo()` returns ERR_TIRED when the creep has fatigue > 0.
- [ ] `moveTo()` returns ERR_NO_BODYPART when the creep has no MOVE parts.

### 1.2 Fatigue Calculation
- [ ] Each non-MOVE body part contributes to movement weight.
- [ ] Empty CARRY parts contribute zero fatigue.
- [ ] Full or partially full CARRY parts contribute to fatigue like other non-MOVE parts.
- [ ] Moving onto plains generates fatigue equal to 2 per weighted body part.
- [ ] Moving onto swamp generates fatigue equal to 10 per weighted body part.
- [ ] Moving onto a road generates fatigue equal to 1 per weighted body part.
- [ ] Each undamaged MOVE part reduces fatigue by 2 at the start of each tick.
- [ ] Boosted MOVE parts reduce fatigue proportionally to the boost multiplier.
- [ ] Damaged (0 HP) MOVE parts do not contribute to fatigue reduction.
- [ ] A creep with fatigue > 0 cannot move and `move()` returns ERR_TIRED.
- [ ] A creep with only MOVE parts generates 0 fatigue on any terrain.
- [ ] Fatigue is applied after movement completes, based on destination terrain.

### 1.3 Roads
- [ ] A road on plains reduces the fatigue multiplier to 1.
- [ ] A road on swamp reduces the fatigue multiplier to 1.
- [ ] Creep movement on a road wears the road by ROAD_WEAROUT (1) per body part.
- [ ] Power creep movement on a road wears it by ROAD_WEAROUT_POWER_CREEP (100).
- [ ] Swamp roads have 5x the construction cost of plains roads.

### 1.4 Room Transitions
- [ ] Moving onto an exit tile teleports the creep to the adjacent room in the same tick.
- [ ] The creep appears at the opposite edge of the destination room.
- [ ] Fatigue resets to 0 when a creep moves onto an exit tile.
- [ ] `creep.room` returns the previous room object for one tick after crossing.
- [ ] Room adjacency follows the standard Screeps coordinate system.
- [ ] A creep being pulled can be pulled across a room border.

### 1.5 Pulling
- [ ] `pull()` on an adjacent creep returns OK.
- [ ] The pulled creep must call `move()` toward the puller to complete the pull.
- [ ] The pulling creep accumulates fatigue for both itself and the pulled creep.
- [ ] Pull can chain through multiple creeps in a train.
- [ ] `pull()` on a non-adjacent creep returns ERR_NOT_IN_RANGE.

### 1.6 Collision Resolution
- [ ] When multiple creeps target the same tile, the highest-priority creep wins.
- [ ] Priority factor: creeps that would block other creeps rank higher.
- [ ] Priority factor: pulled creeps rank higher than non-pulled.
- [ ] Priority factor: pulling creeps rank higher than non-pulling.
- [ ] Priority factor: higher MOVE-to-weight ratio ranks higher.
- [ ] Two creeps moving toward each other can swap positions simultaneously.
- [ ] Creeps that lose collision stay in place without an error code.

### 1.7 Power Creep Movement
- [ ] Power creeps generate no fatigue on any terrain.
- [ ] Power creep movement wears roads at ROAD_WEAROUT_POWER_CREEP rate.
- [ ] Power creeps lose all movement collision priority ties.

---

## 2. Pathfinding

### 2.1 PathFinder.search
- [ ] Accepts a single goal position with range.
- [ ] Accepts multiple goal positions, finding the closest.
- [ ] `plainCost` option overrides the default cost of plains tiles.
- [ ] `swampCost` option overrides the default cost of swamp tiles.
- [ ] `maxOps` option limits the number of pathfinding operations.
- [ ] `maxRooms` option limits the number of rooms searched.
- [ ] `flee` mode finds a path away from the goal positions.
- [ ] Returns `{ path, ops, cost, incomplete }`.
- [ ] Returns `incomplete: true` with a partial path when no full path exists.
- [ ] `roomCallback` option provides a CostMatrix per room during search.

### 2.2 CostMatrix
- [ ] `new CostMatrix()` creates a matrix with all values 0.
- [ ] `set(x, y, cost)` assigns a cost to a tile.
- [ ] `get(x, y)` returns the assigned cost.
- [ ] Cost 0 means use the default terrain cost.
- [ ] Cost 255 means the tile is unwalkable.
- [ ] `clone()`, `serialize()`, and `CostMatrix.deserialize()` round-trip correctly.

### 2.3 RoomPosition Pathfinding
- [ ] `findClosestByPath()` returns the closest reachable target using pathfinding.
- [ ] `findClosestByRange()` returns the closest target by linear distance.
- [ ] `findInRange()` returns all targets within the specified range.
- [ ] `findPathTo()` returns a path to the target.
- [ ] `getDirectionTo()` returns the direction constant (1–8) toward a target.
- [ ] Filter option narrows results for all find methods.

### 2.4 Legacy Pathfinding
- [ ] `Room.findPath()` finds a path between two positions within a room.
- [ ] `Room.serializePath()` and `Room.deserializePath()` round-trip a path.
- [ ] `PathFinder.use()` toggles between new PathFinder and legacy mode.

---

## 3. Harvesting

### 3.1 Source Harvest
- [ ] Each WORK part harvests 2 energy per tick from a source.
- [ ] `harvest()` requires the creep to be adjacent to the source (range 1).
- [ ] `harvest()` returns OK on success.
- [ ] `harvest()` returns ERR_NOT_IN_RANGE when too far.
- [ ] `harvest()` returns ERR_NO_BODYPART when the creep has no WORK parts.
- [ ] `harvest()` returns ERR_NOT_ENOUGH_RESOURCES when the source has 0 energy.
- [ ] Harvested energy is deposited into the creep's store.
- [ ] Harvesting requires free CARRY capacity to store the energy.
- [ ] Harvest boost (UO) increases yield by +200% per boosted WORK part.
- [ ] Source energy capacity is 3000 in owned/reserved rooms, 1500 in neutral, 4000 in keeper rooms.

### 3.2 Mineral Harvest
- [ ] Mineral harvesting requires an extractor structure in the room.
- [ ] Each WORK part harvests mineral resources per tick.
- [ ] `harvest()` returns ERR_NOT_FOUND when no extractor is present.
- [ ] Extractor goes on cooldown (EXTRACTOR_COOLDOWN) after each harvest.
- [ ] The mineral type of the deposit determines the resource harvested.
- [ ] Mineral depletion (mineralAmount reaches 0) triggers a regeneration timer.
- [ ] `harvest()` returns ERR_NOT_ENOUGH_RESOURCES when the mineral is depleted.

### 3.3 Deposit Harvest `capability: deposit`
- [ ] Harvesting a deposit increases its cooldown exponentially (DEPOSIT_EXHAUST_MULTIPLY, DEPOSIT_EXHAUST_POW).
- [ ] Deposit types are silicon, metal, biomass, and mist.
- [ ] The decay timer is set on first harvest (DEPOSIT_DECAY_TIME).
- [ ] `lastCooldown` tracks the most recent cooldown value.
- [ ] The deposit disappears when the decay timer expires.

---

## 4. Resource Transfer

### 4.1 Transfer
- [ ] `transfer()` moves resources from creep to adjacent structure or creep.
- [ ] A specific resource type must be specified.
- [ ] An optional amount allows partial transfers.
- [ ] `transfer()` returns ERR_NOT_IN_RANGE when target is not adjacent.
- [ ] `transfer()` returns ERR_NOT_ENOUGH_RESOURCES when creep lacks the resource.
- [ ] `transfer()` returns ERR_FULL when target store has no free capacity.
- [ ] `transfer()` returns ERR_INVALID_TARGET for invalid targets.
- [ ] Lab transfer validates that the resource matches the lab's allowed types.

### 4.2 Withdraw
- [ ] `withdraw()` moves resources from adjacent structure to creep.
- [ ] A specific resource type and optional amount can be specified.
- [ ] `withdraw()` returns ERR_NOT_OWNER for hostile structures without a public rampart.
- [ ] `withdraw()` works on tombstones and ruins.
- [ ] `withdraw()` returns ERR_NOT_IN_RANGE when target is not adjacent.
- [ ] `withdraw()` returns ERR_NOT_ENOUGH_RESOURCES when the structure lacks the resource.
- [ ] `withdraw()` returns ERR_FULL when the creep has no free capacity.
- [ ] Terminal withdraw is blocked by PWR_DISRUPT_TERMINAL effect.

### 4.3 Pickup
- [ ] `pickup()` picks up a dropped resource at range 1.
- [ ] The full amount is picked up, limited by the creep's free capacity.
- [ ] `pickup()` returns ERR_NOT_IN_RANGE when the resource is not adjacent.
- [ ] `pickup()` returns ERR_FULL when the creep has no free capacity.

### 4.4 Drop
- [ ] `drop()` creates a dropped resource at the creep's position.
- [ ] A specific resource type and optional amount can be specified.
- [ ] Dropping onto a tile with an existing dropped resource of the same type adds to it.
- [ ] `drop()` returns ERR_NOT_ENOUGH_RESOURCES when the creep lacks the resource.

### 4.5 Dropped Resources
- [ ] Dropped energy decays at a rate of 1 unit per 1000 ticks.
- [ ] Dropped resources are created when a creep dies with store contents.
- [ ] Dropped resources are created when a creep overflows its carry capacity.
- [ ] Any player's creep can pick up any dropped resource.
- [ ] A dropped resource disappears when its amount reaches 0.

---

## 5. Construction & Repair

### 5.1 Build
- [ ] Each WORK part contributes 5 progress per tick to a construction site.
- [ ] Building costs 1 energy per progress point.
- [ ] `build()` has a range of 3.
- [ ] `build()` returns OK on success.
- [ ] `build()` returns ERR_NOT_IN_RANGE when too far.
- [ ] `build()` returns ERR_NO_BODYPART when the creep has no WORK parts.
- [ ] `build()` returns ERR_NOT_ENOUGH_RESOURCES when the creep has no energy.
- [ ] When a site reaches progressTotal, the structure is created.
- [ ] Build boost (LH/LH2O/XLH2O) increases effectiveness without extra energy cost.
- [ ] A creep can build an allied player's construction site.

### 5.2 Repair
- [ ] Each WORK part repairs 100 hits per tick.
- [ ] Repairing costs 1 energy per 100 hits repaired.
- [ ] `repair()` has a range of 3.
- [ ] `repair()` cannot repair above the structure's hitsMax.
- [ ] `repair()` returns ERR_NOT_IN_RANGE when too far.
- [ ] `repair()` returns ERR_NO_BODYPART when the creep has no WORK parts.
- [ ] Repair boost (LH/LH2O/XLH2O) increases effectiveness without extra energy cost.
- [ ] A creep can repair any player's structure.

### 5.3 Dismantle
- [ ] Each WORK part dismantles 50 hits per tick from a structure.
- [ ] Dismantling returns 0.25 energy per hit to the creep's store.
- [ ] `dismantle()` has a range of 1 (adjacent only).
- [ ] `dismantle()` bypasses rampart protection — it damages the target structure directly.
- [ ] Dismantle boost (ZH/ZH2O/XZH2O) increases effectiveness.
- [ ] `dismantle()` is blocked in safe mode rooms against hostile structures.
- [ ] `dismantle()` returns ERR_NO_BODYPART when the creep has no WORK parts.

### 5.4 Construction Sites
- [ ] `createConstructionSite()` places a new site at a position.
- [ ] MAX_CONSTRUCTION_SITES (100) is enforced as a global limit per player.
- [ ] Construction site type must be valid for the room's RCL.
- [ ] A hostile creep moving onto a construction site destroys it instantly.
- [ ] Exception: a site placed under an already-standing hostile creep survives.
- [ ] `ConstructionSite.remove()` removes the site by the owner.
- [ ] Only one construction site can exist at a given position.
- [ ] Cannot place a construction site on a wall terrain tile (except roads).

---

## 6. Controller

### 6.1 Claim Controller
- [ ] `claimController()` requires at least one CLAIM body part.
- [ ] The controller must be unowned (level 0) and not reserved by a hostile player.
- [ ] Range is 1 (adjacent).
- [ ] GCL room cap is checked — returns ERR_GCL_NOT_ENOUGH if exceeded.
- [ ] On success, the controller is set to level 1 with the claiming player as owner.
- [ ] Returns ERR_INVALID_TARGET if the controller is already owned.

### 6.2 Reserve Controller
- [ ] `reserveController()` requires at least one CLAIM body part.
- [ ] The controller must be unowned (level 0).
- [ ] Range is 1 (adjacent).
- [ ] Adds 1 tick per CLAIM part per tick to the reservation timer.
- [ ] Reservation is capped at CONTROLLER_RESERVE_MAX (5000 ticks).

### 6.3 Attack Controller
- [ ] `attackController()` requires at least one CLAIM body part.
- [ ] Reduces the downgrade timer by CONTROLLER_CLAIM_DOWNGRADE (300) per CLAIM part.
- [ ] Sets upgradeBlocked for CONTROLLER_ATTACK_BLOCKED_UPGRADE (1000) ticks.
- [ ] Range is 1 (adjacent).
- [ ] Cannot attack the player's own controller.

### 6.4 Upgrade Controller
- [ ] Each WORK part contributes 1 progress per tick.
- [ ] Upgrading costs 1 energy per progress point.
- [ ] `upgradeController()` has a range of 3.
- [ ] At RCL 8, upgrade is capped at CONTROLLER_MAX_UPGRADE_PER_TICK (15).
- [ ] Upgrade boost (GH/GH2O/XGH2O) increases effectiveness without extra energy cost.
- [ ] Progress thresholds per level: 200, 45K, 135K, 405K, 1.215M, 3.645M, 10.935M.
- [ ] GCL progress is incremented alongside controller progress.
- [ ] `upgradeController()` returns ERR_BUSY when upgradeBlocked is active.
- [ ] `upgradeController()` is blocked for CONTROLLER_NUKE_BLOCKED_UPGRADE (200) ticks after a nuke lands.
- [ ] Returns ERR_NOT_ENOUGH_RESOURCES when the creep has no energy.

### 6.5 Sign Controller
- [ ] `signController()` stores text on the controller.
- [ ] Range is 1 (adjacent).
- [ ] Any player can sign any controller (including hostile).

### 6.6 Generate Safe Mode
- [ ] `generateSafeMode()` requires 1000 ghodium (SAFE_MODE_COST) in the creep's store.
- [ ] Range is 1 (adjacent).
- [ ] On success, increments the controller's safeModeAvailable count.
- [ ] Returns ERR_NOT_ENOUGH_RESOURCES when the creep lacks ghodium.

### 6.7 Downgrade & Level Loss
- [ ] Each RCL has a downgrade timer: 1→20K, 2→10K, 3→20K, 4→40K, 5→80K, 6→120K, 7→150K, 8→200K.
- [ ] The timer decrements by 1 each tick the controller is not upgraded.
- [ ] The controller loses a level when the timer reaches 0.
- [ ] Each upgrade tick restores CONTROLLER_DOWNGRADE_RESTORE (100) ticks to the timer.
- [ ] Level loss resets progress to 0.
- [ ] Structures above the new RCL limit become inactive (isActive() returns false).
- [ ] The controller can downgrade through multiple levels if neglected.
- [ ] An owned controller at level 1 that loses its level becomes unowned.

### 6.8 Safe Mode Mechanics
- [ ] `activateSafeMode()` starts safe mode for SAFE_MODE_DURATION (20000) ticks.
- [ ] Safe mode has a cooldown of SAFE_MODE_COOLDOWN (50000) ticks.
- [ ] Cannot activate when downgrade timer is below CONTROLLER_DOWNGRADE_SAFEMODE_THRESHOLD (5000).
- [ ] Activation consumes one safeModeAvailable charge.
- [ ] Hostile creeps cannot attack structures or creeps during safe mode.
- [ ] Hostile creep movement is restricted near the owner's creeps during safe mode.
- [ ] `activateSafeMode()` returns ERR_NOT_ENOUGH_RESOURCES when safeModeAvailable is 0.
- [ ] `activateSafeMode()` returns ERR_TIRED when cooldown is active.

### 6.9 Unclaim
- [ ] `unclaim()` resets the controller to level 0 (unowned).
- [ ] All owned structures in the room are destroyed.
- [ ] Destroyed structures become ruins.

### 6.10 Structure Limits per RCL
- [ ] Each structure type has a maximum count per RCL level.
- [ ] Structures above the limit for the current RCL become inactive.
- [ ] Container (5), road (2500), wall (2500), rampart (2500) limits are constant across all RCL levels.

---

## 7. Combat

### 7.1 Melee Attack
- [ ] Each ATTACK part deals 30 damage per tick.
- [ ] `attack()` has a range of 1 (adjacent).
- [ ] Attacking a structure under a rampart hits the rampart instead.
- [ ] ATTACK parts automatically deal counter-damage back to melee attackers.
- [ ] `attack()` returns ERR_NOT_IN_RANGE when target is not adjacent.
- [ ] `attack()` returns ERR_NO_BODYPART when the creep has no ATTACK parts.
- [ ] Can target creeps, power creeps, and structures.
- [ ] Attack boost (UH/UH2O/XUH2O) increases damage per boosted ATTACK part.

### 7.2 Ranged Attack
- [ ] Each RANGED_ATTACK part deals 10 damage per tick.
- [ ] `rangedAttack()` has a range of 1–3.
- [ ] `rangedAttack()` returns ERR_NOT_IN_RANGE when target is beyond range 3.
- [ ] `rangedAttack()` returns ERR_NO_BODYPART when the creep has no RANGED_ATTACK parts.
- [ ] Can target creeps, power creeps, and structures.
- [ ] Ranged attack boost (KO/KHO2/XKHO2) increases damage per boosted RANGED_ATTACK part.

### 7.3 Ranged Mass Attack
- [ ] Damages all hostile objects within range 3.
- [ ] Damage at range 1 is 100% of base per RANGED_ATTACK part.
- [ ] Damage at range 2 is 40% of base per RANGED_ATTACK part.
- [ ] Damage at range 3 is 10% of base per RANGED_ATTACK part.
- [ ] Does not damage the player's own creeps or unowned structures.

### 7.4 Heal
- [ ] Each HEAL part restores 12 HP per tick at range 1.
- [ ] `heal()` has a range of 1 (adjacent).
- [ ] Can target own and allied creeps and power creeps.
- [ ] Heal boost (LO/LHO2/XLHO2) increases healing per boosted HEAL part.
- [ ] Healing a creep already at full HP returns OK but has no effect.

### 7.5 Ranged Heal
- [ ] Each HEAL part restores 4 HP per tick at range 1–3.
- [ ] `rangedHeal()` has a range of 1–3.
- [ ] Same boost multipliers apply as melee heal.
- [ ] A creep can `rangedHeal()` and `rangedAttack()` in the same tick.

### 7.6 Body Part Damage Model
- [ ] Damage is applied front-to-back (body[0] takes hits first).
- [ ] Each body part has 100 HP.
- [ ] A part at 0 HP is destroyed and loses its function.
- [ ] The body is recalculated after damage (active part counts update).
- [ ] Destroyed MOVE parts reduce the creep's fatigue recovery rate.
- [ ] Destroyed WORK/CARRY/ATTACK/etc. parts reduce their respective effectiveness.
- [ ] `hitsMax` equals body length multiplied by 100.
- [ ] `getActiveBodyparts(type)` returns only undestroyed parts of that type.

### 7.7 Boost Damage Reduction
- [ ] Boosted TOUGH parts reduce incoming damage to themselves only.
- [ ] GO (T1) reduces damage by 30%.
- [ ] GHO2 (T2) reduces damage by 50%.
- [ ] XGHO2 (T3) reduces damage by 70%.
- [ ] Effective HP per T3 boosted TOUGH part is approximately 333.

### 7.8 Simultaneous Damage & Healing
- [ ] Damage and healing are resolved simultaneously: `newHits = oldHits + healing - damage`.
- [ ] A creep survives if healing equals or exceeds damage in the same tick.
- [ ] Overkill damage does not carry over to the next tick.
- [ ] A creep dies only if hits reach 0 after simultaneous resolution.
- [ ] Multiple sources of damage and healing are summed independently.

### 7.9 Tower Attack
- [ ] Tower attack costs TOWER_ENERGY_COST (10) energy per action.
- [ ] Base damage is TOWER_POWER_ATTACK (600) at optimal range.
- [ ] Full power within TOWER_OPTIMAL_RANGE (5 tiles).
- [ ] Linear falloff from range 5 to TOWER_FALLOFF_RANGE (20 tiles).
- [ ] Minimum damage at range 20+ is 150.

### 7.10 Tower Heal
- [ ] Base healing is TOWER_POWER_HEAL (400) at optimal range.
- [ ] Same distance falloff curve as tower attack.
- [ ] Minimum healing at range 20+ is 100.
- [ ] Can heal any friendly creep.

### 7.11 Tower Repair
- [ ] Base repair is TOWER_POWER_REPAIR (800) at optimal range.
- [ ] Same distance falloff curve as tower attack.
- [ ] Minimum repair at range 20+ is 200.
- [ ] Can repair any structure regardless of owner.

### 7.12 Tower Action Priority
- [ ] A tower can perform only one action per tick.
- [ ] If multiple intents are submitted, priority is: heal > repair > attack.
- [ ] The highest-priority intent executes; others are discarded.

### 7.13 Tower Power Effects
- [ ] PWR_OPERATE_TOWER increases tower power by a percentage based on power level.
- [ ] PWR_DISRUPT_TOWER reduces tower power by a percentage based on power level.
- [ ] Operate and disrupt effects can stack on the same tower.

### 7.14 Nukes — Launch `capability: nuke`
- [ ] Launching requires NUKER_ENERGY_CAPACITY (300000) energy and NUKER_GHODIUM_CAPACITY (5000) ghodium.
- [ ] Nuker cooldown is NUKER_COOLDOWN (100000 ticks).
- [ ] Maximum range is NUKE_RANGE (10 rooms).
- [ ] Creates an in-flight Nuke object visible in the target room.
- [ ] Returns appropriate error codes for insufficient resources, cooldown, or range.

### 7.15 Nukes — Impact `capability: nuke`
- [ ] Nuke lands after NUKE_LAND_TIME (50000 ticks).
- [ ] Damage at ground zero is 10,000,000.
- [ ] Damage in radius 0–2 is 5,000,000.
- [ ] Ramparts absorb nuke damage for structures underneath.
- [ ] Ramparts do not protect creeps from nuke damage.
- [ ] All creeps, dropped resources, construction sites, tombstones, and ruins in the blast area are destroyed.
- [ ] Nukes do not create tombstones or ruins from what they destroy.

### 7.16 Safe Mode — Combat Effects
- [ ] Hostile creeps cannot `attack()` in a safe mode room.
- [ ] Hostile creeps cannot `rangedAttack()` or `rangedMassAttack()` in a safe mode room.
- [ ] Hostile creeps cannot `dismantle()` in a safe mode room.
- [ ] Towers can still operate during safe mode.
- [ ] Construction sites are protected from hostile stomping during safe mode.

---

## 8. Boosts `capability: chemistry`

### 8.1 Boost Application
- [ ] `Lab.boostCreep()` boosts an adjacent creep.
- [ ] Costs LAB_BOOST_MINERAL (30) compound + LAB_BOOST_ENERGY (20) energy per part boosted.
- [ ] `bodyPartsCount` parameter allows partial boosting.
- [ ] The lab must contain the correct compound for the target body part type.
- [ ] Only unboosted parts of the matching type are boosted.
- [ ] Returns ERR_NOT_IN_RANGE when creep is not adjacent.
- [ ] Returns ERR_NOT_ENOUGH_RESOURCES when lab lacks compound or energy.

### 8.2 Unboost
- [ ] `Lab.unboostCreep()` removes boosts from an adjacent creep.
- [ ] Returns compounds to the lab (LAB_UNBOOST_MINERAL = 15 per part).
- [ ] Cooldown is proportional to the total compounds removed.
- [ ] Returns ERR_NOT_IN_RANGE when creep is not adjacent.
- [ ] Returns ERR_FULL when lab cannot hold the returned compounds.

### 8.3 Attack Boosts
- [ ] UH boosts ATTACK parts by +100% damage.
- [ ] UH2O boosts ATTACK parts by +200% damage.
- [ ] XUH2O boosts ATTACK parts by +300% damage.
- [ ] Boost is applied per individual boosted ATTACK body part.

### 8.4 Ranged Boosts
- [ ] KO boosts RANGED_ATTACK parts by +100% damage.
- [ ] KHO2 boosts RANGED_ATTACK parts by +200% damage.
- [ ] XKHO2 boosts RANGED_ATTACK parts by +300% damage.
- [ ] Boost is applied per individual boosted RANGED_ATTACK body part.

### 8.5 Heal Boosts
- [ ] LO boosts HEAL parts by +100% healing.
- [ ] LHO2 boosts HEAL parts by +200% healing.
- [ ] XLHO2 boosts HEAL parts by +300% healing.
- [ ] Boost is applied per individual boosted HEAL body part.

### 8.6 Tough Boosts
- [ ] GO reduces incoming damage to boosted TOUGH parts by 30%.
- [ ] GHO2 reduces incoming damage to boosted TOUGH parts by 50%.
- [ ] XGHO2 reduces incoming damage to boosted TOUGH parts by 70%.
- [ ] Damage reduction applies only to the boosted TOUGH part itself, not the whole creep.

### 8.7 Harvest Boosts
- [ ] UO boosts WORK part harvest yield by +200%.
- [ ] UHO2 boosts WORK part harvest yield by +400%.
- [ ] XUHO2 boosts WORK part harvest yield by +600%.
- [ ] Boost applies only during `harvest()`, not other WORK actions.

### 8.8 Build/Repair Boosts
- [ ] LH boosts WORK part build/repair by +50%.
- [ ] LH2O boosts WORK part build/repair by +80%.
- [ ] XLH2O boosts WORK part build/repair by +100%.
- [ ] Build/repair boosts do not increase energy cost.

### 8.9 Dismantle Boosts
- [ ] ZH boosts WORK part dismantle by +100%.
- [ ] ZH2O boosts WORK part dismantle by +200%.
- [ ] XZH2O boosts WORK part dismantle by +300%.
- [ ] Boost is applied per individual boosted WORK body part during `dismantle()`.

### 8.10 Upgrade Boosts
- [ ] GH boosts WORK part `upgradeController()` by +50%.
- [ ] GH2O boosts WORK part `upgradeController()` by +80%.
- [ ] XGH2O boosts WORK part `upgradeController()` by +100%.
- [ ] Upgrade boosts do not increase energy cost.

### 8.11 Move Boosts
- [ ] ZO increases MOVE part fatigue reduction by +100%.
- [ ] ZHO2 increases MOVE part fatigue reduction by +200%.
- [ ] XZHO2 increases MOVE part fatigue reduction by +300%.
- [ ] Boost is applied per individual boosted MOVE body part.

### 8.12 Carry Boosts
- [ ] KH increases CARRY capacity by +50 per boosted part.
- [ ] KH2O increases CARRY capacity by +100 per boosted part.
- [ ] XKH2O increases CARRY capacity by +150 per boosted part.
- [ ] Boosted CARRY parts still contribute zero fatigue when empty.

---

## 9. Spawning & Creep Lifecycle

### 9.1 spawnCreep
- [ ] Body must contain at least one part.
- [ ] Body cannot exceed MAX_CREEP_SIZE (50) parts.
- [ ] Creep name must be unique among all living and spawning creeps.
- [ ] Energy cost equals the sum of BODYPART_COST for each part.
- [ ] Energy is drawn from spawn and extensions (energyStructures option sets order).
- [ ] Returns ERR_NOT_ENOUGH_ENERGY when insufficient energy is available.
- [ ] Returns ERR_NAME_EXISTS when the name is already taken.
- [ ] Returns ERR_BUSY when the spawn is already spawning.
- [ ] `dryRun` option checks feasibility without actually spawning.
- [ ] `memory` option sets the initial creep memory.

### 9.2 Spawning Duration & Direction
- [ ] Spawning takes CREEP_SPAWN_TIME (3) ticks per body part.
- [ ] The creep appears at the spawn position during spawning (spawning = true).
- [ ] Default exit direction is TOP, then clockwise through available tiles.
- [ ] Custom directions can be set via `opts.directions`.
- [ ] Custom directions are ignored for 1-tick spawns (single body part + Operate Spawn).
- [ ] The creep exits the spawn tile in the chosen direction when spawning completes.

### 9.3 Spawn Stomping
- [ ] When all tiles around a spawn are blocked and a hostile creep occupies one, the spawn kills the hostile creep.
- [ ] The newly spawned creep is placed on the tile where the hostile creep was.
- [ ] The hostile creep is destroyed without normal combat mechanics.

### 9.4 Renew Creep
- [ ] `renewCreep()` extends a creep's TTL on an adjacent creep.
- [ ] TTL increase per tick is `floor(600 / body.length)`.
- [ ] Energy cost is proportional to body size.
- [ ] Renewing removes all boosts from the creep.
- [ ] Creeps with CLAIM body parts cannot be renewed.

### 9.5 Recycle Creep
- [ ] `recycleCreep()` destroys an adjacent creep and returns resources.
- [ ] Resources returned are proportional to remaining TTL and body cost.
- [ ] Both energy and boost compounds are returned.
- [ ] Resources drop as a tombstone (or into a container if one is on the tile).

### 9.6 Creep Spawning State
- [ ] `creep.spawning` is true while the creep is being spawned.
- [ ] `creep.ticksToLive` is undefined during spawning.
- [ ] A spawning creep cannot perform any actions.
- [ ] Body parts are visible during spawning.

### 9.7 Aging & Death
- [ ] ticksToLive decrements by 1 each tick.
- [ ] Normal creep lifetime is CREEP_LIFE_TIME (1500).
- [ ] Creeps with any CLAIM parts have CREEP_CLAIM_LIFE_TIME (600).
- [ ] A creep dies when ticksToLive reaches 0.
- [ ] A tombstone is created at the position of death.
- [ ] Tombstone decay time is TOMBSTONE_DECAY_PER_PART (5) ticks per body part.

### 9.8 Suicide
- [ ] `suicide()` instantly kills the creep.
- [ ] A tombstone is created with the creep's remaining store contents.
- [ ] Returns OK on success.

### 9.9 Say
- [ ] `say()` displays a message visible for one tick.
- [ ] The `public` flag makes the message visible to all players.
- [ ] Without the public flag, only the owner sees the message.

### 9.10 cancelOrder
- [ ] `cancelOrder(methodName)` removes the pending intent for that method.
- [ ] Returns ERR_NOT_FOUND when no intent exists for the given method.

---

## 10. Structures — Energy & Storage

### 10.1 Extension
- [ ] Extension energy capacity is 50 at RCL 1–6, 100 at RCL 7, 200 at RCL 8.
- [ ] `isActive()` returns false when the extension exceeds the RCL structure limit.
- [ ] Extension store accepts only energy.
- [ ] Extensions contribute to `room.energyAvailable` and `room.energyCapacityAvailable`.

### 10.2 Storage
- [ ] Storage capacity is STORAGE_CAPACITY (1,000,000).
- [ ] STORAGE_HITS is 10,000.
- [ ] Storage is available at RCL 4+.
- [ ] PWR_OPERATE_STORAGE increases capacity by a level-based amount.

### 10.3 Container
- [ ] Container capacity is CONTAINER_CAPACITY (2000).
- [ ] Containers accept any resource type.
- [ ] Container decay in unowned rooms: CONTAINER_DECAY (5000 hits) per CONTAINER_DECAY_TIME (100 ticks).
- [ ] Container decay in owned rooms: CONTAINER_DECAY (5000 hits) per CONTAINER_DECAY_TIME_OWNED (500 ticks).
- [ ] Container contents spill as dropped resources when destroyed.
- [ ] Containers are not owned — any player can withdraw.

### 10.4 Link
- [ ] `transferEnergy()` sends energy to a target link.
- [ ] Energy lost in transfer is `ceil(amount * LINK_LOSS_RATIO)` (3%, rounded up).
- [ ] Cooldown after transfer is LINK_COOLDOWN (1) per tile of distance to target.
- [ ] Link capacity is LINK_CAPACITY (800).
- [ ] Both links must be owned by the same player.
- [ ] Sending 1 energy results in 0 received (entirely consumed by the 3% ceiling).

---

## 11. Structures — Production

### 11.1 Lab Reactions `capability: chemistry`
- [ ] `runReaction(lab1, lab2)` combines minerals from two input labs.
- [ ] Input labs must be within range 2 of the reacting lab.
- [ ] Output compound is determined by the input mineral pair.
- [ ] Each reaction produces LAB_REACTION_AMOUNT (5) units (or more with PWR_OPERATE_LAB).
- [ ] Cooldown per reaction varies by compound type (REACTION_TIME).
- [ ] Both input labs must contain the correct minerals.
- [ ] Output is stored in the reacting lab.
- [ ] Returns ERR_NOT_IN_RANGE when input labs are too far.

### 11.2 Lab Reverse Reaction `capability: chemistry`
- [ ] `reverseReaction(lab1, lab2)` splits a compound back into inputs.
- [ ] Same range requirement as runReaction (input labs within range 2).
- [ ] Inputs are deposited into the target labs.

### 11.3 Reaction Chain `capability: chemistry`
- [ ] Base reactions: H+O→OH, Z+K→ZK, U+L→UL, ZK+UL→G.
- [ ] Tier 1: base mineral + H or O → hydride or oxide compound.
- [ ] Tier 2: T1 compound + OH → acid or alkalide compound.
- [ ] Tier 3: T2 compound + X → catalyzed compound.
- [ ] All 30+ compound recipes produce the correct output.

### 11.4 Factory Production `capability: factory`
- [ ] `produce(resourceType)` creates a commodity from input resources.
- [ ] Input resources are validated against the recipe.
- [ ] Level 0 recipes (bars, composites) work without a factory level.
- [ ] Battery production converts 50 energy to 1 battery (reversible).
- [ ] Bar production converts 500 mineral + 200 energy to a bar.
- [ ] Factory cooldown is applied after production (varies by recipe).
- [ ] Factory level is set permanently by PWR_OPERATE_FACTORY.
- [ ] Returns ERR_NOT_ENOUGH_RESOURCES when inputs are insufficient.

### 11.5 Factory Commodity Chains `capability: factory`
- [ ] Level 1–5 commodity chains: electronics, biological, mechanical, mystical.
- [ ] Each chain has 6 tiers of production.
- [ ] A leveled factory can only produce commodities matching its exact level while the power effect is active.
- [ ] Without the power effect, a leveled factory can only produce level 0 commodities.
- [ ] A factory without a level can only produce level 0 commodities.
- [ ] Returns ERR_INVALID_ARGS when attempting to produce a commodity above or below the factory's level.

### 11.6 Power Spawn `capability: powerCreeps`
- [ ] `processPower()` converts power + energy to GPL progress.
- [ ] Energy cost is POWER_SPAWN_ENERGY_RATIO (50) energy per 1 power processed.
- [ ] Power spawn energy capacity is POWER_SPAWN_ENERGY_CAPACITY (5000).
- [ ] Power spawn power capacity is POWER_SPAWN_POWER_CAPACITY (100).

---

## 12. Structures — Military

### 12.1 Rampart — Protection
- [ ] Melee attack on a structure under a rampart redirects to the rampart.
- [ ] `dismantle()` bypasses the rampart and damages the underlying structure directly.
- [ ] Hostile creep movement is blocked by a non-public rampart.
- [ ] `setPublic(true)` allows all players to move through the rampart.
- [ ] Ramparts absorb nuke damage for structures underneath.
- [ ] `setPublic(false)` restricts movement to the owner only.

### 12.2 Rampart — Decay & Limits
- [ ] Ramparts decay by RAMPART_DECAY_AMOUNT (300) per RAMPART_DECAY_TIME (100 ticks).
- [ ] Initial rampart hits: 1.
- [ ] Max rampart hits scale by RCL (2→300K, 3→1M, 4→3M, 5→10M, 6→30M, 7→100M, 8→300M).
- [ ] PWR_FORTIFY makes a rampart invulnerable for the power's duration.
- [ ] PWR_SHIELD creates a temporary invulnerable rampart.

### 12.3 Wall
- [ ] Initial wall hits: WALL_HITS (1).
- [ ] Maximum wall hits: WALL_HITS_MAX (300,000,000).
- [ ] Walls do not decay.

### 12.4 Tower
- [ ] Tower hits: TOWER_HITS (3000).
- [ ] Tower energy capacity: TOWER_CAPACITY (1000).
- [ ] Tower attack/heal/repair mechanics are defined in section 7.9–7.13.

---

## 13. Structures — Infrastructure

### 13.1 Road — Decay
- [ ] Roads decay by ROAD_DECAY_AMOUNT (100) per ROAD_DECAY_TIME (1000 ticks).
- [ ] Swamp roads decay at 5x the normal rate.
- [ ] Wall terrain roads decay at 10x the normal rate.
- [ ] A road is destroyed when its hits reach 0.
- [ ] Road hits depend on the underlying terrain type.

### 13.2 Road — Wear
- [ ] Creep movement adds ROAD_WEAROUT (1) hit damage per body part.
- [ ] Power creep movement adds ROAD_WEAROUT_POWER_CREEP (100) per move.
- [ ] Wear is applied each time a creep moves onto the road tile.

### 13.3 Terminal
- [ ] `send()` transfers resources to a terminal in another room.
- [ ] Energy cost formula: `ceil(amount * (1 - exp(-distance/30)))`.
- [ ] Minimum send amount: TERMINAL_MIN_SEND (100).
- [ ] Cooldown after send: TERMINAL_COOLDOWN (10 ticks).
- [ ] Terminal capacity: TERMINAL_CAPACITY (300,000).
- [ ] PWR_OPERATE_TERMINAL reduces send cost and cooldown.

### 13.4 Observer
- [ ] `observeRoom()` grants vision of a room on the next tick (not the current tick).
- [ ] Maximum range: OBSERVER_RANGE (10 rooms).
- [ ] PWR_OPERATE_OBSERVER grants unlimited observation range.
- [ ] The observed room becomes visible in `Game.rooms` the following tick.

### 13.5 Extractor
- [ ] An extractor is required in the room to harvest minerals.
- [ ] Extractor cooldown is EXTRACTOR_COOLDOWN (5) after each harvest.
- [ ] Extractor hits: EXTRACTOR_HITS (500).

### 13.6 Portal
- [ ] A portal teleports creeps to its destination.
- [ ] Destination can be a RoomPosition (same shard) or {shard, room} (cross-shard).
- [ ] Temporary portals decay after PORTAL_DECAY (30000 ticks); permanent portals do not.

---

## 14. Structures — NPC

### 14.1 Keeper Lair
- [ ] `ticksToSpawn` counts down to the next source keeper spawn.
- [ ] A source keeper is spawned when the timer reaches 0.
- [ ] The keeper defends the nearby source or mineral.
- [ ] Keeper lairs are indestructible.

### 14.2 Invader Core
- [ ] Core level determines invader creep strength.
- [ ] `ticksToDeploy` counts down before the core activates.
- [ ] The core spawns invader creeps after activation.
- [ ] Stronghold mechanics span multiple rooms.
- [ ] Collapse timer effect destroys the core when it expires.

### 14.3 Power Bank `capability: powerCreeps`
- [ ] Power bank has POWER_BANK_HITS (2,000,000) hit points.
- [ ] Hit-back: the power bank deals POWER_BANK_HIT_BACK (50%) of received damage back to the attacker.
- [ ] Power bank decays after POWER_BANK_DECAY (5000 ticks).
- [ ] On destruction, power is dropped (between POWER_BANK_CAPACITY_MIN and POWER_BANK_CAPACITY_MAX).
- [ ] Critical threshold (POWER_BANK_CAPACITY_CRIT = 0.3) affects dropped power amount.

---

## 15. Structure Common

### 15.1 Hits & Destruction
- [ ] All structures have hits and hitsMax (except controller, which is indestructible).
- [ ] `destroy()` by the owner removes the structure instantly.
- [ ] Structure destruction creates a ruin containing the structure's store.
- [ ] `notifyWhenAttacked()` toggles email notifications.
- [ ] A structure at 0 hits is destroyed.

### 15.2 isActive & RCL
- [ ] Structures above the RCL limit for their type return false from `isActive()`.
- [ ] Inactive structures exist but cannot be used for gameplay actions.
- [ ] The structure becomes active again if the RCL is raised to support it.
- [ ] The isActive check applies per structure type per RCL from the limits table.

### 15.3 Construction Costs
- [ ] Each buildable structure type has a fixed energy cost (e.g., spawn 15000, extension 3000, road 300, wall 1).
- [ ] A construction site's `progressTotal` equals its structure's construction cost.

---

## 16. Room Mechanics

### 16.1 Visibility
- [ ] A room is visible only when a player has a creep or owned structure in it.
- [ ] Visible rooms have full object access via `Game.rooms`.
- [ ] Non-visible rooms have no `Game.rooms` entry and no object access.
- [ ] Observer grants visibility to the target room on the next tick.
- [ ] A room becomes invisible when the last owned object leaves or is destroyed.

### 16.2 Energy Tracking
- [ ] `energyAvailable` equals the sum of energy in all spawns and extensions.
- [ ] `energyCapacityAvailable` equals the sum of capacity of all spawns and extensions.
- [ ] Both values update each tick.

### 16.3 Find
- [ ] `Room.find(type)` returns objects matching a FIND_* constant.
- [ ] A filter option narrows results.
- [ ] Player-relative constants (FIND_MY_CREEPS, FIND_HOSTILE_CREEPS) work in player code.
- [ ] FIND_SOURCES_ACTIVE returns only sources with energy > 0.
- [ ] FIND_EXIT_* returns walkable border tiles for that direction.
- [ ] Return type varies by FIND constant.

### 16.4 Look
- [ ] `lookAt(x, y)` returns all objects at a position.
- [ ] `lookForAt(type, x, y)` returns objects of a specific LOOK_* type.
- [ ] `lookAtArea(top, left, bottom, right)` returns objects in a rectangular region.
- [ ] `lookForAtArea()` returns objects of a specific type in a rectangular region.
- [ ] `asArray` parameter changes the return format from object to array.

### 16.5 Terrain
- [ ] `Room.Terrain` constructor creates a terrain accessor for a room.
- [ ] `get(x, y)` returns 0 (plain), TERRAIN_MASK_WALL (1), or TERRAIN_MASK_SWAMP (2).
- [ ] `getRawBuffer()` returns a 2500-byte Uint8Array of the room terrain.
- [ ] `Game.map.getRoomTerrain()` provides equivalent access.

### 16.6 Event Log
- [ ] `getEventLog()` returns all events from the current tick.
- [ ] Event types include ATTACK, OBJECT_DESTROYED, BUILD, HARVEST, HEAL, REPAIR, RESERVE_CONTROLLER, UPGRADE_CONTROLLER, TRANSFER, EXIT, POWER, and ATTACK_CONTROLLER.
- [ ] Each event includes the source object ID, target, and type-specific data.
- [ ] `raw` parameter returns unparsed event data.
- [ ] Events are only available for the current tick.

### 16.7 Flags
- [ ] `createFlag()` places a flag at a position with name, color, and secondaryColor.
- [ ] Maximum flags per player: FLAGS_LIMIT (10000).
- [ ] `Flag.remove()` removes the flag.
- [ ] `Flag.setColor()` changes the flag's color.
- [ ] `Flag.setPosition()` moves the flag to a new position.
- [ ] Flags are player-specific and referenced by name (no object ID).

---

## 17. Source, Mineral & Deposit Lifecycle

### 17.1 Source Regeneration
- [ ] Sources regenerate to full energy every ENERGY_REGEN_TIME (300 ticks).
- [ ] Source capacity in owned/reserved rooms: SOURCE_ENERGY_CAPACITY (3000).
- [ ] Source capacity in neutral rooms: SOURCE_ENERGY_NEUTRAL_CAPACITY (1500).
- [ ] Source capacity in keeper rooms: SOURCE_ENERGY_KEEPER_CAPACITY (4000).
- [ ] `ticksToRegeneration` counts down to the next regeneration.

### 17.2 Source Power Effects
- [ ] PWR_REGEN_SOURCE adds energy to a source periodically.
- [ ] PWR_DISRUPT_SOURCE pauses source regeneration for the effect's duration.
- [ ] REGEN_SOURCE amount and period scale with power level.

### 17.3 Mineral Regeneration
- [ ] Minerals regenerate to full amount every MINERAL_REGEN_TIME (50000 ticks).
- [ ] Mineral density can change on regeneration.
- [ ] Four density levels: LOW (15K), MODERATE (35K), HIGH (70K), ULTRA (100K).
- [ ] `ticksToRegeneration` counts down to the next regeneration.
- [ ] Seven mineral types exist: H, O, U, L, K, Z, X.

### 17.4 Mineral Power Effects
- [ ] PWR_REGEN_MINERAL adds mineral amount periodically.
- [ ] REGEN_MINERAL amount and period scale with power level.

### 17.5 Deposit Lifecycle `capability: deposit`
- [ ] Harvest cooldown escalates exponentially with repeated harvesting.
- [ ] Decay timer is set on first harvest (DEPOSIT_DECAY_TIME = 50000).
- [ ] Four deposit types: silicon, metal, biomass, mist.
- [ ] `lastCooldown` tracks the most recent cooldown applied.

---

## 18. Game Objects

### 18.1 Tombstone
- [ ] A tombstone is created when a creep dies.
- [ ] The tombstone contains the dead creep's store contents.
- [ ] Tombstone decay time: TOMBSTONE_DECAY_PER_PART (5) ticks per body part.
- [ ] Power creep tombstone decay: TOMBSTONE_DECAY_POWER_CREEP (500 ticks).
- [ ] Any player can withdraw resources from a tombstone.

### 18.2 Ruin
- [ ] A ruin is created when a structure is destroyed by a player action.
- [ ] The ruin contains the destroyed structure's store.
- [ ] Ruin decay time: RUIN_DECAY (500 ticks).
- [ ] Ruins track the original structureType and destroyTime.

### 18.3 Nuke (In-Flight)
- [ ] A Nuke object is created when a nuker launches.
- [ ] Properties: launchRoomName and timeToLand.
- [ ] The nuke is visible in the target room before landing.

---

## 19. Power Creeps `capability: powerCreeps`

### 19.1 Lifecycle
- [ ] `PowerCreep.create(name, className)` creates an unspawned power creep.
- [ ] `spawn(powerSpawn)` spawns the power creep at a power spawn structure.
- [ ] `renew(powerSpawn)` restores TTL at a power spawn or power bank.
- [ ] `delete()` permanently deletes the power creep (with cooldown).
- [ ] `upgrade(power)` spends a power level to unlock or upgrade a power.
- [ ] Power creep TTL counts down each tick.
- [ ] Power creep death creates a tombstone.
- [ ] Power creep name must be unique.

### 19.2 Movement & Actions
- [ ] Power creeps generate no fatigue on any terrain.
- [ ] Power creep road wear is ROAD_WEAROUT_POWER_CREEP (100) per move.
- [ ] Power creeps can transfer, withdraw, pickup, and drop resources.
- [ ] Power creeps can use `say()`.
- [ ] Power creeps cannot attack, heal, harvest, build, repair, dismantle, or claim.

### 19.3 Enable Room
- [ ] `enableRoom(controller)` enables power usage in the room.
- [ ] Sets `controller.isPowerEnabled` to true.
- [ ] Powers cannot be used in a room until it is enabled.

### 19.4 Operate Powers
- [ ] PWR_OPERATE_SPAWN reduces spawn time by a level-scaled percentage.
- [ ] PWR_OPERATE_TOWER increases tower effectiveness by a level-scaled percentage.
- [ ] PWR_OPERATE_STORAGE increases storage capacity by a level-scaled amount.
- [ ] PWR_OPERATE_LAB increases reaction amount by a level-scaled value.
- [ ] PWR_OPERATE_EXTENSION fills extensions from storage (level-scaled percentage).
- [ ] PWR_OPERATE_OBSERVER grants unlimited observation range.
- [ ] PWR_OPERATE_TERMINAL reduces send cost and cooldown.
- [ ] PWR_OPERATE_CONTROLLER increases the per-tick upgrade limit.
- [ ] PWR_OPERATE_FACTORY sets the factory level permanently.
- [ ] PWR_OPERATE_POWER increases power processing rate.
- [ ] Each operate power has a cooldown, range, and ops cost.
- [ ] Operate powers require the room to be power-enabled.

### 19.5 Disrupt Powers
- [ ] PWR_DISRUPT_SPAWN pauses spawning for a level-scaled number of ticks.
- [ ] PWR_DISRUPT_TOWER reduces tower effectiveness by a level-scaled percentage.
- [ ] PWR_DISRUPT_SOURCE pauses source regeneration for a level-scaled duration.
- [ ] PWR_DISRUPT_TERMINAL blocks terminal operations for a fixed duration.
- [ ] Each disrupt power has a cooldown, range, and ops cost.
- [ ] Disrupt powers can target hostile structures.

### 19.6 Regen Powers
- [ ] PWR_REGEN_SOURCE adds energy to a source periodically at a level-scaled amount.
- [ ] PWR_REGEN_MINERAL adds mineral to a deposit periodically at a level-scaled amount.
- [ ] Regen effects persist for a duration after activation.
- [ ] Regen powers have a cooldown and range.

### 19.7 Combat Powers
- [ ] PWR_SHIELD creates a temporary invulnerable rampart at the power creep's position.
- [ ] PWR_FORTIFY makes a rampart or wall invulnerable for a level-scaled duration.
- [ ] Shield HP and fortify duration scale with power level.
- [ ] Shield rampart is removed when the effect expires.

### 19.8 Generate Ops
- [ ] PWR_GENERATE_OPS creates ops resource in the power creep's store.
- [ ] Amount scales with level: 1, 2, 4, 6, 8.
- [ ] Cooldown is 50 ticks.

---

## 20. Market `capability: market`

### 20.1 Terminal Send
- [ ] Energy cost formula: `ceil(amount * (1 - exp(-distance/30)))`.
- [ ] Minimum send amount: TERMINAL_MIN_SEND (100).
- [ ] Cooldown after send: TERMINAL_COOLDOWN (10 ticks).
- [ ] Resources arrive at the destination terminal instantly.
- [ ] Energy cost is borne by the sender.

### 20.2 Orders
- [ ] `createOrder()` creates a buy or sell order with resource type, price, amount, and room.
- [ ] Maximum orders per player: MARKET_MAX_ORDERS (300).
- [ ] Order lifetime: MARKET_ORDER_LIFE_TIME (30 days).
- [ ] `cancelOrder()` removes an order.
- [ ] `changeOrderPrice()` updates an order's price.
- [ ] `extendOrder()` adds additional amount to an order.

### 20.3 Deal
- [ ] `Game.market.deal()` executes a trade against an existing order.
- [ ] Energy cost is always borne by the deal caller, not the order owner.
- [ ] `deal()` is capped at 10 calls per tick (silent failure beyond).
- [ ] MARKET_FEE (0.05) is applied to credit transactions.
- [ ] Returns ERR_NOT_ENOUGH_RESOURCES when terminal lacks energy for the deal cost.

### 20.4 Queries
- [ ] `getAllOrders(filter?)` returns orders matching the filter.
- [ ] `getOrderById()` returns a specific order.
- [ ] `getHistory()` returns recent transaction history.

---

## 21. Map

### 21.1 Room Queries
- [ ] `describeExits()` returns exit directions and adjacent room names.
- [ ] `getRoomLinearDistance()` returns Manhattan distance in the room grid.
- [ ] `getRoomLinearDistance()` with `continuous` flag wraps around the map.
- [ ] `getRoomStatus()` returns normal, novice, or respawn area status.
- [ ] `getWorldSize()` returns the world size.

### 21.2 Route Finding
- [ ] `findExit()` returns the exit direction constant to reach a destination room.
- [ ] `findRoute()` returns an array of {exit, room} steps.
- [ ] `routeCallback` option allows custom room costs in route finding.
- [ ] Returns ERR_NO_PATH when no route exists.
- [ ] Inaccessible rooms (novice/respawn belonging to others) are excluded.

### 21.3 Terrain
- [ ] `getRoomTerrain()` returns a Room.Terrain object for any room.
- [ ] Works for non-visible rooms (terrain is always accessible).
- [ ] Terrain is immutable — it never changes during the game.

---

## 22. RoomPosition

### 22.1 Construction & Properties
- [ ] `new RoomPosition(x, y, roomName)` creates a position object.
- [ ] Properties: x, y, roomName.
- [ ] Coordinate range is 0–49 for both x and y.

### 22.2 Spatial Queries
- [ ] `getRangeTo()` returns Chebyshev distance to a target.
- [ ] `inRangeTo()` returns true if the target is within the specified range.
- [ ] `isNearTo()` returns true if the target is at range 1 or less.
- [ ] `isEqualTo()` returns true if the target is on the same tile.
- [ ] `getDirectionTo()` returns a direction constant (1–8) toward a target.
- [ ] Cross-room positions return Infinity for `getRangeTo()`.

### 22.3 Find Helpers
- [ ] `findClosestByPath()` uses pathfinding to find the closest reachable target.
- [ ] `findClosestByRange()` uses linear distance only.
- [ ] `findInRange()` returns all matching objects within the given range.
- [ ] `findPathTo()` returns a path from this position to a target.
- [ ] Filter option works on all find methods.

### 22.4 Look
- [ ] `look()` returns all objects at this position.
- [ ] `lookFor(type)` returns objects of a specific LOOK_* type at this position.
- [ ] Returns an empty array when no objects of the given type exist.

### 22.5 Actions
- [ ] `createConstructionSite()` places a construction site at this position.
- [ ] `createFlag()` places a flag at this position.
- [ ] Behavior is identical to the Room equivalents with the position implicit.

---

## 23. Store API

### 23.1 Resource Access
- [ ] `store[RESOURCE_TYPE]` returns the amount of that resource.
- [ ] `store.getUsedCapacity()` returns total used capacity across all resources.
- [ ] `store.getUsedCapacity(type)` returns used capacity for a specific resource.
- [ ] `store.getFreeCapacity()` returns total free capacity.
- [ ] `store.getCapacity()` returns total capacity.
- [ ] `store.getCapacity(type)` returns capacity for a specific resource type.

### 23.2 Store Types
- [ ] Open stores (storage, terminal, container, factory) accept any resource type.
- [ ] Restricted stores (lab) accept specific resources with separate capacity per resource.
- [ ] Single stores (spawn, extension, tower, link, nuker, power spawn) accept one resource type.
- [ ] `getCapacity()` without a type argument returns null for restricted stores.

---

## 24. Intent Resolution

### 24.1 Tick Processing Order
- [ ] Pre-tick phases run first: nuke, keeper, invader, invader core pretick.
- [ ] Spawn energy is calculated before user intents.
- [ ] All user intents from all players are collected before any resolve.
- [ ] Movement collision resolution runs after all other intents.
- [ ] Post-intent processing handles decay, regeneration, and lifecycle.
- [ ] The tick number increments after all processing is complete.

### 24.2 Creep Action Priority
- [ ] Priority chain (higher blocks lower): rangedHeal → attackController → dismantle → repair → build → attack → harvest → rangedMassAttack → rangedAttack.
- [ ] If a higher-priority action is present, lower-priority actions in the chain are skipped.
- [ ] Non-blocking actions execute independently: drop, transfer, withdraw, pickup, heal, move, pull, say, suicide.
- [ ] Calling the same method twice in one tick: the last call's intent wins.
- [ ] `cancelOrder()` can remove a specific method's intent before the tick resolves.
- [ ] `move()` always executes regardless of other actions.
- [ ] `heal()` (melee) is non-blocking and can combine with any action.
- [ ] `rangedHeal()` blocks all lower-priority actions in the chain.

### 24.3 Same-Tick Resource Visibility
- [ ] Each action sees the creep's resources as of the tick start.
- [ ] Energy from `withdraw()` is not available for `upgradeController()` in the same tick.
- [ ] `transfer()` removes resources from the sender immediately but the recipient sees them next tick.
- [ ] Multiple actions consuming the same resource type each see the full starting amount.

### 24.4 Intent Limits
- [ ] `Game.market.deal()` is capped at 10 intents per tick.
- [ ] `cancelOrder()`, `changeOrderPrice()`, `extendOrder()` are each capped at 50 per tick.
- [ ] Power creep management actions (spawn, suicide, delete, upgrade, rename, create) are each capped at 50 per tick.
- [ ] Exceeding a cap returns OK but the intent is silently dropped.

### 24.5 Simultaneous Actions
- [ ] `move()` + `rangedMassAttack()` + `heal()` can all execute in the same tick.
- [ ] `build()` and `repair()` cannot execute in the same tick (same pipeline).
- [ ] When capacity conflicts exist, priority is: withdraw > pickup > transfer.
- [ ] Healing a healthy creep returns OK and still blocks lower-priority pipeline actions.
- [ ] `rangedAttack()` and `rangedHeal()` cannot both execute (rangedHeal has higher priority).

---

## 25. Memory

### 25.1 Main Memory
- [ ] `Memory` is auto-parsed from JSON on first access each tick.
- [ ] `Memory` is auto-serialized to JSON at tick end.
- [ ] Memory has a 2 MB size limit — exceeding it causes an error.

### 25.2 RawMemory
- [ ] `RawMemory.get()` returns the raw memory string.
- [ ] `RawMemory.set()` replaces the raw memory string.
- [ ] 100 segments are available, each up to 100 KB.
- [ ] `setActiveSegments(ids)` activates up to 10 segments, available next tick.
- [ ] `segments[id]` accesses the content of an active segment.

### 25.3 Foreign Segments
- [ ] `setActiveForeignSegment(username, id?)` requests another player's public segment.
- [ ] `foreignSegment` is available the next tick with {username, id, data}.
- [ ] `setDefaultPublicSegment()` sets which segment other players see by default.

---

## Summary

| # | Area | Facets | Behaviors |
|---|------|--------|-----------|
| 1 | Movement | 7 | 46 |
| 2 | Pathfinding | 4 | 25 |
| 3 | Harvesting | 3 | 22 |
| 4 | Resource Transfer | 5 | 29 |
| 5 | Construction & Repair | 4 | 33 |
| 6 | Controller | 10 | 55 |
| 7 | Combat | 16 | 82 |
| 8 | Boosts | 12 | 52 |
| 9 | Spawning & Lifecycle | 10 | 46 |
| 10 | Structures — Energy & Storage | 4 | 22 |
| 11 | Structures — Production | 6 | 34 |
| 12 | Structures — Military | 4 | 17 |
| 13 | Structures — Infrastructure | 6 | 24 |
| 14 | Structures — NPC | 3 | 14 |
| 15 | Structure Common | 3 | 11 |
| 16 | Room Mechanics | 7 | 34 |
| 17 | Source, Mineral & Deposit | 5 | 19 |
| 18 | Game Objects | 3 | 12 |
| 19 | Power Creeps | 8 | 45 |
| 20 | Market | 4 | 19 |
| 21 | Map | 3 | 13 |
| 22 | RoomPosition | 5 | 20 |
| 23 | Store API | 2 | 10 |
| 24 | Intent Resolution | 5 | 27 |
| 25 | Memory | 3 | 11 |
| | **Total** | **136** | **~762** |

Coverage will grow toward 800–1200 as edge cases, boundary values, and
multi-player interaction scenarios are added during sentence review.

### Deliberately excluded (per spec.md non-goals):
- CPU/heap metrics (engine-specific values)
- Multi-shard mechanics (InterShardMemory)
- Seasonal/event-specific scoring
- Server administration (auth, scaling)
- Visual APIs (RoomVisual, MapVisual) — no gameplay effect
- `Game.notify()` — side effect, not gameplay
