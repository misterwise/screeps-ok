# screeps-ok Behavioral Catalog

A comprehensive enumeration of every testable Screeps gameplay behavior,
organized by game system and facet. Each checkbox maps to one canonical
conformance test or one generated test family.

**How to read this document:**
- **Area** = major game system (top-level heading)
- **Facet** = specific mechanic within that system (sub-heading)
- `- [ ]` = untested, `- [x]` = tested
- Facets marked with a capability tag require that adapter capability
- Migrated pilot entries use the inline form `` `ID` `class` `oracle` ``
- `class` is one of `behavior` or `matrix`
- `oracle` records the current reference status, such as
  `verified_vanilla` or `needs_vanilla_verification`
- Matrix-backed and scoped shared-rule definitions live in
  `docs/behavior-matrices.md`
- Legacy entries remain in the older checklist style until they are reviewed

**Catalog entry rules:**
- A checklist entry must describe one public, deterministic, directly testable
  behavior with one clear interpretation.
- `behavior` entries describe one concrete gameplay rule and should usually map
  to one canonical test.
- `matrix` entries describe one gameplay rule that expands into a generated
  family of cases from a canonical table or data source.
- Every `matrix` entry must have a companion definition in
  `docs/behavior-matrices.md` covering canonical source, dimensions,
  applicability, and exclusions.
- If a statement requires unrelated assertions, split it into multiple entries.
- Do not use checklist entries for editorial guidance, framework limitations,
  inferred internal algorithms, or broad umbrella statements.
- Keep non-normative material under section-local `Notes`, `Coverage Notes`, or
  `Framework Notes`.

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
- [ ] `moveByPath()` moves the creep one step along a provided path array.
- [ ] `moveByPath()` returns OK when the next step is a valid adjacent tile.
- [ ] `moveByPath()` returns ERR_NOT_FOUND when the creep's position is not on the path.
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
- [ ] A MOVE part boosted with ZO reduces fatigue by 4 per tick instead of 2.
- [ ] A MOVE part boosted with ZHO2 reduces fatigue by 6 per tick.
- [ ] A MOVE part boosted with XZHO2 reduces fatigue by 8 per tick.
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
- [ ] `MOVE-COLLISION-001` `behavior` `verified_vanilla`
  When multiple creeps attempt to occupy the same tile in the same tick, at
  most one creep occupies that tile after movement resolves.
- [ ] `MOVE-COLLISION-002` `behavior` `verified_vanilla`
  A creep that loses collision resolution remains on its original tile and does
  not receive an action error code from `move()`.
- [ ] `MOVE-COLLISION-003` `behavior` `verified_vanilla`
  Two creeps moving into each other's starting tiles in the same tick can swap
  positions.

Coverage Notes
- Same-input determinism should be proven through concrete repeated scenarios,
  not kept as a standalone abstract catalog item.
- The exact collision-priority algorithm is not catalog truth yet.
- Replace inferred priority-factor bullets with a small set of verified,
  observable tie-break scenarios.

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
- [ ] Each WORK part harvests 1 unit of the mineral type per tick.
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
- [ ] `CTRL-SAFEMODE-001` `behavior` `verified_vanilla`
  `activateSafeMode()` consumes one available safe mode charge and starts safe
  mode for SAFE_MODE_DURATION ticks when the controller is eligible.
- [ ] `CTRL-SAFEMODE-002` `behavior` `verified_vanilla`
  Safe mode activation starts a SAFE_MODE_COOLDOWN period during which
  `activateSafeMode()` cannot be used again.
- [ ] `CTRL-SAFEMODE-003` `behavior` `verified_vanilla`
  `activateSafeMode()` returns ERR_NOT_ENOUGH_RESOURCES when
  `safeModeAvailable` is 0.
- [ ] `CTRL-SAFEMODE-004` `behavior` `verified_vanilla`
  `activateSafeMode()` returns ERR_TIRED when the controller's safe mode
  cooldown is active.
- [ ] `CTRL-SAFEMODE-005` `behavior` `needs_vanilla_verification`
  `activateSafeMode()` fails and does not activate when the controller's
  downgrade timer is below CONTROLLER_DOWNGRADE_SAFEMODE_THRESHOLD.
- [ ] `CTRL-SAFEMODE-006` `matrix` `needs_vanilla_verification`
  Hostile creep damage actions blocked by safe mode match the canonical blocked
  action set across `attack()`, `rangedAttack()`, `rangedMassAttack()`, and
  `dismantle()`.

Notes
- Any hostile movement restrictions during safe mode should be added only as
  concrete observable outcomes, not as a broad summary rule.

### 6.9 Unclaim
- [ ] `unclaim()` resets the controller to level 0 (unowned).
- [ ] All owned structures in the room are destroyed.
- [ ] Destroyed structures become ruins.

### 6.10 Structure Limits per RCL
- [ ] `CTRL-STRUCTLIMIT-001` `matrix` `verified_vanilla`
  The maximum active owned structure count for each structure type and
  controller level matches the canonical `CONTROLLER_STRUCTURES` table.
- [ ] `CTRL-STRUCTLIMIT-002` `behavior` `verified_vanilla`
  Owned structures above the room's current controller-level limit remain
  present but inactive until the room again satisfies the limit.

Coverage Notes
- Constant-across-level limits for containers, roads, walls, and ramparts are
  covered by the same structure-limit matrix.

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
- [ ] `COMBAT-BODYPART-001` `behavior` `verified_vanilla`
  Incoming damage is applied to the earliest surviving body part first, and
  later parts remain unchanged until earlier parts are exhausted.
- [ ] `COMBAT-BODYPART-002` `behavior` `verified_vanilla`
  Each body part has 100 hits, and `hitsMax` equals body length multiplied by
  100.
- [ ] `COMBAT-BODYPART-003` `behavior` `verified_vanilla`
  A body part at 0 hits is destroyed and is excluded from
  `getActiveBodyparts(type)`.

Coverage Notes
- The gameplay consequences of destroyed MOVE, WORK, CARRY, ATTACK, HEAL, and
  other body parts should be covered in their type-specific movement, combat,
  harvesting, transfer, and controller-action sections rather than as one
  umbrella statement here.

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
- [ ] `TOWER-ATTACK-001` `behavior` `verified_vanilla`
  When `tower.attack()` executes, the tower's energy decreases by
  `TOWER_ENERGY_COST` in the same tick.
- [ ] `TOWER-ATTACK-002` `matrix` `verified_vanilla`
  Tower attack damage by range matches the canonical Screeps tower falloff
  curve derived from the tower attack constants.
- [ ] `TOWER-ATTACK-003` `matrix` `needs_vanilla_verification`
  `tower.attack()` target acceptance and invalid-target behavior match the
  canonical target matrix across creeps, power creeps, structures, and
  non-attackable objects.

### 7.10 Tower Heal
- [ ] `TOWER-HEAL-001` `behavior` `verified_vanilla`
  When `tower.heal()` executes, the tower's energy decreases by
  `TOWER_ENERGY_COST` in the same tick.
- [ ] `TOWER-HEAL-002` `matrix` `verified_vanilla`
  Tower heal amount by range matches the canonical Screeps tower falloff curve
  derived from the tower heal constants.
- [ ] `TOWER-HEAL-003` `matrix` `needs_vanilla_verification`
  `tower.heal()` target acceptance and invalid-target behavior match the
  canonical target matrix across creeps, power creeps, structures, and
  non-healable objects.

### 7.11 Tower Repair
- [ ] `TOWER-REPAIR-001` `behavior` `verified_vanilla`
  When `tower.repair()` executes, the tower's energy decreases by
  `TOWER_ENERGY_COST` in the same tick.
- [ ] `TOWER-REPAIR-002` `matrix` `verified_vanilla`
  Tower repair amount by range matches the canonical Screeps tower falloff
  curve derived from the tower repair constants.
- [ ] `TOWER-REPAIR-003` `matrix` `needs_vanilla_verification`
  `tower.repair()` target acceptance and invalid-target behavior match the
  canonical target matrix across repairable structures, non-repairable
  structures, creeps, and other invalid targets.

### 7.12 Tower Action Priority
- [ ] `TOWER-INTENT-001` `behavior` `verified_vanilla`
  A tower performs at most one of attack, heal, or repair in a tick.
- [ ] `TOWER-INTENT-002` `behavior` `verified_vanilla`
  When heal, repair, and attack intents are all queued for the same tower in
  one tick, heal is preferred over repair and repair is preferred over attack.
- [ ] `TOWER-INTENT-003` `behavior` `verified_vanilla`
  Lower-priority tower intents submitted in the same tick do not execute after
  the chosen tower action resolves.

### 7.13 Tower Power Effects
- [ ] `TOWER-POWER-001` `matrix` `verified_vanilla`
  `PWR_OPERATE_TOWER` and `PWR_DISRUPT_TOWER` modify tower attack, heal, and
  repair power according to `POWER_INFO` for each supported power level.
- [ ] `TOWER-POWER-002` `behavior` `needs_vanilla_verification`
  `PWR_OPERATE_TOWER` and `PWR_DISRUPT_TOWER` can affect the same tower at the
  same time.

### 7.14 Nukes — Launch `capability: nuke`
- [ ] Launching requires NUKER_ENERGY_CAPACITY (300000) energy and NUKER_GHODIUM_CAPACITY (5000) ghodium.
- [ ] Nuker cooldown is NUKER_COOLDOWN (100000 ticks).
- [ ] Maximum range is NUKE_RANGE (10 rooms).
- [ ] Creates an in-flight Nuke object visible in the target room.
- [ ] `launchNuke()` returns ERR_NOT_ENOUGH_RESOURCES when energy or ghodium is insufficient.
- [ ] `launchNuke()` returns ERR_TIRED when the nuker is on cooldown.
- [ ] `launchNuke()` returns ERR_INVALID_TARGET when the target room is beyond NUKE_RANGE.

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
- [ ] Lab cooldown after unboost equals the sum of REACTION_TIME for all compounds removed.
- [ ] Returns ERR_NOT_IN_RANGE when creep is not adjacent.
- [ ] Returns ERR_FULL when lab cannot hold the returned compounds.

### 8.3 Per-Part Boost Aggregation
- [ ] `BOOST-AGGREGATION-001` `matrix` `verified_vanilla`
  For additive boost mechanics, total effect equals the sum of each active
  body part's individual boosted or unboosted contribution across attack,
  ranged attack, heal, harvest, build, repair, dismantle, upgrade, move, and
  carry capacity.

Coverage Notes
- `TOUGH` is excluded from this matrix because boosted `TOUGH` modifies damage
  taken by the boosted part rather than contributing a simple additive output.

### 8.4 Attack Boosts
- [ ] `BOOST-ATTACK-001` `matrix` `verified_vanilla`
  ATTACK boost effect magnitudes match the canonical Screeps `BOOSTS` table for
  `UH`, `UH2O`, and `XUH2O`.

### 8.5 Ranged Boosts
- [ ] `BOOST-RANGED-001` `matrix` `verified_vanilla`
  `RANGED_ATTACK` boost effect magnitudes match the canonical Screeps `BOOSTS`
  table for `KO`, `KHO2`, and `XKHO2`.

### 8.6 Heal Boosts
- [ ] `BOOST-HEAL-001` `matrix` `verified_vanilla`
  `HEAL` boost effect magnitudes match the canonical Screeps `BOOSTS` table for
  `LO`, `LHO2`, and `XLHO2`.

### 8.7 Tough Boosts
- [ ] `BOOST-TOUGH-001` `matrix` `verified_vanilla`
  `TOUGH` damage-reduction magnitudes match the canonical Screeps `BOOSTS`
  table for `GO`, `GHO2`, and `XGHO2`.
