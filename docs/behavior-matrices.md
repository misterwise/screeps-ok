# screeps-ok Matrix Definitions

This document is the companion definition layer for matrix-backed catalog
entries and scoped shared-rule families from `behaviors.md`.

It exists to answer questions that do not belong inline in the behavioral
catalog:

- what the canonical source of truth is
- what dimensions the generated family actually spans
- where the rule applies
- what is intentionally excluded or still incomplete

This file should stay narrow. It is not a second planning backlog.

Where a matrix family is actively exercised by the test suite, keep the
executable case list in `src/matrices/*` and keep this document as
the human-readable scope/source definition.

## Entry Format

Each definition should include:

- `Catalog Entries`
- `Canonical Source`
- `Dimensions`
- `Applicability`
- `Exclusions`
- `Verification Notes`

## Definitions

### STORE-OPEN

- `Catalog Entries`
  `STORE-OPEN-001`, `STORE-OPEN-002`, `STORE-OPEN-003`
- `Canonical Source`
  Official store model in `@screeps/engine/src/game/store.js`,
  `capacityForResource()` in `@screeps/engine/src/utils.js`, and canonical
  Screeps capacity constants.
- `Dimensions`
  structure type, resource type, no-argument Store API call shape
- `Applicability`
  `StructureStorage`, `StructureTerminal`, `StructureContainer`,
  `StructureFactory`
- `Exclusions`
  Structures with per-resource capacity maps or one-resource stores
- `Verification Notes`
  Scope is intended to be complete for the current open-store family. The
  executable case list lives in `src/matrices/store-open.ts`.

### STORE-SINGLE

- `Catalog Entries`
  `STORE-SINGLE-001`, `STORE-SINGLE-002`, `STORE-SINGLE-003`,
  `STORE-SINGLE-004`
- `Canonical Source`
  Official store model in `@screeps/engine/src/game/store.js`,
  `capacityForResource()` in `@screeps/engine/src/utils.js`, and canonical
  Screeps capacity constants.
- `Dimensions`
  structure type, allowed resource, no-argument Store API call shape
- `Applicability`
  `StructureSpawn`, `StructureExtension`, `StructureTower`, `StructureLink`
- `Exclusions`
  Restricted stores and shared-capacity stores
- `Verification Notes`
  Extension capacity varies by controller level and is part of this family. The
  executable case list lives in `src/matrices/store-single.ts`.

### STORE-RESTRICTED

- `Catalog Entries`
  `STORE-RESTRICTED-001`, `STORE-RESTRICTED-002`, `STORE-RESTRICTED-003`,
  `STORE-RESTRICTED-004`, `STORE-RESTRICTED-005`
- `Canonical Source`
  Official store model in `@screeps/engine/src/game/store.js`,
  `capacityForResource()` in `@screeps/engine/src/utils.js`, and canonical
  Screeps capacity constants.
- `Dimensions`
  structure type, allowed resource set, per-resource capacity, no-argument
  Store API call shape
- `Applicability`
  `StructureLab`, `StructurePowerSpawn`, `StructureNuker`
- `Exclusions`
  Open stores and single-resource stores
- `Verification Notes`
  Lab remains part of this family even though its allowed mineral type can
  change at runtime. The executable case list lives in
  `src/matrices/store-restricted.ts`.

### LAB-RUN

- `Catalog Entries`
  `LAB-RUN-001`
- `Canonical Source`
  `REACTIONS`, official `StructureLab.runReaction()`, and the lab reaction
  processor.
- `Dimensions`
  reagent mineral in `lab1`, reagent mineral in `lab2`
- `Applicability`
  Valid `runReaction(lab1, lab2)` calls on an owned, active lab with two
  distinct reagent labs in range and enough mineral capacity/resources
- `Exclusions`
  Reverse reactions, cooldown behavior, and error-code precedence
- `Verification Notes`
  This matrix is about the product mapping only. Amount, cooldown, and failure
  behavior are owned by the `LAB-RUN-002` through `LAB-RUN-012` entries. The
  executable case list lives in `src/matrices/lab-run.ts`.

### FACTORY-COMMODITY