- [ ] `BOOST-TOUGH-002` `behavior` `verified_vanilla`
  Tough damage reduction applies only to the boosted `TOUGH` body part itself.

### 8.8 Harvest Boosts
- [ ] `BOOST-HARVEST-001` `matrix` `verified_vanilla`
  Harvest boost effect magnitudes match the canonical Screeps `BOOSTS` table
  for `UO`, `UHO2`, and `XUHO2`.
- [ ] `BOOST-HARVEST-003` `behavior` `verified_vanilla`
  Harvest boosts apply only during `harvest()`, not other `WORK` actions.

### 8.9 Build/Repair Boosts
- [ ] `BOOST-BUILD-001` `matrix` `verified_vanilla`
  Build and repair boost effect magnitudes match the canonical Screeps
  `BOOSTS` table for `LH`, `LH2O`, and `XLH2O`.
- [ ] `BOOST-BUILD-003` `behavior` `verified_vanilla`
  Build and repair boosts do not increase energy cost.

### 8.10 Dismantle Boosts
- [ ] `BOOST-DISMANTLE-001` `matrix` `verified_vanilla`
  Dismantle boost effect magnitudes match the canonical Screeps `BOOSTS` table
  for `ZH`, `ZH2O`, and `XZH2O`.

### 8.11 Upgrade Boosts
- [ ] `BOOST-UPGRADE-001` `matrix` `verified_vanilla`
  Upgrade boost effect magnitudes match the canonical Screeps `BOOSTS` table
  for `GH`, `GH2O`, and `XGH2O`.
- [ ] `BOOST-UPGRADE-003` `behavior` `verified_vanilla`
  Upgrade boosts do not increase energy cost.

### 8.12 Move Boosts
- [ ] `BOOST-MOVE-001` `matrix` `verified_vanilla`
  Move boost effect magnitudes match the canonical Screeps `BOOSTS` table for
  `ZO`, `ZHO2`, and `XZHO2`.

Coverage Notes
- Concrete fatigue outcomes from move boosts are also covered in movement
  section `1.2 Fatigue Calculation`.

### 8.13 Carry Boosts
- [ ] `BOOST-CARRY-001` `matrix` `verified_vanilla`
  Carry boost capacity increases match the canonical Screeps `BOOSTS` table for
  `KH`, `KH2O`, and `XKH2O`.
- [ ] `BOOST-CARRY-003` `behavior` `verified_vanilla`
  Boosted `CARRY` parts still contribute zero fatigue when empty.

---

## 9. Spawning & Creep Lifecycle

### 9.1 spawnCreep
- [ ] `SPAWN-CREATE-001` `behavior` `verified_vanilla`
  `spawnCreep()` requires a non-empty body.
- [ ] `SPAWN-CREATE-002` `behavior` `verified_vanilla`
  `spawnCreep()` rejects bodies longer than `MAX_CREEP_SIZE` (50).
- [ ] `SPAWN-CREATE-003` `behavior` `verified_vanilla`
  `spawnCreep()` requires a name that is unique among living and spawning
  creeps.
- [ ] `SPAWN-CREATE-004` `behavior` `verified_vanilla`
  Spawn cost equals the sum of `BODYPART_COST` for the requested body.
- [ ] `SPAWN-CREATE-005` `behavior` `needs_vanilla_verification`
  When `energyStructures` is provided, `spawnCreep()` draws energy only from
  the listed structures.
- [ ] `SPAWN-CREATE-006` `behavior` `needs_vanilla_verification`
  When `energyStructures` is provided, `spawnCreep()` draws energy from the
  listed structures in listed order.
- [ ] `SPAWN-CREATE-007` `behavior` `verified_vanilla`
  `spawnCreep()` returns `ERR_NOT_ENOUGH_ENERGY` when the selected energy
  sources cannot pay the spawn cost.
- [ ] `SPAWN-CREATE-008` `behavior` `verified_vanilla`
  `spawnCreep()` returns `ERR_NAME_EXISTS` when the requested name is already
  in use.
- [ ] `SPAWN-CREATE-009` `behavior` `verified_vanilla`
  `spawnCreep()` returns `ERR_BUSY` when the spawn is already spawning.
- [ ] `SPAWN-CREATE-010` `behavior` `verified_vanilla`
  `spawnCreep(..., { dryRun: true })` performs feasibility checks without
  consuming energy or creating a creep.
- [ ] `SPAWN-CREATE-011` `behavior` `verified_vanilla`
  `spawnCreep(..., { memory })` seeds the spawned creep's initial memory.

Coverage Notes
- Default spawn-plus-extension drain order should be covered through concrete
  scenarios if we decide that exact source ordering is part of the public
  contract.

### 9.2 Spawning Duration & Direction
- [ ] `SPAWN-TIMING-001` `behavior` `verified_vanilla`
  Spawn duration is `CREEP_SPAWN_TIME` (3) ticks per body part.
- [ ] `SPAWN-TIMING-002` `behavior` `verified_vanilla`
  While spawning, the creep remains on the spawn position with
  `creep.spawning === true`.
- [ ] `SPAWN-TIMING-003` `behavior` `verified_vanilla`
  When `opts.directions` is omitted, the spawn chooses the first available exit
  tile in the default priority order `TOP`, `TOP_RIGHT`, `RIGHT`,
  `BOTTOM_RIGHT`, `BOTTOM`, `BOTTOM_LEFT`, `LEFT`, `TOP_LEFT`.
- [ ] `SPAWN-TIMING-004` `behavior` `verified_vanilla`
  When `opts.directions` is provided, the spawn chooses the first available
  exit tile from that direction order.
- [ ] `SPAWN-TIMING-005` `behavior` `needs_vanilla_verification`
  Custom directions are ignored for 1-tick spawns created by single-part creeps
  under `PWR_OPERATE_SPAWN`.
- [ ] `SPAWN-TIMING-006` `behavior` `verified_vanilla`
  When spawning completes, the creep exits the spawn tile in the chosen
  direction.

### 9.3 Spawn Stomping
- [ ] `SPAWN-STOMP-001` `behavior` `needs_vanilla_verification`
  If spawning completes with every adjacent tile blocked and a hostile creep
  occupies a blocked chosen exit tile, the hostile creep is destroyed to free
  an exit tile.
- [ ] `SPAWN-STOMP-002` `behavior` `needs_vanilla_verification`
  After spawn stomping, the new creep moves to the vacated tile.
- [ ] `SPAWN-STOMP-003` `behavior` `needs_vanilla_verification`
  Spawn stomping destroys the hostile creep outside normal combat damage
  resolution.
- [ ] `SPAWN-STOMP-004` `behavior` `needs_vanilla_verification`
  Spawn stomping does not occur if any chosen exit tile is open when spawning
  completes.
- [ ] `SPAWN-STOMP-005` `behavior` `needs_vanilla_verification`
  Spawn stomping does not occur when the blocked chosen exit tiles contain no
  hostile creeps.
- [ ] `SPAWN-STOMP-006` `behavior` `needs_vanilla_verification`
  With restricted spawn directions, spawn stomping does not occur if an open
  adjacent tile exists outside the chosen direction list.

### 9.4 Renew Creep
- [ ] `RENEW-CREEP-001` `behavior` `verified_vanilla`
  `renewCreep()` can target only an adjacent creep.
- [ ] `RENEW-CREEP-002` `behavior` `verified_vanilla`
  A successful `renewCreep()` returns `OK`, increases the target creep's
  `ticksToLive` by
  `floor(SPAWN_RENEW_RATIO * CREEP_LIFE_TIME / CREEP_SPAWN_TIME / body.length)`
  in the same tick.
- [ ] `RENEW-CREEP-003` `behavior` `verified_vanilla`
  A successful `renewCreep()` returns `OK` and spends
  `ceil(CREEP_SPAWN_TIME * body.length * BODYPART_COST_SUM / SPAWN_RENEW_RATIO / CREEP_LIFE_TIME)`
  energy in the same tick.
- [ ] `RENEW-CREEP-004` `behavior` `verified_vanilla`
  A successful `renewCreep()` returns `OK` and removes all boosts from the
  target creep.
- [ ] `RENEW-CREEP-005` `behavior` `verified_vanilla`
  A successful `renewCreep()` returns `OK` and does not refund the removed
  boost compounds or boost energy.
- [ ] `RENEW-CREEP-006` `behavior` `verified_vanilla`
  If boost removal reduces `storeCapacity`, excess carried resources are
  dropped until the creep's store fits the new capacity.
- [ ] `RENEW-CREEP-007` `behavior` `verified_vanilla`
  Creeps with any `CLAIM` part cannot be renewed.

### 9.5 Recycle Creep
- [ ] `RECYCLE-CREEP-001` `behavior` `verified_vanilla`
  `recycleCreep()` destroys an adjacent creep during the current tick's intent
  resolution.
- [ ] `RECYCLE-CREEP-002` `behavior` `verified_vanilla`
  Recycled body value returned as energy equals
  `CREEP_CORPSE_RATE * remainingTTL / CREEP_LIFE_TIME` of the creep's total
  body cost.
- [ ] `RECYCLE-CREEP-003` `behavior` `needs_vanilla_verification`
  Recycling returns both energy and boost compounds from the target creep.

Coverage Notes
- Container-vs-tombstone placement of recycled resources should be kept as a
  concrete scenario once we verify the exact vanilla outcome.

### 9.6 Creep Spawning State
- [ ] `CREEP-SPAWNING-001` `behavior` `verified_vanilla`
  `creep.spawning` is `true` while the creep is being spawned.
- [ ] `CREEP-SPAWNING-002` `behavior` `verified_vanilla`
  `creep.ticksToLive` is `undefined` while the creep is spawning.
- [ ] `CREEP-SPAWNING-003` `behavior` `verified_vanilla`
  A spawning creep cannot perform creep actions.
- [ ] `CREEP-SPAWNING-004` `behavior` `verified_vanilla`
  A spawning creep's body parts are visible before spawning completes.

### 9.7 Aging & Death
- [ ] `CREEP-LIFETIME-001` `behavior` `verified_vanilla`
  A living creep's `ticksToLive` decrements by 1 each completed tick.
- [ ] `CREEP-LIFETIME-002` `behavior` `verified_vanilla`
  Creeps without `CLAIM` parts start with `CREEP_LIFE_TIME` `ticksToLive`.
- [ ] `CREEP-LIFETIME-003` `behavior` `verified_vanilla`
  Creeps with any `CLAIM` part start with `CREEP_CLAIM_LIFE_TIME`
  `ticksToLive`.
- [ ] `CREEP-DEATH-001` `behavior` `verified_vanilla`
  A creep with `ticksToLive === 1` dies during that tick's resolution and does
  not appear on the next tick.
- [ ] `CREEP-DEATH-002` `behavior` `verified_vanilla`
  A creep's death creates a tombstone during that tick's resolution, and the
  tombstone appears on the next tick at the position of death.
- [ ] `CREEP-DEATH-003` `behavior` `verified_vanilla`
  When a live container is on the death tile, death resources are diverted into
  that container before any remainder is placed into the tombstone.
- [ ] `CREEP-DEATH-004` `behavior` `verified_vanilla`
  A creep tombstone stores any death resources not diverted into a same-tile
  container.
- [ ] `CREEP-DEATH-005` `behavior` `verified_vanilla`
  Resource amounts stored in a tombstone do not decay before the tombstone
  expires.
- [ ] `CREEP-DEATH-006` `behavior` `verified_vanilla`
  Tombstone decay time equals `TOMBSTONE_DECAY_PER_PART` (5) ticks per body
  part.
- [ ] `CREEP-DEATH-007` `behavior` `verified_vanilla`
  When a tombstone decays, any remaining stored resources become dropped
  resources on the same tile before the tombstone is removed.
- [ ] `CREEP-DEATH-008` `matrix` `verified_vanilla`
  Standard player-creep tombstone handling for carried resources matches across
  death sources that produce ordinary tombstones, including `ticksToLive`
  expiry and `suicide()`.

### 9.8 Suicide
- [ ] `CREEP-SUICIDE-001` `behavior` `verified_vanilla`
  A successful `suicide()` returns `OK` and removes the creep during the
  current tick's intent resolution.
- [ ] `CREEP-SUICIDE-002` `behavior` `verified_vanilla`
  A successful `suicide()` returns `OK` and creates a tombstone during that
  tick's resolution, and the tombstone appears on the next tick at the
  creep's position.
- [ ] `CREEP-SUICIDE-003` `behavior` `verified_vanilla`
  `suicide()` returns `OK` on success.
- [ ] `CREEP-SUICIDE-004` `behavior` `verified_vanilla`
  `suicide()` returns `ERR_NOT_OWNER` when called on a creep that is not yours.
- [ ] `CREEP-SUICIDE-005` `behavior` `verified_vanilla`
  `suicide()` returns `ERR_BUSY` when called on a spawning creep.

### 9.9 Say
- [ ] `CREEP-SAY-001` `behavior` `verified_vanilla`
  `say()` displays a message visible for one tick.
- [ ] `CREEP-SAY-002` `behavior` `verified_vanilla`
  `say(message, true)` makes the message visible to all players.
- [ ] `CREEP-SAY-003` `behavior` `verified_vanilla`
  Without the public flag, only the owner sees the message.

### 9.10 cancelOrder
Coverage Notes
- Canonical `cancelOrder(methodName)` behaviors live in section `24.2 Intent
  Resolution`, where they can be specified against queued same-tick intents
  without duplicating the same rule surface in two places.

---

## 10. Structures — Energy & Storage

### 10.1 Extension
- [ ] `EXTENSION-001` `behavior` `verified_vanilla`
  An active extension contributes exactly its stored energy to
  `room.energyAvailable`.
- [ ] `EXTENSION-002` `behavior` `verified_vanilla`
  An active extension contributes exactly its energy capacity to
  `room.energyCapacityAvailable`.

Coverage Notes
- Extension inactivity from controller-structure limits is owned by section
  `6.10 Structure Limits per RCL`.
- Extension store-type semantics and capacity constants belong in section `23. Store API`.

### 10.2 Storage
Coverage Notes
- Storage durability belongs in section `15.1 Hits & Destruction`.
- Storage controller availability belongs in section `6.10 Structure Limits per RCL`.
- Storage store-type semantics and capacity constants belong in section `23. Store API`.
- `PWR_OPERATE_STORAGE` effects belong in the power-effect sections.

### 10.3 Container
- [ ] `CONTAINER-001` `matrix` `verified_vanilla`
  Container decay amount and decay interval match the canonical Screeps values
  for owned and unowned rooms.
- [ ] `CONTAINER-002` `behavior` `verified_vanilla`
  When a container is destroyed, its remaining contents become dropped
  resources on the same tile.
- [ ] `CONTAINER-003` `behavior` `verified_vanilla`
  A hostile creep adjacent to a container can successfully `withdraw()` from
  it, subject to the normal `withdraw()` preconditions and blockers.

Coverage Notes
- Container store-type semantics and capacity constants belong in section `23. Store API`.

### 10.4 Link
- [ ] `LINK-001` `behavior` `verified_vanilla`
  `transferEnergy()` requires a target that is a different `StructureLink`.
- [ ] `LINK-002` `behavior` `verified_vanilla`
  `transferEnergy()` requires the target link to be in the same room as the
  source link.
- [ ] `LINK-003` `behavior` `verified_vanilla`
  A successful `transferEnergy()` returns `OK` and increases the target link's
  energy by
  `amount - ceil(amount * LINK_LOSS_RATIO)`.
- [ ] `LINK-004` `behavior` `verified_vanilla`
  A successful `transferEnergy()` returns `OK` and increases the source link's
  cooldown by
  `LINK_COOLDOWN * max(abs(dx), abs(dy))` between the source link and target
  link.
- [ ] `LINK-005` `behavior` `verified_vanilla`
  `transferEnergy()` requires the target link to be owned by the same player as
  the source link.
- [ ] `LINK-006` `behavior` `verified_vanilla`
  Sending 1 energy through a link delivers 0 energy to the target because the
  transfer loss is rounded up.
- [ ] `LINK-007` `behavior` `verified_vanilla`
  `transferEnergy()` returns `ERR_INVALID_ARGS` for a negative amount.
- [ ] `LINK-008` `behavior` `verified_vanilla`
  `transferEnergy()` returns `ERR_INVALID_TARGET` when the target is missing,
  not a link, or the source link itself.
- [ ] `LINK-009` `behavior` `verified_vanilla`
  `transferEnergy()` returns `ERR_NOT_OWNER` when the target link is not yours.
- [ ] `LINK-010` `behavior` `verified_vanilla`
  `transferEnergy()` returns `ERR_TIRED` while the source link has cooldown.
- [ ] `LINK-011` `behavior` `verified_vanilla`
  `transferEnergy()` returns `ERR_RCL_NOT_ENOUGH` when the source link is
  inactive.
- [ ] `LINK-012` `behavior` `verified_vanilla`
  `transferEnergy()` returns `ERR_NOT_ENOUGH_ENERGY` when the source link lacks
  enough energy for the requested transfer.
- [ ] `LINK-013` `behavior` `verified_vanilla`
  `transferEnergy()` returns `ERR_FULL` when the target link lacks enough free
  capacity for the requested transfer.
- [ ] `LINK-014` `behavior` `verified_vanilla`
  `transferEnergy()` returns `ERR_NOT_IN_RANGE` when the target is in a
  different room.

Coverage Notes
- Link store-type semantics and capacity constants belong in section `23. Store API`.

---

## 11. Structures — Production

### 11.1 Lab Reactions `capability: chemistry`
- [ ] `LAB-RUN-001` `matrix` `verified_vanilla`
  `runReaction(lab1, lab2)` produces the canonical reaction product for the
  minerals currently stored in `lab1` and `lab2` for every valid input pair.
- [ ] `LAB-RUN-002` `behavior` `verified_vanilla`
  When `runReaction(lab1, lab2)` executes successfully, it consumes
  `LAB_REACTION_AMOUNT` units from `lab1` and `lab2` and adds
  `LAB_REACTION_AMOUNT` units to the lab calling `runReaction()` in the same
  tick.
- [ ] `LAB-RUN-003` `behavior` `verified_vanilla`
  While `PWR_OPERATE_LAB` is active on the lab calling `runReaction()`, a successful
  `runReaction(lab1, lab2)` consumes and produces
  `LAB_REACTION_AMOUNT + POWER_INFO[PWR_OPERATE_LAB].effect[level-1]` units in
  the same tick.
- [ ] `LAB-RUN-004` `behavior` `verified_vanilla`
  A successful `runReaction(lab1, lab2)` returns `OK` and sets the cooldown of
  the lab calling `runReaction()` to
  `REACTION_TIME[the produced compound]`.
- [ ] `LAB-RUN-005` `behavior` `verified_vanilla`
  `runReaction(lab1, lab2)` returns `ERR_NOT_IN_RANGE` when either `lab1` or
  `lab2` is more than range 2 from the lab calling `runReaction()`.
- [ ] `LAB-RUN-006` `behavior` `verified_vanilla`
  `runReaction(lab1, lab2)` returns `ERR_NOT_ENOUGH_RESOURCES` when either
  `lab1` or `lab2` has less than the required reaction amount.
- [ ] `LAB-RUN-007` `behavior` `verified_vanilla`
  `runReaction(lab1, lab2)` returns `ERR_FULL` when the lab calling
  `runReaction()` lacks
  enough free mineral capacity for the reaction output amount.
- [ ] `LAB-RUN-008` `behavior` `verified_vanilla`
  `runReaction(lab1, lab2)` returns `ERR_INVALID_ARGS` when the minerals in
  `lab1` and `lab2` do not define a product or the lab calling
  `runReaction()` already holds a different mineral type.
- [ ] `LAB-RUN-009` `behavior` `verified_vanilla`
  `runReaction(lab1, lab2)` returns `ERR_INVALID_TARGET` when either argument is
  not another lab.
- [ ] `LAB-RUN-010` `behavior` `verified_vanilla`
  `runReaction(lab1, lab2)` returns `ERR_TIRED` while the lab calling
  `runReaction()` is on cooldown.
- [ ] `LAB-RUN-011` `behavior` `verified_vanilla`
  `runReaction(lab1, lab2)` returns `ERR_RCL_NOT_ENOUGH` while the lab calling
  `runReaction()` is inactive.
- [ ] `LAB-RUN-012` `behavior` `verified_vanilla`
  `runReaction(lab1, lab2)` returns `ERR_NOT_OWNER` when the lab calling
  `runReaction()` is not owned by the player.

### 11.2 Lab Reverse Reaction `capability: chemistry`
- [ ] `LAB-REVERSE-001` `matrix` `verified_vanilla`
  `reverseReaction(lab1, lab2)` splits each reversible compound into one valid
  canonical input pair from `REACTIONS`.
- [ ] `LAB-REVERSE-002` `behavior` `verified_vanilla`
  When `reverseReaction(lab1, lab2)` executes successfully, it consumes
  `LAB_REACTION_AMOUNT` units of the compound from the lab calling
  `reverseReaction()` and adds
  `LAB_REACTION_AMOUNT` units of each input mineral to `lab1` and `lab2` in the
  same tick.
- [ ] `LAB-REVERSE-003` `behavior` `verified_vanilla`
  While `PWR_OPERATE_LAB` is active on the lab calling `reverseReaction()`, a successful
  `reverseReaction(lab1, lab2)` consumes and produces
  `LAB_REACTION_AMOUNT + POWER_INFO[PWR_OPERATE_LAB].effect[level-1]` units in
  the same tick.
- [ ] `LAB-REVERSE-004` `behavior` `verified_vanilla`
  A successful `reverseReaction(lab1, lab2)` returns `OK` and sets the
  cooldown of the lab calling `reverseReaction()` to
  `REACTION_TIME[the consumed compound]`.
- [ ] `LAB-REVERSE-005` `behavior` `verified_vanilla`
  `reverseReaction(lab1, lab2)` returns `ERR_NOT_IN_RANGE` when either `lab1`
  or `lab2` is more than range 2 from the lab calling `reverseReaction()`.
- [ ] `LAB-REVERSE-006` `behavior` `verified_vanilla`
  `reverseReaction(lab1, lab2)` returns `ERR_NOT_ENOUGH_RESOURCES` when the
  lab calling `reverseReaction()` has less than the required compound amount.
- [ ] `LAB-REVERSE-007` `behavior` `verified_vanilla`
  `reverseReaction(lab1, lab2)` returns `ERR_FULL` when either `lab1` or `lab2`
  lacks enough free mineral capacity for the returned amount.
- [ ] `LAB-REVERSE-008` `behavior` `verified_vanilla`
  `reverseReaction(lab1, lab2)` returns `ERR_INVALID_ARGS` when the reacting lab
  mineral has no matching reverse pair for the target lab mineral types or both
  arguments refer to the same lab.
- [ ] `LAB-REVERSE-009` `behavior` `verified_vanilla`
  `reverseReaction(lab1, lab2)` returns `ERR_INVALID_TARGET` when either
  argument is not another lab.
- [ ] `LAB-REVERSE-010` `behavior` `verified_vanilla`
  `reverseReaction(lab1, lab2)` returns `ERR_TIRED` while the lab calling
  `reverseReaction()` is on cooldown.
- [ ] `LAB-REVERSE-011` `behavior` `verified_vanilla`
  `reverseReaction(lab1, lab2)` returns `ERR_RCL_NOT_ENOUGH` while the lab
  calling `reverseReaction()` is inactive.