- `Catalog Entries`
  `FACTORY-COMMODITY-001`
- `Canonical Source`
  `COMMODITIES`, official `StructureFactory.produce()`, and the factory produce
  processor.
- `Dimensions`
  commodity resource type, required factory level, commodity chain membership
- `Applicability`
  All commodity resources producible through `StructureFactory.produce()`
- `Exclusions`
  Non-factory resources, recipe input/output amounts, cooldown, and error-code
  behavior
- `Verification Notes`
  Factory level mismatch errors are not part of this matrix; they belong to the
  `FACTORY-PRODUCE-*` entries. The executable case list lives in
  `src/matrices/factory-commodity.ts`.

### ROAD-DECAY

- `Catalog Entries`
  `ROAD-DECAY-001`
- `Canonical Source`
  Official road decay processor and canonical terrain-related road decay
  constants.
- `Dimensions`
  underlying terrain category
- `Applicability`
  Plain, swamp, and wall terrain under a road tile
- `Exclusions`
  Initial road hit totals and movement wear timing
- `Verification Notes`
  This matrix only covers periodic decay amount by terrain. The executable case
  list lives in `src/matrices/road-decay.ts`.

### TIMER-COOLDOWN

- `Catalog Entries`
  `TIMER-COOLDOWN-001`
- `Canonical Source`
  Official `cooldownTime` getters and action-gating checks across the engine.
- `Dimensions`
  API family using `cooldownTime`
- `Applicability`
  Verified examples currently include labs, terminals, factories, deposits, and
  power-creep powers.
- `Exclusions`
  `endTime`, `safeMode`, `decayTime`, `nextDecayTime`, `spawnTime`, and
  `landTime`
- `Verification Notes`
  Applicability inventory is intentionally incomplete. This shared rule must
  remain `needs_vanilla_verification` until the full set of `cooldownTime`-gated
  APIs is enumerated and checked.

### NPC-OWNERSHIP

- `Catalog Entries`
  `NPC-OWNERSHIP-001`
- `Canonical Source`
  Official public structure definitions in `@screeps/engine/src/game/structures.js`.
- `Dimensions`
  NPC structure class, queried property
- `Applicability`
  `StructureKeeperLair`, `StructurePowerBank`, `StructureInvaderCore`
- `Exclusions`
  Owner-gated API behavior such as `destroy()` or `notifyWhenAttacked()`
- `Verification Notes`
  Current expected mapping is:
  keeper lair -> `my === false`, `owner.username === "Source Keeper"`;
  power bank -> `my === false`, `owner.username === "Power Bank"`;
  invader core -> inherited `OwnedStructure` `my` / `owner` behavior from its
  `user`. The executable case list lives in
  `src/matrices/npc-ownership.ts`.

### INTENT-CREEP-PRIORITY

- `Catalog Entries`
  `INTENT-CREEP-001`
- `Canonical Source`
  Official creep intent resolution in
  `@screeps/engine/src/processor/intents/creeps/intents.js`.
- `Dimensions`
  higher-priority method, lower-priority method
- `Applicability`
  Same-tick intent pairs in the blocking creep action family:
  `rangedHeal`, `attackController`, `dismantle`, `repair`, `build`, `attack`,
  `harvest`, `rangedMassAttack`, `rangedAttack`, and `heal` where applicable
  as a blocker.
- `Exclusions`
  `move()` and `heal()` compatibility scenarios outside the blocking exclusion
  table, overwrite semantics, and `cancelOrder(methodName)` behavior.
- `Verification Notes`
  This family is a pairwise exclusion table, not one total global ordering.
  Current official exclusions are:
  `rangedHeal` blocks `heal`;
  `attackController` blocks `rangedHeal`, `heal`;
  `dismantle` blocks `attackController`, `rangedHeal`, `heal`;
  `repair` blocks `dismantle`, `attackController`, `rangedHeal`, `heal`;
  `build` blocks `repair`, `dismantle`, `attackController`, `rangedHeal`,
  `heal`;
  `attack` blocks `build`, `repair`, `dismantle`, `attackController`,
  `rangedHeal`, `heal`;
  `harvest` blocks `attack`, `build`, `repair`, `dismantle`,
  `attackController`, `rangedHeal`, `heal`;
  `rangedMassAttack` blocks `build`, `repair`, `rangedHeal`;
  `rangedAttack` blocks `rangedMassAttack`, `build`, `repair`, `rangedHeal`.
  The executable case list lives in
  `src/matrices/intent-creep-priority.ts`.