- [ ] `LAB-REVERSE-012` `behavior` `verified_vanilla`
  `reverseReaction(lab1, lab2)` returns `ERR_NOT_OWNER` when the lab calling
  `reverseReaction()` is not owned by the player.

### 11.3 Reaction Chain `capability: chemistry`
Coverage Notes
- Base, tier-1, tier-2, and tier-3 compound chains should be generated from the
  canonical `REACTIONS` table rather than maintained as separate hand-written
  recipe bullets.
- Conformance of the reaction table itself is covered by `LAB-RUN-001`.

### 11.4 Factory Production `capability: factory`
- [ ] `FACTORY-PRODUCE-001` `matrix` `verified_vanilla`
  `produce(resourceType)` consumes the canonical
  `COMMODITIES[resourceType].components` and produces
  `COMMODITIES[resourceType].amount || 1` units for every factory-produced
  resource.
- [ ] `FACTORY-PRODUCE-002` `behavior` `verified_vanilla`
  A successful `produce(resourceType)` returns `OK` and sets factory cooldown to
  `COMMODITIES[resourceType].cooldown`.
- [ ] `FACTORY-PRODUCE-003` `behavior` `verified_vanilla`
  `produce(resourceType)` returns `ERR_NOT_ENOUGH_RESOURCES` when the factory
  lacks any required recipe component amount.
- [ ] `FACTORY-PRODUCE-004` `behavior` `verified_vanilla`
  `produce(resourceType)` returns `ERR_FULL` when consuming the recipe inputs
  and adding the output amount would exceed the factory's total store capacity.
- [ ] `FACTORY-PRODUCE-005` `behavior` `verified_vanilla`
  `produce(resourceType)` returns `ERR_BUSY` when the commodity's required level
  effect from `PWR_OPERATE_FACTORY` is not currently active.
- [ ] `FACTORY-PRODUCE-006` `behavior` `verified_vanilla`
  `produce(resourceType)` returns `ERR_TIRED` while the factory is on cooldown.
- [ ] `FACTORY-PRODUCE-007` `behavior` `verified_vanilla`
  `produce(resourceType)` returns `ERR_RCL_NOT_ENOUGH` while the factory is
  inactive.
- [ ] `FACTORY-PRODUCE-008` `behavior` `verified_vanilla`
  `produce(resourceType)` returns `ERR_INVALID_ARGS` when `resourceType` is not
  a factory commodity.
- [ ] `FACTORY-PRODUCE-009` `behavior` `verified_vanilla`
  `produce(resourceType)` returns `ERR_INVALID_TARGET` when the commodity exists
  but requires a different factory level than the structure's current level.
- [ ] `FACTORY-PRODUCE-010` `behavior` `verified_vanilla`
  `produce(resourceType)` returns `ERR_NOT_OWNER` when the factory is not owned
  by the player.

### 11.5 Factory Commodity Chains `capability: factory`
- [ ] `FACTORY-COMMODITY-001` `matrix` `verified_vanilla`
  Factory commodity level requirements and chain membership match the canonical
  `COMMODITIES` table for all factory-produced resources.
- [ ] `FACTORY-COMMODITY-002` `behavior` `verified_vanilla`
  A factory without an active `PWR_OPERATE_FACTORY` effect can produce only
  level 0 commodities.
- [ ] `FACTORY-COMMODITY-003` `behavior` `verified_vanilla`
  While `PWR_OPERATE_FACTORY` is active at level N, a factory can produce only
  level 0 commodities and level N commodities.

Coverage Notes
- Chain names and tier counts should be derived from `COMMODITIES`, not
  maintained as separate hand-written bullets.
- Factory error-code behavior for invalid commodity level requests is covered by
  `FACTORY-PRODUCE-009`.

### 11.6 Power Spawn `capability: powerCreeps`
- [ ] `POWER-SPAWN-001` `behavior` `verified_vanilla`
  A successful `processPower()` returns `OK`, consumes 1 power and
  `POWER_SPAWN_ENERGY_RATIO` energy and adds 1 GPL progress.
- [ ] `POWER-SPAWN-002` `behavior` `verified_vanilla`
  While `PWR_OPERATE_POWER` is active, a successful `processPower()` returns
  `OK`, consumes and converts
  `1 + POWER_INFO[PWR_OPERATE_POWER].effect[level-1]` power, capped by the
  power currently stored.
- [ ] `POWER-SPAWN-003` `behavior` `verified_vanilla`
  `processPower()` returns `ERR_NOT_ENOUGH_RESOURCES` when the power spawn lacks
  enough power or energy for the amount that would be processed this tick.
- [ ] `POWER-SPAWN-004` `behavior` `verified_vanilla`
  `processPower()` returns `ERR_RCL_NOT_ENOUGH` while the power spawn is
  inactive.
- [ ] `POWER-SPAWN-005` `behavior` `verified_vanilla`
  `processPower()` returns `ERR_NOT_OWNER` when the power spawn is not owned by
  the player.

Coverage Notes
- Power spawn store-type semantics and capacity constants belong in section `23. Store API`.

---

## 12. Structures — Military

### 12.1 Rampart — Protection
- [ ] `RAMPART-PROTECT-001` `behavior` `verified_vanilla`
  A melee `attack()` targeting an object on a rampart tile damages the rampart
  instead of the covered target.
- [ ] `RAMPART-PROTECT-002` `behavior` `verified_vanilla`
  `dismantle()` targeting an object on a rampart tile damages the rampart
  instead of the covered target.
- [ ] `RAMPART-PROTECT-003` `behavior` `verified_vanilla`
  A non-public hostile rampart blocks hostile creep movement onto its tile.
- [ ] `RAMPART-PROTECT-004` `behavior` `verified_vanilla`
  A public rampart does not block hostile creep movement onto its tile.
- [ ] `RAMPART-PROTECT-005` `behavior` `verified_vanilla`
  `setPublic(true)` sets `isPublic` to `true` on the next tick.
- [ ] `RAMPART-PROTECT-006` `behavior` `verified_vanilla`
  `setPublic(false)` sets `isPublic` to `false` on the next tick.
- [ ] `RAMPART-PROTECT-007` `behavior` `verified_vanilla`
  `setPublic()` returns `ERR_NOT_OWNER` when the rampart is not owned by the
  player.
- [ ] `RAMPART-PROTECT-008` `behavior` `verified_vanilla`
  Nuke damage is applied to a rampart on the target tile before remaining
  damage is applied to other objects on that tile.

### 12.2 Rampart — Decay & Limits
- [ ] `RAMPART-DECAY-001` `behavior` `verified_vanilla`
  A rampart loses `RAMPART_DECAY_AMOUNT` hits every `RAMPART_DECAY_TIME` ticks.
- [ ] `RAMPART-DECAY-002` `behavior` `verified_vanilla`
  A rampart is removed in the same tick when decay reduces its hits to 0 or
  below.
- [ ] `RAMPART-DECAY-003` `matrix` `verified_vanilla`
  Owned rampart `hitsMax` by room controller level matches the canonical
  `RAMPART_HITS_MAX` table.
- [ ] `RAMPART-DECAY-004` `behavior` `verified_vanilla`
  `PWR_FORTIFY` prevents direct damage to a rampart while the effect is active.
- [ ] `RAMPART-DECAY-005` `behavior` `verified_vanilla`
  `PWR_SHIELD` creates a temporary rampart that is removed when the shield
  effect expires.

Coverage Notes
- Initial rampart hits on creation belong with construction behavior rather than
  ongoing rampart state.

### 12.3 Wall
- [ ] `WALL-001` `behavior` `verified_vanilla`
  Ordinary constructed walls do not decay.
- [ ] `WALL-002` `behavior` `verified_vanilla`
  A constructed wall has `hitsMax = WALL_HITS_MAX` only while the room
  controller level allows constructed walls in that room.

Coverage Notes
- Initial wall hits on creation belong with construction behavior rather than
  ongoing wall state.
- Newbie and room-protection walls use separate `decayTime` behavior and should
  not be conflated with ordinary permanent constructed walls.

### 12.4 Tower
Coverage Notes
- Tower attack, heal, repair, and tower power-effect behavior belongs in
  section `7`.
- Tower store-type semantics and capacity constants belong in section `23. Store API`.

---

## 13. Structures — Infrastructure

### 13.1 Road — Decay
- [ ] `ROAD-DECAY-001` `matrix` `verified_vanilla`
  Road decay amount by underlying terrain matches the canonical Screeps
  constants for plain, swamp, and wall terrain.
- [ ] `ROAD-DECAY-002` `behavior` `verified_vanilla`
  A road loses decay hits every `ROAD_DECAY_TIME` ticks.
- [ ] `ROAD-DECAY-003` `behavior` `verified_vanilla`
  A road is removed in the same tick when decay reduces its hits to 0 or below.

Coverage Notes
- Initial road hits by terrain belong with construction behavior rather than
  ongoing road state.

### 13.2 Road — Wear
- [ ] `ROAD-WEAR-001` `matrix` `verified_vanilla`
  When a unit moves onto a road tile, road wear advances `nextDecayTime` earlier
  by the canonical amount for that mover type: `ROAD_WEAROUT * body.length` for
  creeps and `ROAD_WEAROUT_POWER_CREEP` for power creeps.
- [ ] `ROAD-WEAR-002` `behavior` `verified_vanilla`
  Road wear is applied in the same tick each time a unit successfully moves onto
  the road tile.

### 13.3 Terminal
- [ ] `TERMINAL-SEND-001` `behavior` `verified_vanilla`
  A successful `send(resourceType, amount, targetRoomName)` returns `OK`,
  queues a transfer to the target room and, when the transfer resolves, sets
  cooldown on the terminal calling `send()` to `TERMINAL_COOLDOWN`.
- [ ] `TERMINAL-SEND-002` `behavior` `verified_vanilla`
  While `PWR_OPERATE_TERMINAL` is active, a successful
  `send(resourceType, amount, targetRoomName)` returns `OK` and sets cooldown
  on the terminal calling `send()` to
  `round(TERMINAL_COOLDOWN * POWER_INFO[PWR_OPERATE_TERMINAL].effect[level-1])`.
- [ ] `TERMINAL-SEND-003` `behavior` `verified_vanilla`
  When a terminal send resolves, the sending terminal spends
  `calcTerminalEnergyCost(amount, distance)` energy for the source room and
  target room, and the receiving terminal does not pay the transfer cost.
- [ ] `TERMINAL-SEND-004` `behavior` `verified_vanilla`
  While `PWR_OPERATE_TERMINAL` is active, terminal send energy cost is
  multiplied by `POWER_INFO[PWR_OPERATE_TERMINAL].effect[level-1]` and rounded
  up.
- [ ] `TERMINAL-SEND-005` `behavior` `verified_vanilla`
  `send(resourceType, amount, targetRoomName)` returns `ERR_INVALID_ARGS` when
  `resourceType`, `targetRoomName`, or `description` is invalid.
- [ ] `TERMINAL-SEND-006` `behavior` `verified_vanilla`
  `send(resourceType, amount, targetRoomName)` returns
  `ERR_NOT_ENOUGH_RESOURCES` when the terminal lacks the sent resource amount or
  the required energy cost.
- [ ] `TERMINAL-SEND-007` `behavior` `verified_vanilla`
  `send(resourceType, amount, targetRoomName)` returns `ERR_TIRED` while the
  terminal is on cooldown.
- [ ] `TERMINAL-SEND-008` `behavior` `verified_vanilla`
  `send(resourceType, amount, targetRoomName)` returns `ERR_RCL_NOT_ENOUGH`
  while the terminal is inactive.
- [ ] `TERMINAL-SEND-009` `behavior` `verified_vanilla`
  `send(resourceType, amount, targetRoomName)` returns `ERR_NOT_OWNER` when the
  terminal is not owned by the player.