### CTRL-SAFEMODE-BLOCKED

- `Catalog Entries`
  `CTRL-SAFEMODE-006`
- `Canonical Source`
  Official safe-mode checks in hostile creep combat and dismantle processors.
- `Dimensions`
  hostile action method
- `Applicability`
  `attack()`, `rangedAttack()`, `rangedMassAttack()`, `dismantle()`
- `Exclusions`
  Safe-mode activation requirements, movement restrictions, and non-hostile
  actions
- `Verification Notes`
  This family remains `needs_vanilla_verification` until each blocked action is
  exercised as a concrete scenario. The executable case list lives in
  `src/matrices/ctrl-safemode-blocked.ts`.

### CTRL-STRUCTLIMIT

- `Catalog Entries`
  `CTRL-STRUCTLIMIT-001`
- `Canonical Source`
  `CONTROLLER_STRUCTURES` and official `isActive()` / controller-limit checks.
- `Dimensions`
  structure type, controller level
- `Applicability`
  Owned structures governed by `CONTROLLER_STRUCTURES`, including constant-limit
  families such as roads, containers, walls, and ramparts
- `Exclusions`
  Distance-to-controller tie-breaking between same-type structures
- `Verification Notes`
  This matrix covers the allowed active count only. Inactive-above-limit
  behavior is owned by `CTRL-STRUCTLIMIT-002`. The executable case list lives
  in `src/matrices/ctrl-structlimit.ts`.

### TOWER-RANGE

- `Catalog Entries`
  `TOWER-ATTACK-002`, `TOWER-HEAL-002`, `TOWER-REPAIR-002`
- `Canonical Source`
  Tower constants and official tower attack, heal, and repair processors.
- `Dimensions`
  tower action, target range band
- `Applicability`
  `tower.attack()`, `tower.heal()`, `tower.repair()`
- `Exclusions`
  Energy cost, intent priority, target validity, and tower power effects
- `Verification Notes`
  This family covers falloff/output by range only. The current generated suite
  uses representative exact cases at range `3`, `10`, and `20` to cover close,
  interpolated, and max-falloff behavior. The executable case list lives in
  `src/matrices/tower-range.ts`.

### TOWER-TARGETS

- `Catalog Entries`
  `TOWER-ATTACK-003`, `TOWER-HEAL-003`, `TOWER-REPAIR-003`
- `Canonical Source`
  Official tower API validation and tower action processors.
- `Dimensions`
  tower action, target class
- `Applicability`
  Target classes relevant to attackable, healable, and repairable objects
- `Exclusions`
  Range falloff and tower intent priority
- `Verification Notes`
  This family remains `needs_vanilla_verification` until the target-class
  inventory is written as concrete accepted and rejected cases.

### TOWER-POWER

- `Catalog Entries`
  `TOWER-POWER-001`
- `Canonical Source`
  `POWER_INFO` and official tower power-effect handling.
- `Dimensions`
  power (`PWR_OPERATE_TOWER` / `PWR_DISRUPT_TOWER`), power level, tower action
- `Applicability`
  Tower attack, heal, and repair power under active tower power effects
- `Exclusions`
  Whether both effects can coexist on the same tower
- `Verification Notes`
  Coexistence is owned by `TOWER-POWER-002`. The executable case list lives in
  `src/matrices/tower-power.ts`.

### COMBAT-RMA

- `Catalog Entries`
  `COMBAT-RMA-002`
- `Canonical Source`
  `RANGED_ATTACK_POWER` and `RANGED_ATTACK_DISTANCE_RATE` constants and the
  official `rangedMassAttack` processor in `@screeps/engine`.
- `Dimensions`
  target range band (1, 2, 3)
- `Applicability`
  `creep.rangedMassAttack()` damage against hostile creeps, power creeps, and
  structures within range 3
- `Exclusions`
  Multi-target aggregation, friendly exclusion, body-part aggregation across
  multiple `RANGED_ATTACK` parts, and boost interactions
- `Verification Notes`
  The executable case list lives in
  `src/matrices/ranged-mass-attack.ts`. Expected damage is computed
  from `RANGED_ATTACK_POWER * RANGED_ATTACK_DISTANCE_RATE[range]` so that the
  oracle stays independent of the engine under test.

### BOOST-AGGREGATION

- `Catalog Entries`
  `BOOST-AGGREGATION-001`
- `Canonical Source`
  Official body-effect calculation helpers and action processors.
- `Dimensions`
  mechanic, body composition with mixed boosted and unboosted active parts
- `Applicability`
  Additive mechanics: attack, ranged attack, heal, harvest, build, repair,
  dismantle, upgrade, move, and carry capacity
- `Exclusions`
  `TOUGH`, boost application/removal, and per-compound magnitudes
- `Verification Notes`
  This family is about per-part summation, not the numeric multipliers
  themselves. The executable case list lives in
  `src/matrices/boost-aggregation.ts`.

### BOOST-TABLES

- `Catalog Entries`
  `BOOST-ATTACK-001`, `BOOST-RANGED-001`, `BOOST-HEAL-001`,
  `BOOST-TOUGH-001`, `BOOST-HARVEST-001`, `BOOST-BUILD-001`,
  `BOOST-DISMANTLE-001`, `BOOST-UPGRADE-001`, `BOOST-MOVE-001`,
  `BOOST-CARRY-001`
- `Canonical Source`
  `BOOSTS` and the official action processors that consume those effects.
- `Dimensions`
  body part type, compound, affected mechanic
- `Applicability`
  All reviewed boost families in section `8`
- `Exclusions`
  Mixed-part aggregation and boost application/removal costs
- `Verification Notes`
  Numeric boost magnitudes are owned here; mechanic-specific non-table rules
  remain in the local boost facets. The executable case list lives in
  `src/matrices/boost-tables.ts`.

### CREEP-DEATH-SOURCES

- `Catalog Entries`
  `CREEP-DEATH-008`
- `Canonical Source`
  Official creep death helper and death-source processors.
- `Dimensions`
  death source
- `Applicability`
  Ordinary player-creep death sources that produce standard tombstones,
  currently including `ticksToLive` expiry and `suicide()`
- `Exclusions`
  Nonstandard NPC death paths and power creep death
- `Verification Notes`
  This family exists to ensure equivalent tombstone handling across multiple
  death sources, even if vanilla currently shares a helper. The current
  generated suite covers `suicide()` and `ticksToLive` expiry for carried
  resource preservation only; reclaimed body energy remains source-specific.
  The executable case list lives in
  `src/matrices/creep-death-sources.ts`.

### CONTAINER-DECAY

- `Catalog Entries`
  `CONTAINER-001`
- `Canonical Source`
  Official container tick processor and container constants.
- `Dimensions`
  room ownership state
- `Applicability`
  Owned-room and unowned-room containers
- `Exclusions`
  Store semantics and destruction spill
- `Verification Notes`
  This matrix covers both decay amount and decay interval by room state. The
  executable case list lives in `src/matrices/container-decay.ts`.

### LAB-REVERSE

- `Catalog Entries`
  `LAB-REVERSE-001`
- `Canonical Source`
  `REACTIONS`, official `StructureLab.reverseReaction()`, and the reverse
  reaction processor.
- `Dimensions`
  compound mineral, resulting reagent pair
- `Applicability`
  Reversible compounds in labs
- `Exclusions`
  Cooldown, throughput amount, and error-code behavior
- `Verification Notes`
  This family covers the reverse mapping only. The executable case list lives
  in `src/matrices/lab-reverse.ts`.

### FACTORY-PRODUCE

- `Catalog Entries`
  `FACTORY-PRODUCE-001`
- `Canonical Source`
  `COMMODITIES`, official `StructureFactory.produce()`, and the factory
  processor.
- `Dimensions`
  produced resource type, component map, output amount