Coverage Notes
- Terminal store-type semantics and capacity constants belong in section `23. Store API`.
- Cooldown amount and market-order interactions should be derived from the
  terminal send and market processor paths rather than maintained here as loose
  summary bullets.

### 13.4 Observer
- [ ] `OBSERVER-001` `behavior` `verified_vanilla`
  A successful `observeRoom(roomName)` returns `OK` and makes the target room
  visible on the next tick, not the current tick.
- [ ] `OBSERVER-002` `behavior` `verified_vanilla`
  `observeRoom(roomName)` returns `ERR_NOT_IN_RANGE` when the target room is
  beyond `OBSERVER_RANGE`.
- [ ] `OBSERVER-003` `behavior` `verified_vanilla`
  While `PWR_OPERATE_OBSERVER` is active, `observeRoom(roomName)` ignores the
  normal `OBSERVER_RANGE` limit.
- [ ] `OBSERVER-004` `behavior` `verified_vanilla`
  `observeRoom(roomName)` returns `ERR_INVALID_ARGS` when `roomName` is not a
  valid room name.
- [ ] `OBSERVER-005` `behavior` `verified_vanilla`
  `observeRoom(roomName)` returns `ERR_RCL_NOT_ENOUGH` while the observer is
  inactive.
- [ ] `OBSERVER-006` `behavior` `verified_vanilla`
  `observeRoom(roomName)` returns `ERR_NOT_OWNER` when the observer is not owned
  by the player.

### 13.5 Extractor
- [ ] `EXTRACTOR-001` `behavior` `verified_vanilla`
  Harvesting a mineral deposit requires an extractor on that tile.
- [ ] `EXTRACTOR-002` `behavior` `verified_vanilla`
  A successful `harvest(mineral)` returns `OK` and sets extractor cooldown to
  `EXTRACTOR_COOLDOWN`.
- [ ] `EXTRACTOR-003` `behavior` `verified_vanilla`
  `harvest(mineral)` returns `ERR_NOT_FOUND` when no extractor is present on the
  mineral tile.
- [ ] `EXTRACTOR-004` `behavior` `verified_vanilla`
  `harvest(mineral)` returns `ERR_NOT_OWNER` when the extractor on the mineral
  tile is not owned by the player.
- [ ] `EXTRACTOR-005` `behavior` `verified_vanilla`
  `harvest(mineral)` returns `ERR_RCL_NOT_ENOUGH` when the extractor is
  inactive.
- [ ] `EXTRACTOR-006` `behavior` `verified_vanilla`
  `harvest(mineral)` returns `ERR_TIRED` while the extractor is on cooldown.

### 13.6 Portal
- [ ] `PORTAL-001` `behavior` `verified_vanilla`
  A creep or power creep standing on a same-shard portal tile appears at the
  portal destination on the next tick.
- [ ] `PORTAL-002` `behavior` `verified_vanilla`
  A same-shard portal exposes `portal.destination` as a `RoomPosition`.
- [ ] `PORTAL-003` `behavior` `verified_vanilla`
  A cross-shard portal exposes `portal.destination` as `{ shard, room }`.
- [ ] `PORTAL-004` `behavior` `verified_vanilla`
  A temporary portal exposes `ticksToDecay`, and a permanent portal returns
  `undefined` for `ticksToDecay`.

---

## 14. Structures — NPC

### 14.1 Keeper Lair
- [ ] `KEEPER-LAIR-001` `behavior` `verified_vanilla`
  When a keeper lair has a scheduled spawn, `ticksToSpawn` decreases by 1 each
  tick and stops being exposed when that spawn resolves.
- [ ] `KEEPER-LAIR-002` `behavior` `verified_vanilla`
  A keeper lair starts a new spawn timer when its current keeper is missing or
  below full hits.
- [ ] `KEEPER-LAIR-003` `behavior` `verified_vanilla`
  When the spawn timer completes, the keeper lair spawns a source keeper on its
  own tile in the same tick.

### 14.2 Invader Core
- [ ] `INVADER-CORE-001` `behavior` `verified_vanilla`
  `ticksToDeploy` counts down to deployment while an invader core has a pending
  deploy time.
- [ ] `INVADER-CORE-002` `behavior` `verified_vanilla`
  An invader core exposes its `level` as a public property.
- [ ] `INVADER-CORE-003` `behavior` `verified_vanilla`
  When an invader core has an active `spawning` state, the named creep is born
  on the invader core tile when `spawning.spawnTime` completes, and the core's
  `spawning` state clears in the same tick.
- [ ] `INVADER-CORE-004` `behavior` `verified_vanilla`
  When an invader core's `EFFECT_COLLAPSE_TIMER` expires, the room controller it
  governs becomes unowned level 0 in the same tick, and its progress, safe
  mode, power enablement, and controller effects are cleared.

Coverage Notes
- Stronghold orchestration across multiple rooms is too broad for one catalog
- item and should be split into concrete observable behaviors later.

### 14.3 Power Bank `capability: powerCreeps`
- [ ] `POWER-BANK-001` `behavior` `verified_vanilla`
  When a power bank is attacked, it deals `POWER_BANK_HIT_BACK` of the received
  damage back to the attacker in the same tick.
- [ ] `POWER-BANK-002` `behavior` `verified_vanilla`
  `ticksToDecay` counts down to power bank removal.
- [ ] `POWER-BANK-003` `matrix` `needs_vanilla_verification`
  The public `powerBank.power` value lies within the canonical power bank
  capacity range.

Coverage Notes
- Concrete destruction-drop behavior for power banks should be written against
  observable dropped resource outcomes, not only constant ranges.
- The critical-threshold behavior for generated power needs a dedicated
  observable rule before it belongs in the checklist.

### 14.4 NPC Ownership Query Surface
- [ ] `NPC-OWNERSHIP-001` `matrix` `needs_vanilla_verification`
  For each NPC structure class listed in `docs/behavior-matrices.md` under
  `NPC-OWNERSHIP`, the public `my` and `owner` properties match the values
  defined for that class.

Coverage Notes
- This family is limited to public ownership query properties, not owner-gated
  API behavior.


---

## 15. Structure Common

### 15.1 Hits & Destruction
- [ ] `STRUCTURE-HITS-001` `matrix` `verified_vanilla`
  Fixed durability values for structures with constant hit totals match the
  canonical Screeps constants.
- [ ] `STRUCTURE-HITS-002` `behavior` `verified_vanilla`
  Destroyable structures expose `hits` and `hitsMax`.
- [ ] `STRUCTURE-HITS-003` `behavior` `verified_vanilla`
  A structure at 0 hits is destroyed in the same tick.
- [ ] `STRUCTURE-HITS-004` `behavior` `verified_vanilla`
  Destroying a structure by non-nuke means creates a ruin on that tile
  containing the structure's remaining store.

### 15.2 isActive & RCL
- [ ] `STRUCTURE-ACTIVE-001` `behavior` `verified_vanilla`
  For owned structure types limited by `CONTROLLER_STRUCTURES`, `isActive()`
  returns `true` only for the allowed same-type structures closest to the room
  controller at the current controller level.
- [ ] `STRUCTURE-ACTIVE-002` `behavior` `verified_vanilla`
  Inactive structures still exist in the room but their gated gameplay actions
  fail active-structure checks.
- [ ] `STRUCTURE-ACTIVE-003` `behavior` `verified_vanilla`
  A structure becomes active again if the room controller later satisfies its
  active-limit requirements.
- [ ] `STRUCTURE-ACTIVE-004` `behavior` `verified_vanilla`
  Structures with no owner or no controller limit table entry return `true`
  from `isActive()`.
- [ ] `STRUCTURE-ACTIVE-005` `behavior` `verified_vanilla`
  When same-type owned structures are at equal controller distance, `isActive()`
  breaks the tie by the engine's object scan order.

### 15.3 Construction Costs
- [ ] `CONSTRUCTION-COST-001` `matrix` `verified_vanilla`
  Buildable structure construction costs match the canonical
  `CONSTRUCTION_COST` table.
- [ ] `CONSTRUCTION-COST-002` `behavior` `verified_vanilla`
  A construction site's `progressTotal` equals its structure's construction
  cost.

### 15.4 Structure APIs
- [ ] `STRUCTURE-API-001` `behavior` `verified_vanilla`
  `destroy()` returns `ERR_NOT_OWNER` when the room controller is missing or not
  owned by the player.
- [ ] `STRUCTURE-API-002` `behavior` `verified_vanilla`
  `destroy()` returns `ERR_BUSY` when hostile creeps or hostile power creeps are
  present in the room.
- [ ] `STRUCTURE-API-003` `behavior` `verified_vanilla`
  A successful `destroy()` returns `OK`, removes the structure in the same
  tick, and creates a ruin on that tile containing the structure's remaining
  store.
- [ ] `STRUCTURE-API-004` `behavior` `verified_vanilla`
  `notifyWhenAttacked(enabled)` returns `ERR_NOT_OWNER` when the structure is
  not owned by the player or the room controller is hostile.
- [ ] `STRUCTURE-API-005` `behavior` `verified_vanilla`
  `notifyWhenAttacked(enabled)` returns `ERR_INVALID_ARGS` when `enabled` is not
  boolean.
- [ ] `STRUCTURE-API-006` `behavior` `verified_vanilla`
  A successful `notifyWhenAttacked(enabled)` returns `OK` and updates the
  structure's attack notification setting on the next tick.

---

## 16. Room Mechanics

### 16.1 Visibility
- [ ] `ROOM-VIS-001` `behavior` `verified_vanilla`
  A visible room has a `Game.rooms[roomName]` entry on that tick.
- [ ] `ROOM-VIS-002` `behavior` `verified_vanilla`
  A non-visible room has no `Game.rooms[roomName]` entry on that tick.

Coverage Notes
- Observer-provided visibility timing is owned by `13.4 Observer`.

### 16.2 Energy Tracking
- [ ] `ROOM-ENERGY-001` `behavior` `verified_vanilla`
  `room.energyAvailable` equals the sum of stored energy in the room's active
  spawns and extensions.
- [ ] `ROOM-ENERGY-002` `behavior` `verified_vanilla`
  `room.energyCapacityAvailable` equals the sum of energy capacity in the
  room's active spawns and extensions.

### 16.3 Find
- [ ] `ROOM-FIND-001` `matrix` `verified_vanilla`
  `Room.find()` result sets for supported `FIND_*` constants match the
  canonical room-find mapping.
- [ ] `ROOM-FIND-002` `behavior` `verified_vanilla`
  `Room.find(type, {filter})` applies the filter to the selected result set
  before returning it.
- [ ] `ROOM-FIND-003` `behavior` `verified_vanilla`
  `FIND_EXIT_TOP`, `FIND_EXIT_RIGHT`, `FIND_EXIT_BOTTOM`, and
  `FIND_EXIT_LEFT` return walkable border positions on that side.
- [ ] `ROOM-FIND-004` `behavior` `verified_vanilla`
  `FIND_EXIT` returns the concatenation of the four side-specific exit result
  sets.
- [ ] `ROOM-FIND-005` `behavior` `verified_vanilla`
  `FIND_SOURCES_ACTIVE` returns only sources whose current energy is greater
  than `0`.
- [ ] `ROOM-FIND-006` `behavior` `verified_vanilla`
  Player-relative `FIND_*` constants such as `FIND_MY_CREEPS` and
  `FIND_HOSTILE_CREEPS` evaluate from the current player's perspective.

### 16.4 Look
- [ ] `ROOM-LOOK-001` `behavior` `verified_vanilla`
  `lookAt(x, y)` returns all public look entries at that position.
- [ ] `ROOM-LOOK-002` `behavior` `verified_vanilla`
  `lookForAt(type, x, y)` returns only entries of the requested `LOOK_*` type
  at that position.