- `Applicability`
  All resources producible through `StructureFactory.produce()`
- `Exclusions`
  Cooldown, level gating, and error-code behavior
- `Verification Notes`
  This family covers recipe consumption and output amount only. The executable
  case list lives in `src/matrices/factory-produce.ts`.

### RAMPART-HITSMAX

- `Catalog Entries`
  `RAMPART-DECAY-003`
- `Canonical Source`
  `RAMPART_HITS_MAX` and official rampart/max-hit handling.
- `Dimensions`
  room controller level
- `Applicability`
  Owned ramparts by controller level
- `Exclusions`
  Decay timing and temporary ramparts from power effects
- `Verification Notes`
  Initial construction hits remain outside this family. The executable case list
  lives in `src/matrices/rampart-hitsmax.ts`.

### ROAD-WEAR

- `Catalog Entries`
  `ROAD-WEAR-001`
- `Canonical Source`
  Official movement processor and road wear constants.
- `Dimensions`
  mover type, creep body length
- `Applicability`
  Creeps and power creeps moving successfully onto a road tile
- `Exclusions`
  Road decay by terrain and wear timing
- `Verification Notes`
  This family covers wear amount only; same-tick application is owned by
  `ROAD-WEAR-002`. The executable case list lives in
  `src/matrices/road-wear.ts`.

### POWER-BANK-POWER

- `Catalog Entries`
  `POWER-BANK-003`
- `Canonical Source`
  Official power bank creation/placement rules and public `powerBank.power`
  surface.
- `Dimensions`
  generated power amount
- `Applicability`
  Public `powerBank.power` values on power banks
- `Exclusions`
  Hit-back, decay timer, and destruction drop outcomes
- `Verification Notes`
  This family remains `needs_vanilla_verification` until the full public range
  is confirmed in concrete cases.

### STRUCTURE-HITS

- `Catalog Entries`
  `STRUCTURE-HITS-001`
- `Canonical Source`
  Canonical structure hit constants and official structure constructors.
- `Dimensions`
  structure type
- `Applicability`
  Structures with fixed hit totals
- `Exclusions`
  RCL-scaled `hitsMax`, roads by terrain, and structures with dynamic limits
- `Verification Notes`
  Variable-hit families stay with their local mechanics. The executable case
  list lives in `src/matrices/structure-hits.ts`.

### CONSTRUCTION-COST

- `Catalog Entries`
  `CONSTRUCTION-COST-001`
- `Canonical Source`
  `CONSTRUCTION_COST`.
- `Dimensions`
  buildable structure type
- `Applicability`
  Standard buildable structures
- `Exclusions`
  Terrain multipliers for roads and construction-site progress side behavior
- `Verification Notes`
  This family covers base construction cost only. The executable case list lives
  in `src/matrices/construction-cost.ts`.

### ROOM-FIND

- `Catalog Entries`
  `ROOM-FIND-001`
- `Canonical Source`
  Official `Room.find()` implementation and `FIND_*` constants.
- `Dimensions`
  `FIND_*` constant, room contents
- `Applicability`
  Supported `FIND_*` constants exposed by the public room API
- `Exclusions`
  Filter behavior, exit concatenation, and player-perspective helper rules
- `Verification Notes`
  The current generated suite covers the explicit player-relative constants
  `FIND_MY_CREEPS`, `FIND_HOSTILE_CREEPS`, `FIND_MY_STRUCTURES`, and
  `FIND_HOSTILE_STRUCTURES`. The executable case list lives in
  `src/matrices/room-find.ts`.

### ROOM-TERRAIN

- `Catalog Entries`
  `ROOM-TERRAIN-001`
- `Canonical Source`
  Static room terrain data and official terrain accessors.
- `Dimensions`
  terrain class
- `Applicability`
  Plain, swamp, and wall tiles returned through `Room.Terrain.get(x, y)`
- `Exclusions`
  Raw buffer shape and `Game.map.getRoomTerrain()` equivalence
- `Verification Notes`
  This family is about mask values only. The executable case list lives in
  `src/matrices/room-terrain.ts`.

### ROOM-EVENTLOG

- `Catalog Entries`
  `ROOM-EVENTLOG-002`
- `Canonical Source`
  Room event constants and event-log payload shapes from action processors.
- `Dimensions`
  event type, required payload fields
- `Applicability`
  Current-tick room events exposed through `room.getEventLog()`
- `Exclusions`
  Raw JSON form and current-tick-only exposure
- `Verification Notes`
  The event-type inventory should remain explicit here rather than inline in
  `behaviors.md`.

### SOURCE-REGEN

- `Catalog Entries`
  `SOURCE-REGEN-001`
- `Canonical Source`
  Source capacity constants and official source regeneration logic.
- `Dimensions`
  room state
- `Applicability`
  Neutral rooms, owned/reserved rooms, and keeper rooms
- `Exclusions`
  Timer exposure and same-tick restore timing
- `Verification Notes`
  This family covers full-capacity mapping only. The executable case list lives
  in `src/matrices/source-regen.ts`.

### SOURCE-POWER

- `Catalog Entries`
  `SOURCE-POWER-001`
- `Canonical Source`
  `POWER_INFO` and the `PWR_REGEN_SOURCE` processor.
- `Dimensions`
  power level
- `Applicability`
  `PWR_REGEN_SOURCE`
- `Exclusions`
  `PWR_DISRUPT_SOURCE`
- `Verification Notes`
  Period, duration, and amount are all table-driven here. The executable case
  list lives in `src/matrices/source-power.ts`.

### MINERAL-REGEN

- `Catalog Entries`
  `MINERAL-REGEN-001`
- `Canonical Source`
  Mineral density rules and official mineral regeneration logic.
- `Dimensions`
  mineral density
- `Applicability`
  All standard mineral densities
- `Exclusions`
  Timer exposure and mineral type stability
- `Verification Notes`
  This family covers density-to-full-amount mapping only. The executable case
  list lives in `src/matrices/mineral-regen.ts`.

### MINERAL-POWER

- `Catalog Entries`
  `MINERAL-POWER-001`
- `Canonical Source`
  `POWER_INFO` and the `PWR_REGEN_MINERAL` processor.
- `Dimensions`
  power level
- `Applicability`
  `PWR_REGEN_MINERAL`
- `Exclusions`
  Base mineral regeneration timing
- `Verification Notes`
  Period, duration, and amount are all table-driven here. The executable case
  list lives in `src/matrices/mineral-power.ts`.

### DEPOSIT-TYPE

- `Catalog Entries`
  `DEPOSIT-001`
- `Canonical Source`
  Deposit type constants and official deposit object creation.
- `Dimensions`
  deposit type
- `Applicability`
  Public `deposit.depositType` values
- `Exclusions`
  Cooldown, exhaustion, and decay timing
- `Verification Notes`
  This family is only about the exposed type enum. The executable case list
  lives in `src/matrices/deposit-type.ts`.

### RUIN-DECAY

- `Catalog Entries`
  `RUIN-002`
- `Canonical Source`
  `RUIN_DECAY`, `RUIN_DECAY_STRUCTURES`, and the ruin tick processor.
- `Dimensions`
  destroyed structure type
- `Applicability`
  Ruins with and without structure-specific decay overrides
- `Exclusions`
  Ruin contents and withdraw semantics
- `Verification Notes`
  This family covers decay-time mapping only. The executable case list lives in
  `src/matrices/ruin-decay.ts`.

### POWERCREEP-VALIDATION

- `Catalog Entries`
  `POWERCREEP-CREATE-002`, `POWERCREEP-SPAWN-002`, `POWERCREEP-RENEW-002`,
  `POWERCREEP-UPGRADE-002`, `POWERCREEP-ACTION-001`,
  `POWERCREEP-ENABLE-002`
- `Canonical Source`
  Official power creep API validation and power creep processors.
- `Dimensions`
  API method, invalid or boundary condition
- `Applicability`
  Reviewed power creep lifecycle, action-surface, and room-enable validation
  matrices
- `Exclusions`
  Success-path state changes and power-specific effect tables
- `Verification Notes`
  Each API keeps its own result surface in `behaviors.md`; this family exists
  only to keep the validation case inventories explicit.

### POWER-INFO