- [ ] `ROOM-LOOK-003` `behavior` `verified_vanilla`
  `lookAtArea(top, left, bottom, right)` returns a y-then-x keyed object by
  default and returns an array of `{x, y, type, ...}` records when `asArray`
  is true.
- [ ] `ROOM-LOOK-004` `behavior` `verified_vanilla`
  `lookForAtArea(type, top, left, bottom, right)` mirrors `lookAtArea()`
  output shapes while restricting results to the requested `LOOK_*` type.

### 16.5 Terrain
- [ ] `ROOM-TERRAIN-001` `matrix` `verified_vanilla`
  `Room.Terrain.get(x, y)` returns the canonical terrain mask values for
  plain, swamp, and wall tiles.
- [ ] `ROOM-TERRAIN-002` `behavior` `verified_vanilla`
  `Room.Terrain.getRawBuffer()` returns the room terrain as a 2500-byte
  `Uint8Array`.
- [ ] `ROOM-TERRAIN-003` `behavior` `verified_vanilla`
  `Game.map.getRoomTerrain(roomName)` provides equivalent terrain access to
  `new Room.Terrain(roomName)`.

### 16.6 Event Log
- [ ] `ROOM-EVENTLOG-001` `behavior` `verified_vanilla`
  `room.getEventLog()` returns the current tick's parsed room event array.
- [ ] `ROOM-EVENTLOG-002` `matrix` `verified_vanilla`
  Current-tick event entries use the canonical event-type and payload mapping.
- [ ] `ROOM-EVENTLOG-003` `behavior` `verified_vanilla`
  `room.getEventLog(true)` returns the current tick's raw event-log JSON
  string.
- [ ] `ROOM-EVENTLOG-004` `behavior` `verified_vanilla`
  Room events are only exposed for the current tick.

### 16.7 Flags
- [ ] `FLAG-001` `behavior` `verified_vanilla`
  `Room.createFlag()` and `RoomPosition.createFlag()` create a player flag at
  the requested position and return the created flag name on success.
- [ ] `FLAG-002` `behavior` `verified_vanilla`
  A created flag stores its `name`, `color`, and `secondaryColor`.
- [ ] `FLAG-003` `behavior` `verified_vanilla`
  A player cannot exceed `FLAGS_LIMIT` total flags.
- [ ] `FLAG-004` `behavior` `verified_vanilla`
  `Flag.remove()` removes the flag from the player's flag set.
- [ ] `FLAG-005` `behavior` `verified_vanilla`
  `Flag.setColor()` updates the flag's `color` and `secondaryColor`.
- [ ] `FLAG-006` `behavior` `verified_vanilla`
  `Flag.setPosition()` moves the flag to the requested room position.
- [ ] `FLAG-007` `behavior` `verified_vanilla`
  Flags are player-scoped and referenced by name rather than object id.

---

## 17. Source, Mineral & Deposit Lifecycle

### 17.1 Source Regeneration
- [ ] `SOURCE-REGEN-001` `matrix` `verified_vanilla`
  Source capacity matches the canonical room-state mapping for neutral,
  reserved or owned, and keeper rooms.
- [ ] `SOURCE-REGEN-002` `behavior` `verified_vanilla`
  When a source regeneration timer completes, the source restores to its
  current room-state capacity in the same tick.
- [ ] `SOURCE-REGEN-003` `behavior` `verified_vanilla`
  A source below its current full capacity exposes `ticksToRegeneration`.
- [ ] `SOURCE-REGEN-004` `behavior` `verified_vanilla`
  While `source.ticksToRegeneration` is defined, it decreases by `1` each tick
  until regeneration completes.

### 17.2 Source Power Effects
- [ ] `SOURCE-POWER-001` `matrix` `verified_vanilla`
  `PWR_REGEN_SOURCE` adds energy using the canonical effect, period, and
  duration for each supported power level.
- [ ] `SOURCE-POWER-002` `behavior` `needs_vanilla_verification`
  `PWR_DISRUPT_SOURCE` prevents scheduled source regeneration from restoring
  energy while the effect is active.

### 17.3 Mineral Regeneration
- [ ] `MINERAL-REGEN-001` `matrix` `verified_vanilla`
  Mineral densities and full amounts match the canonical density mapping.
- [ ] `MINERAL-REGEN-002` `behavior` `verified_vanilla`
  When a mineral regeneration timer completes, the mineral restores to its
  current density amount in the same tick.
- [ ] `MINERAL-REGEN-003` `behavior` `verified_vanilla`
  A full mineral returns `undefined` for `ticksToRegeneration`.
- [ ] `MINERAL-REGEN-004` `behavior` `verified_vanilla`
  A depleted mineral exposes `ticksToRegeneration`, and that value decreases
  by `1` each tick until regeneration completes.
- [ ] `MINERAL-REGEN-005` `behavior` `verified_vanilla`
  A mineral's `mineralType` remains the same across regenerations.

### 17.4 Mineral Power Effects
- [ ] `MINERAL-POWER-001` `matrix` `verified_vanilla`
  `PWR_REGEN_MINERAL` adds mineral amount using the canonical effect, period,
  and duration for each supported power level.

### 17.5 Deposit Lifecycle `capability: deposit`
- [ ] `DEPOSIT-001` `matrix` `verified_vanilla`
  Deposit objects expose the canonical `depositType` values.
- [ ] `DEPOSIT-002` `behavior` `verified_vanilla`
  `deposit.lastCooldown` equals
  `ceil(DEPOSIT_EXHAUST_MULTIPLY * harvested^DEPOSIT_EXHAUST_POW)` for the
  deposit's current harvested count.
- [ ] `DEPOSIT-003` `behavior` `verified_vanilla`
  After a successful harvest, `deposit.cooldown` exposes the remaining wait in
  ticks until the next harvest becomes available, and returns `0` once that
  wait has elapsed.
- [ ] `DEPOSIT-004` `behavior` `verified_vanilla`
  `deposit.ticksToDecay` becomes defined after the first successful harvest
  and decreases by `1` each tick until the deposit is removed.
- [ ] `DEPOSIT-005` `behavior` `verified_vanilla`
  Repeated successful harvests can increase a deposit's exposed
  `lastCooldown` and future `cooldown`.

---

## 18. Game Objects

### 18.1 Tombstone
- [ ] `TOMBSTONE-001` `behavior` `verified_vanilla`
  A tombstone exposes snapshot fields for the dead creep or power creep,
  along with its remaining `store`, `deathTime`, and `decayTime`.
- [ ] `TOMBSTONE-002` `behavior` `verified_vanilla`
  A creep tombstone's decay time is `body.length * TOMBSTONE_DECAY_PER_PART`.
- [ ] `TOMBSTONE-003` `behavior` `verified_vanilla`
  A power creep tombstone's decay time is `TOMBSTONE_DECAY_POWER_CREEP`.

### 18.2 Ruin
- [ ] `RUIN-001` `behavior` `verified_vanilla`
  A ruin exposes the destroyed structure's `structureType`, `destroyTime`,
  remaining `store`, and decay timer.
- [ ] `RUIN-002` `matrix` `verified_vanilla`
  Ruin decay time matches `RUIN_DECAY_STRUCTURES` when present and
  `RUIN_DECAY` otherwise.
- [ ] `RUIN-003` `behavior` `verified_vanilla`
  Ruin resources can be withdrawn subject to the normal `withdraw()`
  preconditions and blockers.

### 18.3 Nuke (In-Flight)
- [ ] `NUKE-FLIGHT-001` `behavior` `verified_vanilla`
  Launching a nuke creates a `Nuke` object in the target room with
  `launchRoomName` and `timeToLand`.
- [ ] `NUKE-FLIGHT-002` `behavior` `verified_vanilla`
  `nuke.timeToLand` decreases by `1` each tick until the landing tick.
- [ ] `NUKE-FLIGHT-003` `behavior` `verified_vanilla`
  An in-flight nuke is visible in the target room before it lands.

---

## 19. Power Creeps `capability: powerCreeps`

### 19.1 Lifecycle
- [ ] `POWERCREEP-CREATE-001` `behavior` `verified_vanilla`
  A successful `PowerCreep.create(name, className)` returns `OK` and queues a
  new unspawned power creep with that name and class.
- [ ] `POWERCREEP-CREATE-002` `matrix` `verified_vanilla`
  `PowerCreep.create()` failure codes match the canonical validation matrix
  for invalid arguments, duplicate name, and insufficient free power levels.
- [ ] `POWERCREEP-SPAWN-001` `behavior` `verified_vanilla`
  A successful `powerCreep.spawn(powerSpawn)` returns `OK`, places the power
  creep on the power spawn's tile and restores full hits and full TTL when the
  spawn resolves.
- [ ] `POWERCREEP-SPAWN-002` `matrix` `verified_vanilla`
  `powerCreep.spawn()` failure codes match the canonical validation matrix for
  busy, invalid target, ownership, inactive power spawn, and spawn cooldown.
- [ ] `POWERCREEP-LIFETIME-001` `behavior` `verified_vanilla`
  A spawned power creep's `ticksToLive` decreases by `1` each tick.
- [ ] `POWERCREEP-DEATH-001` `behavior` `verified_vanilla`
  A power creep death creates a tombstone on the death tile with the power
  creep snapshot fields and `TOMBSTONE_DECAY_POWER_CREEP` decay time.
- [ ] `POWERCREEP-RENEW-001` `behavior` `verified_vanilla`
  A successful `powerCreep.renew(target)` returns `OK` and resets
  `ticksToLive` to `POWER_CREEP_LIFE_TIME` in the same tick.
- [ ] `POWERCREEP-RENEW-002` `matrix` `verified_vanilla`
  `powerCreep.renew()` failure codes match the canonical validation matrix for
  invalid target, inactive power spawn, range, busy, and ownership.
- [ ] `POWERCREEP-DELETE-001` `behavior` `verified_vanilla`
  `powerCreep.delete()` queues deletion for an unspawned owned power creep.
- [ ] `POWERCREEP-DELETE-002` `behavior` `verified_vanilla`
  `powerCreep.delete()` returns `ERR_BUSY` for a spawned power creep.
- [ ] `POWERCREEP-DELETE-003` `behavior` `verified_vanilla`
  `powerCreep.delete()` returns `ERR_NOT_OWNER` for an unowned power creep.
- [ ] `POWERCREEP-UPGRADE-001` `behavior` `verified_vanilla`
  A successful `powerCreep.upgrade(power)` returns `OK`, increases the
  specified power's level by `1`, increases the power creep's `level` by `1`,
  increases `hitsMax` by `1000`, and increases `storeCapacity` by `100`.
- [ ] `POWERCREEP-UPGRADE-002` `matrix` `verified_vanilla`
  `powerCreep.upgrade()` failure codes match the canonical validation matrix
  for ownership, free power levels, max level, invalid power selection, and
  unmet level requirements.

### 19.2 Movement & Actions
- [ ] `POWERCREEP-MOVE-001` `behavior` `verified_vanilla`
  A successful power creep move generates no fatigue on plain, swamp, or road
  terrain.
- [ ] `POWERCREEP-MOVE-002` `behavior` `verified_vanilla`
  A successful move onto a road applies `ROAD_WEAROUT_POWER_CREEP` road wear
  in the same tick.
- [ ] `POWERCREEP-ACTION-001` `matrix` `verified_vanilla`
  While spawned, `transfer()`, `withdraw()`, `pickup()`, `drop()`, and `say()`
  use the same public semantics and return codes as the corresponding creep
  APIs.
- [ ] `POWERCREEP-ACTION-002` `behavior` `verified_vanilla`
  The resource and speech methods above return `ERR_BUSY` while the power
  creep is unspawned.