- `Catalog Entries`
  `POWER-OPERATE-001`, `POWER-OPERATE-002`, `POWER-DISRUPT-001`,
  `POWER-DISRUPT-002`, `POWER-REGEN-001`, `POWER-REGEN-002`,
  `POWER-COMBAT-001`, `POWER-GENERATE-OPS-001`, `TOWER-POWER-001`,
  `SOURCE-POWER-001`, `MINERAL-POWER-001`
- `Canonical Source`
  `POWER_INFO` and the corresponding power processors.
- `Dimensions`
  power, supported power level, table field (`effect`, `duration`, `period`,
  `cooldown`, `range`, `ops`)
- `Applicability`
  Reviewed powers whose public semantics are directly table-driven
- `Exclusions`
  Target-validity matrices and non-table side effects
- `Verification Notes`
  This family is intentionally table-driven; target acceptance stays separate.
  The executable case list lives in `src/matrices/power-info.ts`.

### POWER-TARGETS

- `Catalog Entries`
  `POWER-OPERATE-005`, `POWER-DISRUPT-003`
- `Canonical Source`
  Official power API validation and target checks.
- `Dimensions`
  power, target class, room power-enabled state where relevant
- `Applicability`
  Room-bound operate powers and disrupt powers with structure targets
- `Exclusions`
  Table-driven effect magnitudes, cooldowns, ranges, and ops costs
- `Verification Notes`
  This family remains `needs_vanilla_verification` until the per-power target
  inventories are written explicitly.

### MARKET-ORDER

- `Catalog Entries`
  `MARKET-ORDER-001`, `MARKET-ORDER-002`, `MARKET-ORDER-006`,
  `MARKET-ORDER-008`
- `Canonical Source`
  Official market order APIs and market constants.
- `Dimensions`
  market API, validation condition or created-order field set
- `Applicability`
  `createOrder()`, `changeOrderPrice()`, and `extendOrder()`
- `Exclusions`
  Successful cancel/remove behavior and direct query surfaces
- `Verification Notes`
  This family combines order creation shape and order-validation cases because
  both are driven by the same narrow market-order APIs.

### MARKET-DEAL

- `Catalog Entries`
  `MARKET-DEAL-003`
- `Canonical Source`
  Official `Game.market.deal()` API and market/terminal validation.
- `Dimensions`
  invalid or capped deal condition
- `Applicability`
  `Game.market.deal()`
- `Exclusions`
  Successful deal execution and terminal energy payer semantics
- `Verification Notes`
  The per-tick cap overflow outcome belongs here with the rest of the failure
  matrix.

### MAP-ROOM-STATUS

- `Catalog Entries`
  `MAP-ROOM-004`
- `Canonical Source`
  Official world map status data exposed through `Game.map.getRoomStatus()`.
- `Dimensions`
  room status class
- `Applicability`
  Normal, novice, respawn, and closed rooms
- `Exclusions`
  Exit descriptions and linear-distance rules
- `Verification Notes`
  Timestamp presence and meaning should be defined per returned status here.

### MOVE-BASIC-DIRECTIONS

- `Catalog Entries`
  `MOVE-BASIC-001`
- `Canonical Source`
  Screeps direction constants (`TOP` through `TOP_LEFT`), the official
  `creep.move()` processor, and the spawned `PowerCreep.move()` wrapper
  behavior that delegates to standard movement semantics.
- `Dimensions`
  creep kind, direction constant
- `Applicability`
  `move(direction)` for creep kinds that use standard movement semantics:
  `Creep` with an active MOVE part, and spawned `PowerCreep`, each standing on
  a walkable tile with a walkable destination tile
- `Exclusions`
  Fatigue generation, collision resolution, wall/blocked tiles, power-creep
  unspawned `ERR_BUSY`, and the creep-only `ERR_TIRED` / `ERR_NO_BODYPART`
  return codes
- `Verification Notes`
  The executable case list lives in `src/matrices/move-directions.ts`
  and should cover every Screeps direction constant for every applicable creep
  kind. Expected landing offsets are derived from the direction constants
  themselves, keeping the oracle independent of the engine under test.