- [ ] `POWERCREEP-ACTION-003` `behavior` `verified_vanilla`
  Power creeps do not expose the standard creep body-part action methods such
  as `attack()`, `heal()`, `harvest()`, `build()`, `repair()`,
  `dismantle()`, and `claimController()` on their public API.

### 19.3 Enable Room
- [ ] `POWERCREEP-ENABLE-001` `behavior` `verified_vanilla`
  A successful `powerCreep.enableRoom(controller)` returns `OK` and sets
  `controller.isPowerEnabled` to `true` on the next tick.
- [ ] `POWERCREEP-ENABLE-002` `matrix` `verified_vanilla`
  `powerCreep.enableRoom()` failure codes match the canonical validation
  matrix for invalid target, safe-mode-blocked hostile controller, range,
  busy, and ownership.

### 19.4 Operate Powers
- [ ] `POWER-OPERATE-001` `matrix` `verified_vanilla`
  Operate power effect magnitudes match `POWER_INFO[power].effect[level]` for
  all numeric operate powers and supported power levels.
- [ ] `POWER-OPERATE-002` `matrix` `verified_vanilla`
  Operate power `cooldown`, `range`, and `ops` cost match `POWER_INFO` for each
  operate power.
- [ ] `POWER-OPERATE-003` `behavior` `needs_vanilla_verification`
  `PWR_OPERATE_OBSERVER` allows `observeRoom()` beyond the observer's normal
  range while the effect is active.
- [ ] `POWER-OPERATE-004` `behavior` `needs_vanilla_verification`
  `PWR_OPERATE_FACTORY` changes the target factory's effective production level
  according to the power level while the effect is active.
- [ ] `POWER-OPERATE-005` `matrix` `needs_vanilla_verification`
  For room-bound operate powers, target validity and failure in rooms without
  power enabled match the canonical power-to-target matrix.

Coverage Notes
- The production consequences of `PWR_OPERATE_FACTORY` are owned by `11.5
  Factory Commodity Chains`.

### 19.5 Disrupt Powers
- [ ] `POWER-DISRUPT-001` `matrix` `verified_vanilla`
  Disrupt power effect values and durations match `POWER_INFO` for each disrupt
  power and supported power level.
- [ ] `POWER-DISRUPT-002` `matrix` `verified_vanilla`
  Disrupt power `cooldown`, `range`, and `ops` cost match `POWER_INFO` for
  each disrupt power.
- [ ] `POWER-DISRUPT-003` `matrix` `needs_vanilla_verification`
  For disrupt powers with structure targets, target acceptance and
  invalid-target behavior match the canonical power-to-target matrix.

### 19.6 Regen Powers
- [ ] `POWER-REGEN-001` `matrix` `verified_vanilla`
  Regen power effect amount, period, and duration match `POWER_INFO` for each
  regen power and supported power level.
- [ ] `POWER-REGEN-002` `matrix` `verified_vanilla`
  Regen power `cooldown`, `range`, and `ops` cost match `POWER_INFO` for each
  regen power.

### 19.7 Combat Powers
- [ ] `POWER-COMBAT-001` `matrix` `verified_vanilla`
  `PWR_SHIELD` and `PWR_FORTIFY` effect magnitudes match `POWER_INFO` for each
  supported power level.
- [ ] `POWER-COMBAT-002` `behavior` `verified_vanilla`
  A successful `usePower(PWR_SHIELD)` returns `OK` and creates a temporary
  rampart at the power creep's position in the same tick.
- [ ] `POWER-COMBAT-003` `behavior` `needs_vanilla_verification`
  The rampart created by `PWR_SHIELD` is removed when the shield effect
  expires.

### 19.8 Generate Ops
- [ ] `POWER-GENERATE-OPS-001` `matrix` `verified_vanilla`
  `PWR_GENERATE_OPS` amount, cooldown, and ops cost match `POWER_INFO` for
  each supported power level.
- [ ] `POWER-GENERATE-OPS-002` `behavior` `verified_vanilla`
  A successful `usePower(PWR_GENERATE_OPS)` returns `OK` and adds ops to the
  power creep's store in the same tick.
- [ ] `POWER-GENERATE-OPS-003` `behavior` `verified_vanilla`
  If generated ops would overflow the power creep's store capacity, the excess
  is dropped on the same tile in the same tick.

---

## 20. Market `capability: market`

### 20.1 Terminal Send
Coverage Notes
- Terminal `send()` behavior is owned by `13.3 Terminal`.
- `Game.market.calcTransactionCost()` is covered under `20.4 Queries`.

### 20.2 Orders
- [ ] `MARKET-ORDER-001` `matrix` `verified_vanilla`
  Successful `createOrder()` cases create an order with the requested type,
  resource type, price, amount, and room for the canonical order-creation
  matrix.
- [ ] `MARKET-ORDER-002` `matrix` `verified_vanilla`
  `createOrder()` failure codes match the canonical validation matrix for
  invalid arguments, insufficient credits, missing owned terminal, and order
  cap.
- [ ] `MARKET-ORDER-003` `behavior` `verified_vanilla`
  A successful `cancelOrder()` returns `OK` and removes the order so it no
  longer appears in market queries.
- [ ] `MARKET-ORDER-004` `behavior` `verified_vanilla`
  `cancelOrder()` returns `ERR_INVALID_ARGS` when the order is not one of the
  caller's current orders.
- [ ] `MARKET-ORDER-005` `behavior` `verified_vanilla`
  `changeOrderPrice()` updates the order price visible to later market queries.
- [ ] `MARKET-ORDER-006` `matrix` `verified_vanilla`
  `changeOrderPrice()` failure codes match the canonical validation matrix for
  missing order, invalid price, and insufficient credits for the additional
  fee.
- [ ] `MARKET-ORDER-007` `behavior` `verified_vanilla`
  `extendOrder()` increases the remaining amount on an existing order.
- [ ] `MARKET-ORDER-008` `matrix` `verified_vanilla`
  `extendOrder()` failure codes match the canonical validation matrix for
  missing order, invalid added amount, and insufficient credits for the
  extension fee.

Notes
- Order lifetime and expiry should be specified through observable query
  behavior rather than only by restating MARKET_ORDER_LIFE_TIME.

### 20.3 Deal
- [ ] `MARKET-DEAL-001` `behavior` `verified_vanilla`
  A successful `Game.market.deal()` returns `OK` and executes a trade against
  the specified order.
- [ ] `MARKET-DEAL-002` `behavior` `verified_vanilla`
  For terminal-based deals, the energy transfer cost is paid by the caller's
  terminal, not the order owner's terminal.
- [ ] `MARKET-DEAL-003` `matrix` `verified_vanilla`
  `Game.market.deal()` failure codes match the canonical validation matrix for
  invalid arguments, missing owned terminal, insufficient terminal energy,
  terminal cooldown, insufficient traded resource, insufficient credits, and
  per-tick deal cap.

Notes
- `deal()` returns `ERR_FULL` when the per-tick cap is exceeded; it is not a
  silent no-op.
- Market fees are owned by order creation, price change, and extension, not by
  `deal()`.

### 20.4 Queries
- [ ] `MARKET-QUERY-001` `behavior` `verified_vanilla`
  `Game.market.calcTransactionCost(amount, roomName1, roomName2)` returns
  `ceil(amount * (1 - exp(-distance / 30)))`, where `distance` is the room
  distance between the two rooms.
- [ ] `MARKET-QUERY-002` `behavior` `verified_vanilla`
  `Game.market.getAllOrders(filter?)` returns orders matching the supplied
  filter.
- [ ] `MARKET-QUERY-003` `behavior` `verified_vanilla`
  `Game.market.getOrderById(id)` returns the specified order or `null` when it
  does not exist.
- [ ] `MARKET-QUERY-004` `behavior` `verified_vanilla`
  `Game.market.getHistory(resourceType?)` returns market history for the
  requested resource scope.
- [ ] `MARKET-QUERY-005` `behavior` `verified_vanilla`
  Exposed order prices and market credits use public credit units rather than
  the engine's internal milli-credit storage.

---

## 21. Map

### 21.1 Room Queries
- [ ] `MAP-ROOM-001` `behavior` `verified_vanilla`
  `Game.map.describeExits(roomName)` returns only exit direction keys with
  adjacent room names as values for a valid room name, or `null` for an
  invalid room name.
- [ ] `MAP-ROOM-002` `behavior` `verified_vanilla`
  `Game.map.getRoomLinearDistance(roomA, roomB)` returns the room-grid
  Manhattan distance between the two rooms.
- [ ] `MAP-ROOM-003` `behavior` `verified_vanilla`
  `Game.map.getRoomLinearDistance(roomA, roomB, true)` allows distance to wrap
  across opposite world edges before taking the shorter path.
- [ ] `MAP-ROOM-004` `matrix` `verified_vanilla`
  `Game.map.getRoomStatus(roomName)` returns the canonical status and timestamp
  mapping for normal, novice, respawn, and closed rooms.
- [ ] `MAP-ROOM-005` `behavior` `verified_vanilla`
  `Game.map.getWorldSize()` returns the world size as the number of rooms along
  one edge of the world map.

### 21.2 Route Finding
- [ ] `MAP-ROUTE-001` `behavior` `verified_vanilla`
  `Game.map.findRoute(fromRoom, toRoom)` returns an array of `{exit, room}`
  steps for a found route.
- [ ] `MAP-ROUTE-002` `behavior` `verified_vanilla`
  `Game.map.findRoute(fromRoom, toRoom)` returns `ERR_NO_PATH` for invalid room
  names or when no route exists.
- [ ] `MAP-ROUTE-003` `behavior` `verified_vanilla`
  `Game.map.findRoute(fromRoom, toRoom, {routeCallback})` excludes rooms whose
  callback cost is `Infinity` from routing.
- [ ] `MAP-ROUTE-004` `behavior` `verified_vanilla`
  `Game.map.findExit(fromRoom, toRoom)` returns the first route step's exit
  constant for a found route.
- [ ] `MAP-ROUTE-005` `behavior` `verified_vanilla`
  `Game.map.findExit(fromRoom, toRoom)` returns `ERR_NO_PATH` when no route
  exists and `ERR_INVALID_ARGS` when the rooms are the same.

### 21.3 Terrain
- [ ] `MAP-TERRAIN-001` `behavior` `verified_vanilla`
  `Game.map.getRoomTerrain(roomName)` returns terrain access for visible and
  non-visible rooms alike.

---

## 22. RoomPosition

### 22.1 Construction & Properties
- [ ] `ROOMPOS-001` `behavior` `verified_vanilla`
  A `RoomPosition` exposes `x`, `y`, and `roomName`.
- [ ] `ROOMPOS-002` `behavior` `verified_vanilla`
  `RoomPosition` coordinates are limited to the inclusive `0..49` range within
  a room.

### 22.2 Spatial Queries
- [ ] `ROOMPOS-SPATIAL-001` `behavior` `verified_vanilla`
  `getRangeTo()` returns Chebyshev distance to a target in the same room.
- [ ] `ROOMPOS-SPATIAL-002` `behavior` `verified_vanilla`
  `inRangeTo()` returns `true` when the target is within the specified range.
- [ ] `ROOMPOS-SPATIAL-003` `behavior` `verified_vanilla`
  `isNearTo()` returns `true` when the target is within range `1`.
- [ ] `ROOMPOS-SPATIAL-004` `behavior` `verified_vanilla`
  `isEqualTo()` returns `true` when the target is on the same tile.
- [ ] `ROOMPOS-SPATIAL-005` `matrix` `verified_vanilla`
  `getDirectionTo()` returns the expected Screeps direction constant for the
  canonical direction-offset matrix.
- [ ] `ROOMPOS-SPATIAL-006` `behavior` `verified_vanilla`
  `getRangeTo()` returns `Infinity` for a target in another room.