### ROOMPOS-DIRECTION

- `Catalog Entries`
  `ROOMPOS-SPATIAL-005`
- `Canonical Source`
  Official `RoomPosition.getDirectionTo()` implementation.
- `Dimensions`
  target offset
- `Applicability`
  Canonical representative offsets used to prove each returned direction
  constant
- `Exclusions`
  `getRangeTo()`, equality, and other spatial helper methods
- `Verification Notes`
  This family should remain a concrete offset matrix, not an algorithm prose
  restatement. The executable case list lives in
  `src/matrices/roompos-direction.ts`.

### INTENT-CREEP-OVERWRITE

- `Catalog Entries`
  `INTENT-CREEP-005`
- `Canonical Source`
  Official same-method creep intent storage and replacement behavior.
- `Dimensions`
  creep method
- `Applicability`
  Methods with single-intent overwrite semantics
- `Exclusions`
  Blocking priority interactions between different methods
- `Verification Notes`
  This family remains `needs_vanilla_verification` until the supported method
  inventory is explicit.

### INTENT-CREEP-CANCEL

- `Catalog Entries`
  `INTENT-CREEP-006`
- `Canonical Source`
  Official `cancelOrder(methodName)` handling on creep intents.
- `Dimensions`
  cancelable creep method
- `Applicability`
  Methods that support `cancelOrder(methodName)`
- `Exclusions`
  Overwrite behavior and cross-method priority blocking
- `Verification Notes`
  This family remains `needs_vanilla_verification` until the cancelable-method
  inventory is explicit.

### INTENT-LIMIT

- `Catalog Entries`
  `INTENT-LIMIT-001`, `INTENT-LIMIT-002`
- `Canonical Source`
  Official per-tick limit checks for market and power-creep management intents.
- `Dimensions`
  capped intent family, tick usage count
- `Applicability`
  Market and power-creep management APIs with explicit per-tick caps
- `Exclusions`
  Uncapped APIs and general creep/structure intents
- `Verification Notes`
  `INTENT-LIMIT-001` covers the limit values; `INTENT-LIMIT-002` covers the
  overflow outcome.

### RAWMEMORY-SEGMENTS

- `Catalog Entries`
  `RAWMEMORY-003`
- `Canonical Source`
  Official `RawMemory` runtime implementation and memory-segment limits.
- `Dimensions`
  segment id validity, per-segment length, active segment count
- `Applicability`
  `RawMemory.segments` and `RawMemory.setActiveSegments(ids)`
- `Exclusions`
  Foreign segments and main `Memory` parse/serialize behavior
- `Verification Notes`
  This family covers limit values only; next-tick activation is owned by
  `RAWMEMORY-004`. The executable case list lives in
  `src/matrices/rawmemory-segments.ts`.

### SHAPE-STRUCT

- `Catalog Entries`
  `SHAPE-STRUCT-001`
- `Canonical Source`
  Vanilla Screeps engine prototype chain — discovered empirically by
  walking `Object.getOwnPropertyNames` on each structure type and keeping
  getters and non-function values, filtering methods and internal fields.
  Pinned in `src/matrices/object-shapes.ts`.
- `Dimensions`
  structure type (16 player-buildable types)
- `Applicability`
  `StructureSpawn`, `StructureExtension`, `StructureRoad`,
  `StructureWall`, `StructureRampart`, `StructureLink`,
  `StructureStorage`, `StructureTower`, `StructureExtractor`,
  `StructureLab`, `StructureTerminal`, `StructureContainer`,
  `StructureObserver`, `StructureFactory`, `StructureNuker`,
  `StructurePowerSpawn`
- `Exclusions`
  NPC structures (keeper lair, invader core, power bank, portal) are
  tested as individual behavior entries in 26.6, not as matrix cases.
  `StructureController` is tested separately in 26.3.
- `Verification Notes`
  Each structure type has a distinct canonical shape reflecting its
  type-specific properties (e.g. `cooldown` on link/extractor/lab,
  `spawning` on spawn, `isPublic` on rampart). Capability-gated types
  (terminal, factory, nuker, powerSpawn, observer) are skipped when the
  adapter lacks the capability.