### 22.3 Find Helpers
- [ ] `ROOMPOS-FIND-001` `behavior` `verified_vanilla`
  `findClosestByPath()` returns a target already on the same tile before
  considering other targets.
- [ ] `ROOMPOS-FIND-002` `behavior` `verified_vanilla`
  `findClosestByPath()` ignores unreachable targets.
- [ ] `ROOMPOS-FIND-003` `behavior` `verified_vanilla`
  `findClosestByRange()` returns the target with the smallest linear range.
- [ ] `ROOMPOS-FIND-004` `behavior` `verified_vanilla`
  `findInRange()` returns all matching objects within the given range.
- [ ] `ROOMPOS-FIND-005` `behavior` `verified_vanilla`
  `findPathTo()` returns a path from this position to the target.
- [ ] `ROOMPOS-FIND-006` `behavior` `verified_vanilla`
  `opts.filter` applies to the candidate set for the RoomPosition find helper
  methods that accept it.

### 22.4 Look
- [ ] `ROOMPOS-LOOK-001` `behavior` `verified_vanilla`
  `look()` returns an array of `{type, ...}` records for the objects and
  terrain at this position.
- [ ] `ROOMPOS-LOOK-002` `behavior` `verified_vanilla`
  `lookFor(type)` returns an array of values for the requested `LOOK_*` type at
  this position.
- [ ] `ROOMPOS-LOOK-003` `behavior` `verified_vanilla`
  `lookFor(type)` returns an empty array when no entries of that type exist at
  this position.

### 22.5 Actions
- [ ] `ROOMPOS-ACTION-001` `behavior` `verified_vanilla`
  A successful `RoomPosition.createConstructionSite()` returns `OK` and creates
  the construction site at the RoomPosition's coordinates on the next tick.
- [ ] `ROOMPOS-ACTION-002` `behavior` `verified_vanilla`
  A successful `RoomPosition.createFlag()` returns the flag name and creates
  the flag at the RoomPosition's coordinates in the same tick.

---

## 23. Store API

### 23.1 Resource Access
- [ ] `STORE-ACCESS-001` `behavior` `verified_vanilla`
  `store[RESOURCE_TYPE]` returns the stored amount for that resource, or `0`
  when the store currently holds none of it.
- [ ] `STORE-ACCESS-002` `behavior` `verified_vanilla`
  `store.getCapacity(type)`, `store.getUsedCapacity(type)`, and
  `store.getFreeCapacity(type)` return `null` when the store cannot hold that
  resource type.

### 23.2 Open Stores
- [ ] `STORE-OPEN-001` `matrix` `verified_vanilla`
  For open stores, all stored resources share one total capacity pool.
- [ ] `STORE-OPEN-002` `matrix` `verified_vanilla`
  Open-store capacity constants match the canonical Screeps capacities for
  storage, terminal, container, and factory.
- [ ] `STORE-OPEN-003` `matrix` `verified_vanilla`
  For open stores, `getCapacity()`, `getUsedCapacity()`, and
  `getFreeCapacity()` without a resource argument report the shared total,
  shared used amount, and shared remaining capacity.

### 23.3 Single-Resource Stores
- [ ] `STORE-SINGLE-001` `matrix` `verified_vanilla`
  Single-resource stores accept only their configured resource type for
  canonical single-store structures, including spawn, extension, tower, and
  link.
- [ ] `STORE-SINGLE-002` `matrix` `verified_vanilla`
  Single-store capacity constants match the canonical Screeps capacities for
  spawn, extension by RCL, tower, and link.
- [ ] `STORE-SINGLE-003` `matrix` `verified_vanilla`
  For single-resource stores, `getCapacity(type)`, `getUsedCapacity(type)`,
  and `getFreeCapacity(type)` return numeric values for the configured
  resource type.
- [ ] `STORE-SINGLE-004` `matrix` `verified_vanilla`
  For single-resource stores, `getCapacity()`, `getUsedCapacity()`, and
  `getFreeCapacity()` without a resource argument return `null`.

### 23.4 Restricted Stores
- [ ] `STORE-RESTRICTED-001` `matrix` `verified_vanilla`
  For restricted stores, each allowed resource type has its own capacity
  limit.
- [ ] `STORE-RESTRICTED-002` `matrix` `verified_vanilla`
  Restricted-store capacity constants match the canonical Screeps capacities
  for lab, power spawn, and nuker.
- [ ] `STORE-RESTRICTED-003` `matrix` `verified_vanilla`
  For restricted stores, `getCapacity(type)`, `getUsedCapacity(type)`, and
  `getFreeCapacity(type)` return numeric values for allowed resource types.
- [ ] `STORE-RESTRICTED-004` `matrix` `verified_vanilla`
  For restricted stores, `getCapacity(type)`, `getUsedCapacity(type)`, and
  `getFreeCapacity(type)` return `null` for disallowed resource types.
- [ ] `STORE-RESTRICTED-005` `matrix` `verified_vanilla`
  For restricted stores, `getCapacity()`, `getUsedCapacity()`, and
  `getFreeCapacity()` without a resource argument return `null`.

### 23.5 Timer Models
- [ ] `TIMER-COOLDOWN-001` `behavior` `needs_vanilla_verification`
  For APIs gated by `cooldownTime`, the action becomes available in the same
  tick the exposed cooldown reaches `0`.
- [ ] `TIMER-SAFEMODE-001` `behavior` `needs_vanilla_verification`
  Effects gated by `safeMode` stop blocking in the same tick the exposed safe
  mode timer reaches `0`.

Coverage Notes
- Shared timer rules should not be treated as settled until their full
  applicability inventory is explicit and verified.
- `endTime` effect expiration is not one shared timer model; some checks use
  `endTime > time` while others use `endTime >= time`, so those behaviors should
  stay with their local mechanics.
- `decayTime`, `nextDecayTime`, `spawnTime`, and `landTime` also use
  family-specific edge conditions and should stay local unless a stricter shared
  sub-model emerges.

---

## 24. Intent Resolution

### 24.1 Creep Action Priority
- [ ] `INTENT-CREEP-001` `matrix` `verified_vanilla`
  For each method pair listed under `INTENT-CREEP-001` in
  `docs/behavior-matrices.md`, the higher-priority blocking creep intent
  prevents the lower-priority intent from resolving in the same tick.
- [ ] `INTENT-CREEP-005` `matrix` `needs_vanilla_verification`
  For creep methods with single-intent overwrite semantics, repeated same-tick
  calls keep only the last intent for that method.
- [ ] `INTENT-CREEP-006` `matrix` `needs_vanilla_verification`
  For creep methods that support `cancelOrder(methodName)`, canceling a queued
  same-tick intent prevents that method's intent from resolving.

Coverage Notes
- `move()` and `heal()` compatibility with the blocking creep action priority
  chain should be expressed through concrete same-tick scenarios rather than as
  abstract independence claims.
- Non-blocking action combinations should be captured through concrete
  compatibility scenarios rather than as one umbrella sentence.

### 24.2 Same-Tick Resource Visibility
- [ ] `INTENT-RESOURCE-001` `behavior` `needs_vanilla_verification`
  Resources gained by `withdraw()` are not available to other actions by that
  creep until the next tick.
- [ ] `INTENT-RESOURCE-002` `behavior` `needs_vanilla_verification`
  `transfer()` removes resources from the sender in the same tick, but the
  recipient does not receive the resources until the next tick.
- [ ] `INTENT-RESOURCE-003` `behavior` `needs_vanilla_verification`
  When multiple same-tick actions compete for the same stored resource, each
  action resolves against the creep's tick-start resources.
- [ ] `INTENT-RESOURCE-004` `behavior` `needs_vanilla_verification`
  When same-tick capacity conflicts exist between these actions, `withdraw()`
  is preferred over `pickup()` and `pickup()` is preferred over `transfer()`.

### 24.3 Intent Limits
- [ ] `INTENT-LIMIT-001` `matrix` `verified_vanilla`
  Per-tick intent caps for market and power-creep management actions match the
  canonical Screeps limit table.
- [ ] `INTENT-LIMIT-002` `matrix` `needs_vanilla_verification`
  For each capped intent family, calls beyond the per-tick cap return `OK` but
  do not take effect.

### 24.4 Simultaneous Actions
- [ ] `INTENT-SIMULT-001` `behavior` `needs_vanilla_verification`
  `move()`, `rangedMassAttack()`, and `heal()` can all execute in the same
  tick on the same creep.
- [ ] `INTENT-SIMULT-004` `behavior` `needs_vanilla_verification`
  `heal()` on a healthy creep returns `OK` and still blocks lower-priority
  actions in the blocking creep action chain.

Coverage Notes
- Same-pipeline exclusions already implied by `24.2 Creep Action Priority`
  should not be duplicated here.

---

## 25. Memory

### 25.1 Main Memory
- [ ] `MEMORY-001` `behavior` `verified_vanilla`
  If `RawMemory.set()` is called before the first `Memory` access in a tick,
  the first `Memory` access reflects the new raw memory string.
- [ ] `MEMORY-002` `behavior` `verified_vanilla`
  After `Memory` has been accessed in a tick, later `RawMemory.set()` calls do
  not replace the already-parsed `Memory` object for that tick.
- [ ] `MEMORY-003` `behavior` `verified_vanilla`
  If `Memory` was parsed or mutated during the tick, it is serialized back to
  `RawMemory` at tick end.
- [ ] `MEMORY-004` `behavior` `verified_vanilla`
  `RawMemory.set()` throws when the raw memory string exceeds the `2 MB`
  limit.

### 25.2 RawMemory
- [ ] `RAWMEMORY-001` `behavior` `verified_vanilla`
  `RawMemory.get()` returns the current raw memory string.
- [ ] `RAWMEMORY-002` `behavior` `verified_vanilla`
  `RawMemory.set(value)` replaces the raw memory string when `value` is a
  string within the size limit.
- [ ] `RAWMEMORY-003` `matrix` `verified_vanilla`
  Raw memory segment ids, per-segment size limit, and active-segment count
  limits match the canonical memory-segment limits.
- [ ] `RAWMEMORY-004` `behavior` `verified_vanilla`
  After `RawMemory.setActiveSegments(ids)`, those segment ids become the active
  `RawMemory.segments` set on the next tick.
- [ ] `RAWMEMORY-005` `behavior` `verified_vanilla`
  `RawMemory.segments[id]` exposes the content of currently active segments.

### 25.3 Foreign Segments
- [ ] `RAWMEMORY-FOREIGN-001` `behavior` `verified_vanilla`
  `RawMemory.setActiveForeignSegment(username, id?)` does not replace
  `RawMemory.foreignSegment` in the same tick.
- [ ] `RAWMEMORY-FOREIGN-002` `behavior` `verified_vanilla`
  `RawMemory.foreignSegment` exposes `{username, id, data}` when a foreign
  segment is available.
- [ ] `RAWMEMORY-FOREIGN-003` `behavior` `verified_vanilla`
  After `RawMemory.setPublicSegments(ids)`, only those segment ids are exposed
  as the player's public segments to foreign-segment readers.
- [ ] `RAWMEMORY-FOREIGN-004` `behavior` `verified_vanilla`
  After `RawMemory.setDefaultPublicSegment(id)`, foreign-segment readers
  without an explicit id receive that segment by default.

---

## Summary

Coverage counts are temporarily omitted. The facet and behavior totals need to
be recomputed after the current normalization pass is complete.

### Deliberately excluded (per spec.md non-goals):
- CPU/heap metrics (engine-specific values)
- Multi-shard mechanics (InterShardMemory)
- Seasonal/event-specific scoring
- Server administration (auth, scaling)
- Visual APIs (RoomVisual, MapVisual) — no gameplay effect
- `Game.notify()` — side effect, not gameplay
