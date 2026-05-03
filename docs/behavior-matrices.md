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

### ID-CONSTRUCTOR

- `Catalog Entries`
  `UNDOC-IDCTOR-001`
- `Canonical Source`
  Vanilla runtime behavior for undocumented id-accepting game-object
  constructors, cross-checked against the live object surfaced by
  `Game.getObjectById(id)` in the same tick.
- `Dimensions`
  constructor class, representative public fields copied from the canonical
  object overlay
- `Applicability`
  `Creep`, `Structure`, `ConstructionSite`, `Resource`, `Tombstone`, `Ruin`,
  `Mineral`, and `Source`.
- `Exclusions`
  `Flag` because flags are named objects without ids; `ObserverSpy` because it
  is an internal object and not player API surface; wrong-type id behavior and
  write behavior, which have separate representative catalog entries.
- `Verification Notes`
  The executable case list lives in `src/matrices/id-constructors.ts`.

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

### STRONGHOLD-LAYOUT

- `Catalog Entries`
  `STRONGHOLD-LAYOUT-001`
- `Canonical Source`
  `@screeps/common/lib/strongholds.js` (template definitions) and
  `@screeps/engine/src/processor/intents/invader-core/stronghold/stronghold.js`
  (`deployStronghold` placement logic).
- `Dimensions`
  template name (`bunker1`..`bunker5`), structure type, dx, dy
- `Applicability`
  Each of the five canonical bunker templates. For every non-core entry in a
  template's `structures` list, a structure of the listed `type` is placed at
  `(core.x + dx, core.y + dy)` in the deployment tick.
- `Exclusions`
  Per-template stronghold rampart hits scaling (`STRONGHOLD_RAMPART_HITS`),
  per-structure `EFFECT_COLLAPSE_TIMER` propagation, container reward
  contents (random per `containerRewards`), tower energy seeding amount, and
  rampart/tower user attribution. These are separate observables.
- `Verification Notes`
  The executable case list lives in `src/matrices/stronghold-layout.ts`.

### INVADER-RAID-COMPOSITION

- `Catalog Entries`
  `INVADER-RAID-009`
- `Canonical Source`
  Unpacked vanilla `@screeps/backend/lib/cronjobs.js`, `genInvaders()`
  helpers `createRaid()` and `createCreep()`.
- `Dimensions`
  room center class, owned controller level bucket, raid-size branch, selected
  exit-tile count cap, creep index within the raid, body subtype, boost-roll
  state, and boostable body part type.
- `Applicability`
  Invader-owned creeps spawned by the per-room Invader raid spawner after the
  eligibility and exit gates in `INVADER-RAID-001` through
  `INVADER-RAID-008` pass.
- `Exclusions`
  Exact probabilities for raid-size escalation, subtype random rolls, boost
  rolls, exit-direction choice, first spawn-tile choice, and next raid-threshold
  randomization. Stronghold creep spawning from an invader core's own
  `spawning` state is owned by `INVADER-CORE-003`.
- `Verification Notes`
  Size class is `small` unless the room has an owned controller with level >= 4;
  owned controller levels 4 through 8 use `big`.

  Raid count before the selected exit-tile cap:

  | Branch | Size / RCL bucket | Count | Boost chance |
  | --- | --- | --- | --- |
  | non-center, no escalation | any | 1 | 0.5 |
  | non-center, first escalation only | small | 2 | 0.5 |
  | non-center, first escalation only | big, RCL 4-8 | 2 | 0 |
  | nested escalation, or any center room | small | 2-5 | 0.5 |
  | nested escalation, or any center room | big, RCL 4-5 | 2 | 0 |
  | nested escalation, or any center room | big, RCL 6 | 2-3 | 0 |
  | nested escalation, or any center room | big, RCL 7 | 2-3 | 0.4 |
  | nested escalation, or any center room | big, RCL 8 | 2-5 | 0.4 |

  The first escalation branch corresponds to `Math.random() > 0.9` in
  non-center rooms and is always taken in center rooms. The nested escalation
  branch corresponds to `Math.random() > 0.8` after first escalation and is
  always taken in center rooms. The final count is capped to the number of
  available edge spawn tiles on the selected exit.

  Subtype assignment by creep index:

  | Index condition | Non-center subtype | Center subtype |
  | --- | --- | --- |
  | index 0 | Melee | Ranged |
  | index 1 | Ranged or Healer | Ranged or Healer |
  | index 2 and count == 5 | Ranged or Healer | Ranged or Healer |
  | index 2 and count != 5 | Healer | Healer |
  | index >= 3 | Healer | Healer |

  Body templates are the exact ordered `smallMelee`, `smallRanged`,
  `smallHealer`, `bigMelee`, `bigRanged`, and `bigHealer` arrays in
  `createCreep()`. Generated cases should preserve body part order, not only
  part counts.

  Boost chance is rolled once per spawned creep. If the roll succeeds, all
  boostable parts in that creep receive the center or non-center compound below;
  MOVE parts are never boosted.

  | Body part | Non-center boost | Center boost |
  | --- | --- | --- |
  | `heal` | `LO` | `XLHO2` |
  | `ranged_attack` | `KO` | `XKHO2` |
  | `work` | `ZH` | `XZH2O` |
  | `attack` | `UH` | `XUH2O` |
  | `tough` | `GO` | `XGHO2` |

  The executable case list lives in `src/matrices/invader-raid-composition.ts`.

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
  Official Creep prototype guards in `@screeps/engine/src/game/creeps.js`,
  cross-checked against matching processor blocks in
  `@screeps/engine/src/processor/intents/creeps/*.js`. All listed methods
  share the API guard
  `!this.room.controller.my && this.room.controller.safeMode`.
- `Dimensions`
  hostile creep intent method
- `Applicability`
  `attack()`, `rangedAttack()`, `rangedMassAttack()`, `dismantle()`,
  `withdraw()`, `heal()`, `rangedHeal()`, `attackController()`. Per-method
  return codes (matrix records both): `withdraw()` returns `ERR_NOT_OWNER`,
  the others return `ERR_NO_BODYPART`.
- `Exclusions`
  Safe-mode activation requirements, movement restrictions, and non-creep
  actions (towers, nukes, power creep powers, structure intents).
  `claimController()` is intentionally excluded: its source contains the
  same safe-mode guard, but the guard is unreachable because a safe-moded
  controller is always `level >= 1` and `claimController()` rejects any
  target with `level > 0` first.
- `Verification Notes`
  Applicability set verified closed by source audit of every Creep
  prototype method in `@screeps/engine/src/game/creeps.js` for the guard
  shape above. Each listed action has a concrete vanilla-passing scenario
  in `safeModeBlockedActionCases` (`src/matrices/ctrl-safemode-blocked.ts`).

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

### NUKE-LAUNCH-VALIDATION

- `Catalog Entries`
  `NUKE-LAUNCH-008`
- `Canonical Source`
  Official `StructureNuker.launchNuke()` API guard and launch-nuke processor.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `launchNuke()` ownership, argument type, cooldown, active-structure state,
  target range, and energy/ghodium availability.
- `Exclusions`
  Room-status restrictions such as novice and respawn areas until the adapter
  contract exposes canonical room-status setup.
- `Verification Notes`
  This family should include both single-blocker rows and selected precedence
  rows: cooldown before inactive/range/resources, inactive before
  range/resources, and range before resource availability.
  The executable case list lives in
  `src/matrices/nuke-launch-validation.ts`.

### NUKER-PROPS

- `Catalog Entries`
  `NUKER-PROPS-001`
- `Canonical Source`
  Official `StructureNuker` property getters and nuker capacity constants.
- `Dimensions`
  public property, backing store or capacity value
- `Applicability`
  `energy`, `ghodium`, `energyCapacity`, and `ghodiumCapacity` on
  `StructureNuker`.
- `Exclusions`
  Public data-property shape, which is owned by `SHAPE-STRUCT-001`, and Store
  API capacity semantics, which are owned by `STORE-RESTRICTED-*`.
- `Verification Notes`
  This family is about value aliases only; it should not duplicate store
  method behavior.
  The executable case list lives in `src/matrices/nuker-props.ts`.

### NUKE-FLIGHT-VISIBILITY

- `Catalog Entries`
  `NUKE-FLIGHT-004`
- `Canonical Source`
  Official nuke room registration and `Room.find(FIND_NUKES)` behavior.
- `Dimensions`
  observing player perspective, room queried, expected visibility
- `Applicability`
  In-flight nukes before the landing tick.
- `Exclusions`
  Object property shape and `timeToLand` countdown, which are owned by
  `SHAPE-NUKE-001` and `NUKE-FLIGHT-002`.
- `Verification Notes`
  Include target-room visibility, launch-room absence, and the no-target-room
  visibility case. `NUKE-FLIGHT-003` owns the simpler positive visibility
  behavior.
  The executable case list lives in `src/matrices/nuke-flight-visibility.ts`.

### NUKE-IMPACT-OBJECTS

- `Catalog Entries`
  `NUKE-IMPACT-008`
- `Canonical Source`
  Official nuke impact processor.
- `Dimensions`
  room object type, location relative to blast, expected post-impact state
- `Applicability`
  Object-type outcomes not already owned by `NUKE-IMPACT-005`,
  `NUKE-IMPACT-006`, or `NUKE-IMPACT-007`: power creeps, actively-spawning
  spawns, controllers, sources, minerals, deposits, flags, and portals.
- `Exclusions`
  Ordinary creep death, ephemeral object cleanup, tombstone/ruin suppression,
  structure damage amounts, and rampart absorption.
- `Verification Notes`
  Capability-gated object types should be skipped only when the adapter cannot
  place or expose that type.
  The executable case list lives in `src/matrices/nuke-impact-objects.ts`.

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

### CONSTRUCTION-SITE-OVER-RUIN

- `Catalog Entries`
  `CONSTRUCTION-SITE-009`
- `Canonical Source`
  Vanilla `utils.checkConstructionSite` (`@screeps/engine/src/utils.js:128-189`)
  filters on same-type structures and existing construction sites but never
  inspects ruins.
- `Dimensions`
  ruin's destroyed structure type, construction-site structure type
- `Applicability`
  Player-buildable structure types as the placed type, structure types that can
  exist as ruins for the destroyed type
- `Exclusions`
  Extractor placement (requires a mineral tile), border/wall placement
  restrictions, RCL availability, and `MAX_CONSTRUCTION_SITES`. The matrix
  asserts the ruin alone does not contribute to placement rejection.
- `Verification Notes`
  The executable case list lives in `src/matrices/construction-site-over-ruin.ts`
  and covers a representative `{ spawn, extension, tower, container, road }`
  cross-product (25 cases).

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

### ROOM-EVENTLOG-NUKE

- `Catalog Entries`
  `ROOM-EVENTLOG-026`
- `Canonical Source`
  Official nuke impact processor and shared damage/event-log helper.
- `Dimensions`
  nuke event scenario, expected event type, object id, target id, and ordering
- `Applicability`
  Nuke-generated room events during the landing tick.
- `Exclusions`
  Generic nuke attack type and damage amount, owned by `ROOM-EVENTLOG-019`,
  and generic destroyed-object event shape, owned by `ROOM-EVENTLOG-005` and
  `ROOM-EVENTLOG-006`.
- `Verification Notes`
  This family should cover nuke `EVENT_ATTACK` object/target id direction, the
  absence of `EVENT_ATTACK` entries for room-wide creep kills, and ordering
  when rampart absorption produces both rampart and covered-structure damage
  events.
  The executable case list lives in `src/matrices/eventlog-nuke.ts`.

### ACTIONLOG-CREEP

- `Catalog Entries`
  `ACTIONLOG-CREEP-001`
- `Canonical Source`
  Official creep action processors and the room-history/client action-log
  renderer.
- `Dimensions`
  creep method, rendered action-log type, coordinate payload shape
- `Applicability`
  Successful source-side creep actions that render client/history action-log
  markers on the acting creep.
- `Exclusions`
  Target-side `attacked` / `healed` markers, `say()` message markers, gameplay
  return codes, resulting world state, and `Room.getEventLog()` payloads.
- `Verification Notes`
  The executable case list lives in `src/matrices/actionlog-creep.ts` and
  covers common actions with stable target coordinates: `attack`, `harvest`,
  `build`, `repair`, `heal`, `rangedHeal`, `upgradeController`, and
  `reserveController`.

### ACTIONLOG-TARGET

- `Catalog Entries`
  `ACTIONLOG-TARGET-001`
- `Canonical Source`
  Official damage/healing processors and the room-history/client action-log
  renderer.
- `Dimensions`
  incoming effect family, target object type, rendered action-log type,
  coordinate payload shape
- `Applicability`
  Successful damage and healing actions that render `attacked` or `healed`
  markers on the affected target object.
- `Exclusions`
  Source-side action markers, hit point/resource changes, death handling, and
  `Room.getEventLog()` payloads.
- `Verification Notes`
  The executable case list lives in `src/matrices/actionlog-target.ts` and
  covers creep targets damaged or healed by creep and tower actions. Structure
  target rows and power-creep target rows should be added only where the
  rendered client/history payload differs and capability composition is
  explicit.

### ACTIONLOG-STRUCT

- `Catalog Entries`
  `ACTIONLOG-STRUCT-001`
- `Canonical Source`
  Official structure action processors and the room-history/client action-log
  renderer.
- `Dimensions`
  structure type, structure method, rendered action-log type, coordinate
  payload shape
- `Applicability`
  Successful source-side structure actions that render client/history
  action-log markers on the acting structure.
- `Exclusions`
  Creep source-side markers, target-side markers, gameplay return codes,
  resulting world state, and `Room.getEventLog()` payloads.
- `Verification Notes`
  The executable case list lives in `src/matrices/actionlog-struct.ts` and
  covers tower `attack` / `heal` / `repair`, link `transferEnergy`, and lab
  `runReaction` / `reverseReaction`. Optional feature rows such as factory
  production should wait until capability composition is explicit.

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

### EFFECT-HOST

- `Catalog Entries`
  `EFFECT-HOST-001`
- `Canonical Source`
  Vanilla Screeps active `RoomObject.effects` entries produced by successful
  power-creep `usePower()` calls.
- `Dimensions`
  power producer, target RoomObject class, effect id field (`power` and/or
  `effect`), applied power level
- `Applicability`
  Active power effects currently feasible through public screeps-ok setup
  helpers: tower, storage, spawn, source, mineral, observer, factory,
  terminal, lab, power spawn, controller, rampart, and temporary shield
  rampart hosts.
- `Exclusions`
  Effect magnitudes and gameplay side effects owned by the power-specific
  sections; invalid target matrices; direct setup injection of preexisting
  `effects` arrays; instant powers that do not create active host entries.
- `Verification Notes`
  The executable case list lives in `src/matrices/effect-hosts.ts`.
  Invader-core natural effects are excluded until they can be produced through
  setup without directly injecting the `effects` array.

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

### LAB-RUN-VALIDATION

- `Catalog Entries`
  `LAB-RUN-013`
- `Canonical Source`
  Official `StructureLab.runReaction()` API guard in
  `@screeps/engine/src/game/structures.js` and the lab-run processor in
  `@screeps/engine/src/processor/intents/labs/run-reaction.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `runReaction(lab1, lab2)` ownership, active-structure state, argument
  validity (compound mismatch, mineral type already held), target validity
  (lab1/lab2 are labs), range (≤ 2 from caller), store capacity (caller
  full), reagent availability, and cooldown.
- `Exclusions`
  Successful product mapping, owned by `LAB-RUN-001`. Reverse-reaction
  failure ordering is owned by `LAB-REVERSE-VALIDATION`.
- `Verification Notes`
  Single-branch rows are owned by `LAB-RUN-005..012`. This family adds
  selected precedence rows; canonical order should be lifted from the API
  guard's check sequence and confirmed against the live vanilla server.
  The executable case list lives in `src/matrices/lab-run-validation.ts`.

### LAB-REVERSE-VALIDATION

- `Catalog Entries`
  `LAB-REVERSE-013`
- `Canonical Source`
  Official `StructureLab.reverseReaction()` API guard in
  `@screeps/engine/src/game/structures.js` and the lab reverse-reaction
  processor in
  `@screeps/engine/src/processor/intents/labs/reverse-reaction.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `reverseReaction(lab1, lab2)` ownership, active-structure state, argument
  validity (no reverse pair, same lab passed twice), target validity
  (lab1/lab2 are labs), range, store capacity (lab1/lab2 cannot hold
  outputs), compound availability, and cooldown.
- `Exclusions`
  Successful split mapping, owned by `LAB-REVERSE-001`.
- `Verification Notes`
  Single-branch rows are owned by `LAB-REVERSE-005..012`. Canonical order
  must be lifted from the API guard. The executable case list lives in
  `src/matrices/lab-reverse-validation.ts`.

### FACTORY-PRODUCE-VALIDATION

- `Catalog Entries`
  `FACTORY-PRODUCE-011`
- `Canonical Source`
  Official `StructureFactory.produce()` API guard in
  `@screeps/engine/src/game/structures.js` and the factory-produce processor
  in `@screeps/engine/src/processor/intents/factory/produce.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `produce(resourceType)` ownership, active-structure state, argument
  validity (resourceType not a commodity), target validity (commodity level
  vs. factory level), `PWR_OPERATE_FACTORY` requirement, store capacity,
  recipe-component availability, and cooldown.
- `Exclusions`
  Successful production amounts and chain membership, owned by
  `FACTORY-PRODUCE-001` and `FACTORY-COMMODITY-*`.
- `Verification Notes`
  This is the gold-standard family for issue 117 — the ordering was
  established by xxscreeps PR #114. Vanilla order in the API guard:
  ownership → active-structure → argument validity → target validity
  (level mismatch) → power effect → store capacity → resources → cooldown.
  The executable case list lives in `src/matrices/factory-produce-validation.ts`.

### BOOST-CREEP-VALIDATION

- `Catalog Entries`
  `BOOST-CREEP-010`
- `Canonical Source`
  Official `StructureLab.boostCreep()` API guard in
  `@screeps/engine/src/game/structures.js` and the boost-creep processor in
  `@screeps/engine/src/processor/intents/labs/boost.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `boostCreep(creep, bodyPartsCount?)` ownership, active-structure state,
  target validity (creep not yours, hostile, or no matching unboosted
  parts), range, and resource availability (mineral and energy).
- `Exclusions`
  Successful body-part selection and boost type mapping, owned by
  `BOOST-CREEP-001..009`.
- `Verification Notes`
  Canonical order must be lifted from the API guard. The executable case
  list lives in `src/matrices/boost-creep-validation.ts`.

### UNBOOST-VALIDATION

- `Catalog Entries`
  `UNBOOST-006`
- `Canonical Source`
  Official `StructureLab.unboostCreep()` API guard in
  `@screeps/engine/src/game/structures.js` and the unboost processor in
  `@screeps/engine/src/processor/intents/labs/unboost.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `unboostCreep(creep)` ownership, target validity (no boosted parts or
  hostile creep), range, energy availability, and cooldown.
- `Exclusions`
  Boost-mineral spillback amount, owned by `UNBOOST-004`.
- `Verification Notes`
  No `ERR_FULL` branch — surplus minerals spill onto the creep tile (see
  Coverage Notes in `8.2 Unboost`). Canonical order must be lifted from
  the API guard. The executable case list lives in
  `src/matrices/unboost-validation.ts`.

### TERMINAL-SEND-VALIDATION

- `Catalog Entries`
  `TERMINAL-SEND-013`
- `Canonical Source`
  Official `StructureTerminal.send()` API guard in
  `@screeps/engine/src/game/structures.js` and the terminal-send processor
  in `@screeps/engine/src/processor/intents/terminal/send.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `send(resourceType, amount, destination, description?)` ownership,
  active-structure state, argument validity (amount, destination room
  name, description length), resource availability, and cooldown.
- `Exclusions`
  Energy-cost and range-fee math, owned by separate `TERMINAL-SEND-*`
  behavior entries.
- `Verification Notes`
  Canonical order must be lifted from the API guard. The executable case
  list lives in `src/matrices/terminal-send-validation.ts`.

### LINK-VALIDATION

- `Catalog Entries`
  `LINK-014`
- `Canonical Source`
  Official `StructureLink.transferEnergy()` API guard in
  `@screeps/engine/src/game/structures.js` and the link-transfer processor
  in `@screeps/engine/src/processor/intents/link/transfer-energy.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `transferEnergy(target, amount?)` ownership, active-structure state,
  argument validity, target validity (target not a link or hostile),
  resource availability, store capacity, and cooldown.
- `Exclusions`
  Same-room loss-free transfer and cross-room loss math, owned by
  separate `LINK-*` behavior entries.
- `Verification Notes`
  Canonical order must be lifted from the API guard. The executable case
  list lives in `src/matrices/link-validation.ts`.

### TOWER-ATTACK-VALIDATION

- `Catalog Entries`
  `TOWER-ATTACK-005`
- `Canonical Source`
  Official `StructureTower.attack()` API guard in
  `@screeps/engine/src/game/structures.js` and the tower-attack processor
  in `@screeps/engine/src/processor/intents/tower/attack.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `tower.attack(target)` ownership, active-structure state, target
  validity (target not a creep/PC/structure or owned by self), and energy
  availability.
- `Exclusions`
  Range-attenuated damage curve, owned by `TOWER-ATTACK-002..003`.
- `Verification Notes`
  Towers do not have an `ERR_NOT_IN_RANGE` branch — full room is in
  effective range. Canonical order must be lifted from the API guard.
  The executable case list lives in `src/matrices/tower-attack-validation.ts`.

### TOWER-HEAL-VALIDATION

- `Catalog Entries`
  `TOWER-HEAL-005`
- `Canonical Source`
  Official `StructureTower.heal()` API guard in
  `@screeps/engine/src/game/structures.js` and the tower-heal processor in
  `@screeps/engine/src/processor/intents/tower/heal.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `tower.heal(target)` ownership, active-structure state, target validity
  (target not a creep or power creep), and energy availability.
- `Exclusions`
  Range-attenuated heal curve, owned by `TOWER-HEAL-002..003`.
- `Verification Notes`
  Canonical order must be lifted from the API guard. The executable case
  list lives in `src/matrices/tower-heal-validation.ts`.

### TOWER-REPAIR-VALIDATION

- `Catalog Entries`
  `TOWER-REPAIR-005`
- `Canonical Source`
  Official `StructureTower.repair()` API guard in
  `@screeps/engine/src/game/structures.js` and the tower-repair processor
  in `@screeps/engine/src/processor/intents/tower/repair.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `tower.repair(target)` ownership, active-structure state, target
  validity (target not a structure), and energy availability.
- `Exclusions`
  Range-attenuated repair curve, owned by `TOWER-REPAIR-002..003`.
- `Verification Notes`
  Canonical order must be lifted from the API guard. The executable case
  list lives in `src/matrices/tower-repair-validation.ts`.

### OBSERVER-VALIDATION

- `Catalog Entries`
  `OBSERVER-007`
- `Canonical Source`
  Official `StructureObserver.observeRoom()` API guard in
  `@screeps/engine/src/game/structures.js` and the observe processor in
  `@screeps/engine/src/processor/intents/observer/observe-room.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `observeRoom(roomName)` ownership, active-structure state, argument
  validity (malformed room name), and target range (> `OBSERVER_RANGE`
  rooms).
- `Exclusions`
  Visibility delivery latency, owned by separate `OBSERVER-*` behavior
  entries.
- `Verification Notes`
  Canonical order must be lifted from the API guard. The executable case
  list lives in `src/matrices/observer-validation.ts`.

### SPAWN-CREATE-VALIDATION

- `Catalog Entries`
  `SPAWN-CREATE-014`
- `Canonical Source`
  Official `StructureSpawn.spawnCreep()` API guard in
  `@screeps/engine/src/game/structures.js` and the spawn-create processor
  in `@screeps/engine/src/processor/intents/spawn/create-creep.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `spawnCreep(body, name, opts?)` ownership, active-structure state, caller
  busy state (already spawning), argument validity (body, opts.directions,
  opts.energyStructures), name uniqueness, and energy availability.
- `Exclusions`
  Successful directions/dryRun/memory semantics, owned by
  `SPAWN-CREATE-005..013` and `SPAWN-TIMING-*`.
- `Verification Notes`
  Canonical order must be lifted from the API guard. The executable case
  list lives in `src/matrices/spawn-create-validation.ts`.

### RENEW-CREEP-VALIDATION

- `Catalog Entries`
  `RENEW-CREEP-011`
- `Canonical Source`
  Official `StructureSpawn.renewCreep()` API guard in
  `@screeps/engine/src/game/structures.js` and the renew-creep processor
  in `@screeps/engine/src/processor/intents/spawn/renew-creep.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `renewCreep(creep)` ownership (spawn and creep), caller busy state
  (spawning), target validity (creep has CLAIM part or not yours), range,
  store capacity (`ticksToLive` already at max), and energy availability.
- `Exclusions`
  Renew amount math, owned by `RENEW-CREEP-002..009`.
- `Verification Notes`
  Canonical order must be lifted from the API guard. The executable case
  list lives in `src/matrices/renew-creep-validation.ts`.

### RECYCLE-CREEP-VALIDATION

- `Catalog Entries`
  `RECYCLE-CREEP-005`
- `Canonical Source`
  Official `StructureSpawn.recycleCreep()` API guard in
  `@screeps/engine/src/game/structures.js` and the recycle-creep processor
  in `@screeps/engine/src/processor/intents/spawn/recycle-creep.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `recycleCreep(creep)` ownership, caller busy state, target validity, and
  range.
- `Exclusions`
  Recycled-resource placement (container vs. tombstone), tracked as a
  Coverage Note in `9.5 Recycle Creep`.
- `Verification Notes`
  Canonical order must be lifted from the API guard. The executable case
  list lives in `src/matrices/recycle-creep-validation.ts`.

### CTRL-SAFEMODE-VALIDATION

- `Catalog Entries`
  `CTRL-SAFEMODE-009`
- `Canonical Source`
  Official `StructureController.activateSafeMode()` API guard in
  `@screeps/engine/src/game/structures.js` and the activate-safe-mode
  processor in
  `@screeps/engine/src/processor/intents/controller/activate-safe-mode.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `activateSafeMode()` ownership, controller-busy state (safe mode already
  active or per-tick activation limit), resource availability
  (`safeModeAvailable === 0`), and cooldown (`safeModeCooldown`).
- `Exclusions`
  Cross-shard safe mode propagation; same-tick double-activation race,
  owned by `CTRL-SAFEMODE-008`.
- `Verification Notes`
  Distinct from `CTRL-SAFEMODE-BLOCKED`, which describes how active safe
  mode blocks hostile actions. Canonical order must be lifted from the API
  guard. The executable case list lives in
  `src/matrices/ctrl-safemode-validation.ts`.

### STRUCTURE-DESTROY-VALIDATION

- `Catalog Entries`
  `STRUCTURE-API-007`
- `Canonical Source`
  Official `Structure.destroy()` API guard in
  `@screeps/engine/src/game/structures.js` and the destroy-structure
  processor in
  `@screeps/engine/src/processor/intents/structures/destroy-structure.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `Structure.destroy()` ownership (structure or controller) and room-busy
  state (hostile creeps in the room).
- `Exclusions`
  Ruin creation outcome, owned by separate `RUIN-*` entries.
- `Verification Notes`
  `ConstructionSite.remove()` is single-branch (`ERR_NOT_OWNER`) and
  intentionally not part of this family. Canonical order must be lifted
  from the API guard. The executable case list lives in
  `src/matrices/structure-destroy-validation.ts`.

### COMBAT-MELEE-VALIDATION

- `Catalog Entries`
  `COMBAT-MELEE-009`
- `Canonical Source`
  Official `Creep.attack()` API guard in
  `@screeps/engine/src/game/creeps.js` and the melee-attack processor in
  `@screeps/engine/src/processor/intents/creeps/attack.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `creep.attack(target)` ownership, caller busy state (spawning),
  body-part requirements (`ATTACK`), target validity (not a hostile
  creep/PC/structure), and range.
- `Exclusions`
  Counter-damage rules, owned by `COMBAT-MELEE-008`.
- `Verification Notes`
  Canonical order must be lifted from the API guard. The executable case
  list lives in `src/matrices/combat-melee-validation.ts`.

### COMBAT-RANGED-VALIDATION

- `Catalog Entries`
  `COMBAT-RANGED-007`
- `Canonical Source`
  Official `Creep.rangedAttack()` API guard in
  `@screeps/engine/src/game/creeps.js` and the ranged-attack processor in
  `@screeps/engine/src/processor/intents/creeps/ranged-attack.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `creep.rangedAttack(target)` ownership, caller busy state, body-part
  requirements (`RANGED_ATTACK`), target validity, and range (≤ 3).
- `Exclusions`
  Rampart redirection, owned by `COMBAT-RANGED-006`.
- `Verification Notes`
  Canonical order must be lifted from the API guard. The executable case
  list lives in `src/matrices/combat-ranged-validation.ts`.

### COMBAT-RMA-VALIDATION

- `Catalog Entries`
  `COMBAT-RMA-005`
- `Canonical Source`
  Official `Creep.rangedMassAttack()` API guard in
  `@screeps/engine/src/game/creeps.js` and the mass-attack processor in
  `@screeps/engine/src/processor/intents/creeps/ranged-mass-attack.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `creep.rangedMassAttack()` ownership, caller busy state, and body-part
  requirements (`RANGED_ATTACK`).
- `Exclusions`
  Damage falloff and rampart redirection, owned by
  `COMBAT-RMA-001..004` and the existing `COMBAT-RMA` matrix.
- `Verification Notes`
  No target argument means no target-validity or range branches.
  Canonical order must be lifted from the API guard. The executable case
  list lives in `src/matrices/combat-rma-validation.ts`.

### COMBAT-HEAL-VALIDATION

- `Catalog Entries`
  `COMBAT-HEAL-007`
- `Canonical Source`
  Official `Creep.heal()` API guard in `@screeps/engine/src/game/creeps.js`
  and the heal processor in
  `@screeps/engine/src/processor/intents/creeps/heal.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `creep.heal(target)` ownership, caller busy state, body-part
  requirements (`HEAL`), target validity (target not a creep/PC), and
  range.
- `Exclusions`
  Heal-amount math and self-heal mechanics, owned by separate
  `COMBAT-HEAL-*` entries.
- `Verification Notes`
  Canonical order must be lifted from the API guard. The executable case
  list lives in `src/matrices/combat-heal-validation.ts`.

### COMBAT-RANGEDHEAL-VALIDATION

- `Catalog Entries`
  `COMBAT-RANGEDHEAL-006`
- `Canonical Source`
  Official `Creep.rangedHeal()` API guard in
  `@screeps/engine/src/game/creeps.js` and the ranged-heal processor in
  `@screeps/engine/src/processor/intents/creeps/ranged-heal.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `creep.rangedHeal(target)` ownership, caller busy state, body-part
  requirements (`HEAL`), target validity, and range (≤ 3).
- `Exclusions`
  Heal amount falloff, owned by separate `COMBAT-RANGEDHEAL-*` entries.
- `Verification Notes`
  Canonical order must be lifted from the API guard. The executable case
  list lives in `src/matrices/combat-rangedheal-validation.ts`.

### BUILD-VALIDATION

- `Catalog Entries`
  `BUILD-011`
- `Canonical Source`
  Official `Creep.build()` API guard in `@screeps/engine/src/game/creeps.js`
  and the build processor in
  `@screeps/engine/src/processor/intents/creeps/build.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `creep.build(target)` ownership, caller busy state, body-part
  requirements (`WORK`), resource availability (energy), target validity
  (not a construction site or blocked tile), and range.
- `Exclusions`
  Progress-per-tick math, owned by `BUILD-001..010`.
- `Verification Notes`
  Canonical order must be lifted from the API guard. The executable case
  list lives in `src/matrices/build-validation.ts`.

### REPAIR-VALIDATION

- `Catalog Entries`
  `REPAIR-010`
- `Canonical Source`
  Official `Creep.repair()` API guard in `@screeps/engine/src/game/creeps.js`
  and the repair processor in
  `@screeps/engine/src/processor/intents/creeps/repair.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `creep.repair(target)` ownership, caller busy state, body-part
  requirements (`WORK`), resource availability (energy), target validity
  (not a structure), and range.
- `Exclusions`
  Hits-per-tick math, owned by `REPAIR-001..009`.
- `Verification Notes`
  Canonical order must be lifted from the API guard. The executable case
  list lives in `src/matrices/repair-validation.ts`.

### DISMANTLE-VALIDATION

- `Catalog Entries`
  `DISMANTLE-009`
- `Canonical Source`
  Official `Creep.dismantle()` API guard in
  `@screeps/engine/src/game/creeps.js` and the dismantle processor in
  `@screeps/engine/src/processor/intents/creeps/dismantle.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `creep.dismantle(target)` ownership, caller busy state, body-part
  requirements (`WORK`), target validity (not a dismantleable structure),
  and range.
- `Exclusions`
  Dismantle yield math, owned by `DISMANTLE-001..008`.
- `Verification Notes`
  Canonical order must be lifted from the API guard. The executable case
  list lives in `src/matrices/dismantle-validation.ts`.

### CTRL-ATTACK-VALIDATION

- `Catalog Entries`
  `CTRL-ATTACK-007`
- `Canonical Source`
  Official `Creep.attackController()` API guard in
  `@screeps/engine/src/game/creeps.js` and the attack-controller processor
  in `@screeps/engine/src/processor/intents/creeps/attackController.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `creep.attackController(target)` ownership, caller busy state, body-part
  requirements (`CLAIM`), target validity (no controller, own controller,
  unowned), range, and cooldown (`CONTROLLER_ATTACK_BLOCKED_UPGRADE`).
- `Exclusions`
  Reservation-reduction math, owned by `CTRL-RESERVE-007`.
- `Verification Notes`
  Canonical order must be lifted from the API guard. The executable case
  list lives in `src/matrices/ctrl-attack-validation.ts`.

### CTRL-CLAIM-VALIDATION

- `Catalog Entries`
  `CTRL-CLAIM-008`
- `Canonical Source`
  Official `Creep.claimController()` API guard in
  `@screeps/engine/src/game/creeps.js` and the claim-controller processor
  in `@screeps/engine/src/processor/intents/creeps/claimController.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `creep.claimController(target)` ownership, caller busy state, body-part
  requirements (`CLAIM`), GCL availability (`ERR_GCL_NOT_ENOUGH` and
  `ERR_FULL` for room cap), target validity (already owned/reserved/no
  controller), and range.
- `Exclusions`
  Successful claim side-effects (`safeModeAvailable`, downgrade timer
  reset) — owned by separate `CTRL-CLAIM-*` entries.
- `Verification Notes`
  Canonical order must be lifted from the API guard. The executable case
  list lives in `src/matrices/ctrl-claim-validation.ts`.

### CTRL-RESERVE-VALIDATION

- `Catalog Entries`
  `CTRL-RESERVE-008`
- `Canonical Source`
  Official `Creep.reserveController()` API guard in
  `@screeps/engine/src/game/creeps.js` and the reserve-controller
  processor in
  `@screeps/engine/src/processor/intents/creeps/reserveController.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `creep.reserveController(target)` ownership, caller busy state, body-part
  requirements (`CLAIM`), target validity (owned, hostile reservation, no
  controller), and range.
- `Exclusions`
  Reservation-reduction (handled via `attackController`), owned by
  `CTRL-RESERVE-007`.
- `Verification Notes`
  Canonical order must be lifted from the API guard. The executable case
  list lives in `src/matrices/ctrl-reserve-validation.ts`.

### CTRL-UPGRADE-VALIDATION

- `Catalog Entries`
  `CTRL-UPGRADE-013`
- `Canonical Source`
  Official `Creep.upgradeController()` API guard in
  `@screeps/engine/src/game/creeps.js` and the upgrade-controller
  processor in
  `@screeps/engine/src/processor/intents/creeps/upgradeController.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `creep.upgradeController(target)` ownership, caller busy state, body-part
  requirements (`WORK`), resource availability (energy), target validity
  (not yours, blocked by another player's safe mode), and range.
- `Exclusions`
  Progress math and level-advance side effects, owned by
  `CTRL-UPGRADE-001..012`.
- `Verification Notes`
  Canonical order must be lifted from the API guard. The executable case
  list lives in `src/matrices/ctrl-upgrade-validation.ts`.

### CTRL-GENSAFE-VALIDATION

- `Catalog Entries`
  `CTRL-GENSAFE-005`
- `Canonical Source`
  Official `Creep.generateSafeMode()` API guard in
  `@screeps/engine/src/game/creeps.js` and the generate-safe-mode processor
  in
  `@screeps/engine/src/processor/intents/creeps/generateSafeMode.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `creep.generateSafeMode(target)` ownership, caller busy state, resource
  availability (Ghodium), target validity (not yours or no controller),
  and range.
- `Exclusions`
  `safeModeAvailable` increment side-effect, owned by `CTRL-GENSAFE-003`.
- `Verification Notes`
  Canonical order must be lifted from the API guard. The executable case
  list lives in `src/matrices/ctrl-gensafe-validation.ts`.

### CTRL-SIGN-VALIDATION

- `Catalog Entries`
  `CTRL-SIGN-004`
- `Canonical Source`
  Official `Creep.signController()` API guard in
  `@screeps/engine/src/game/creeps.js` and the sign-controller processor
  in `@screeps/engine/src/processor/intents/creeps/signController.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `creep.signController(target, sign)` caller busy state, target validity
  (no controller), argument validity (sign exceeds maximum length), and
  range.
- `Exclusions`
  Persisted-sign visibility, owned by `CTRL-SIGN-001..003`.
- `Verification Notes`
  No `ERR_NOT_OWNER` branch — any creep may sign any controller. Canonical
  order must be lifted from the API guard. The executable case list lives
  in `src/matrices/ctrl-sign-validation.ts`.

### HARVEST-VALIDATION

- `Catalog Entries`
  `HARVEST-015`
- `Canonical Source`
  Official `Creep.harvest()` API guard in `@screeps/engine/src/game/creeps.js`
  and the harvest processor in
  `@screeps/engine/src/processor/intents/creeps/harvest.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `creep.harvest(source)` ownership, caller busy state, body-part
  requirements (`WORK`), target validity (target is a `Source`), range,
  and resource availability (depleted source).
- `Exclusions`
  Harvest yield math, owned by `HARVEST-001..014`. Mineral and deposit
  variants are owned by `HARVEST-MINERAL-VALIDATION` and
  `DEPOSIT-HARVEST-VALIDATION`.
- `Verification Notes`
  Canonical order must be lifted from the API guard. The executable case
  list lives in `src/matrices/harvest-validation.ts`.

### HARVEST-MINERAL-VALIDATION

- `Catalog Entries`
  `HARVEST-MINERAL-014`
- `Canonical Source`
  Official `Creep.harvest()` API guard in `@screeps/engine/src/game/creeps.js`
  and the mineral-harvest path in
  `@screeps/engine/src/processor/intents/creeps/harvest.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `creep.harvest(mineral)` ownership, caller busy state, body-part
  requirements (`WORK`), target validity (target is a `Mineral`),
  extractor presence (`StructureExtractor` co-located and active), range,
  resource availability (mineral amount), and cooldown (extractor
  cooldown).
- `Exclusions`
  Harvest yield math, owned by `HARVEST-MINERAL-001..013`.
- `Verification Notes`
  Extractor activity is part of this family because it gates the mineral
  branch in vanilla. Canonical order must be lifted from the API guard.
  The executable case list lives in
  `src/matrices/harvest-mineral-validation.ts`.

### DEPOSIT-HARVEST-VALIDATION

- `Catalog Entries`
  `DEPOSIT-HARVEST-006`
- `Canonical Source`
  Official `Creep.harvest()` API guard in `@screeps/engine/src/game/creeps.js`
  and the deposit-harvest path in
  `@screeps/engine/src/processor/intents/creeps/harvest.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `creep.harvest(deposit)` ownership, caller busy state, body-part
  requirements (`WORK`), target validity (target is a `Deposit`), range,
  and cooldown (`Deposit.cooldown`).
- `Exclusions`
  Harvest yield math, owned by `DEPOSIT-HARVEST-001..005`. Deposit decay
  on overharvest is owned by `DEPOSIT-*` lifecycle entries.
- `Verification Notes`
  Canonical order must be lifted from the API guard. The executable case
  list lives in `src/matrices/deposit-harvest-validation.ts`.

### DROP-VALIDATION

- `Catalog Entries`
  `DROP-011`
- `Canonical Source`
  Official `Creep.drop()` API guard in `@screeps/engine/src/game/creeps.js`
  and the drop processor in
  `@screeps/engine/src/processor/intents/creeps/drop.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `creep.drop(resourceType, amount?)` ownership, caller busy state,
  argument validity (resourceType, amount), and resource availability.
- `Exclusions`
  Resource-pile merge/separate semantics, owned by `DROP-001..010`.
- `Verification Notes`
  Canonical order must be lifted from the API guard. The executable case
  list lives in `src/matrices/drop-validation.ts`.

### MOVE-BASIC-VALIDATION

- `Catalog Entries`
  `MOVE-BASIC-027`
- `Canonical Source`
  Official `Creep.move()` API guard in `@screeps/engine/src/game/creeps.js`
  and the move processor in
  `@screeps/engine/src/processor/intents/creeps/move.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `creep.move(direction)` ownership, caller busy state, body-part
  requirements (`MOVE`), fatigue, and argument validity (direction
  constant).
- `Exclusions`
  Collision resolution, owned by `MOVE-COLLISION-*`. Pulling/`move(creep)`
  overload, owned by `MOVE-PULL-VALIDATION`.
- `Verification Notes`
  Canonical order must be lifted from the API guard. The executable case
  list lives in `src/matrices/move-basic-validation.ts`.

### MOVE-PULL-VALIDATION

- `Catalog Entries`
  `MOVE-PULL-011`
- `Canonical Source`
  Official `Creep.pull()` API guard in `@screeps/engine/src/game/creeps.js`
  and the pull processor in
  `@screeps/engine/src/processor/intents/creeps/pull.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `creep.pull(target)` ownership, caller busy state, target validity
  (target not a creep, or target is self), and range.
- `Exclusions`
  Pull-pact resolution and fatigue propagation, owned by
  `MOVE-PULL-001..010`.
- `Verification Notes`
  Canonical order must be lifted from the API guard. The executable case
  list lives in `src/matrices/move-pull-validation.ts`.

### PICKUP-VALIDATION

- `Catalog Entries`
  `PICKUP-010`
- `Canonical Source`
  Official `Creep.pickup()` API guard in `@screeps/engine/src/game/creeps.js`
  and the pickup processor in
  `@screeps/engine/src/processor/intents/creeps/pickup.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `creep.pickup(target)` ownership, caller busy state, target validity
  (target not a `Resource`), store capacity (creep full), and range.
- `Exclusions`
  Resource-pile decrement math, owned by `PICKUP-001..009`.
- `Verification Notes`
  Canonical order must be lifted from the API guard. The executable case
  list lives in `src/matrices/pickup-validation.ts`.

### TRANSFER-VALIDATION

- `Catalog Entries`
  `TRANSFER-015`
- `Canonical Source`
  Official `Creep.transfer()` API guard in
  `@screeps/engine/src/game/creeps.js` and the transfer processor in
  `@screeps/engine/src/processor/intents/creeps/transfer.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `creep.transfer(target, resourceType, amount?)` ownership, caller busy
  state, argument validity (resourceType, amount), resource availability
  (creep store), target validity (target not a transfer destination,
  hostile, wrong store kind), store capacity (target full), and range.
- `Exclusions`
  Successful transfer side effects (link cooldown, factory store),
  owned by `TRANSFER-001..014`.
- `Verification Notes`
  Canonical order must be lifted from the API guard. The executable case
  list lives in `src/matrices/transfer-validation.ts`.

### WITHDRAW-VALIDATION

- `Catalog Entries`
  `WITHDRAW-017`
- `Canonical Source`
  Official `Creep.withdraw()` API guard in
  `@screeps/engine/src/game/creeps.js` and the withdraw processor in
  `@screeps/engine/src/processor/intents/creeps/withdraw.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `creep.withdraw(target, resourceType, amount?)` ownership, caller busy
  state, argument validity, target validity (target not a withdrawable
  store or hostile), resource availability (target store), store capacity
  (creep full), and range.
- `Exclusions`
  Successful withdraw side effects, owned by `WITHDRAW-001..016`.
- `Verification Notes`
  Canonical order must be lifted from the API guard. The executable case
  list lives in `src/matrices/withdraw-validation.ts`.

### CONSTRUCTION-SITE-CREATE-VALIDATION

- `Catalog Entries`
  `CONSTRUCTION-SITE-011`
- `Canonical Source`
  Official `Room.createConstructionSite()` API guard in
  `@screeps/engine/src/game/rooms.js` and the create-construction-site
  processor in
  `@screeps/engine/src/processor/intents/global/create-construction-site.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `Room.createConstructionSite(x, y, structureType, name?)` argument
  validity (coords, structureType, name), ownership (room not owned by
  another player), active-structure state (RCL gate for the requested
  type), target validity (terrain wall, blocking structure on tile), and
  structure-cap state (`CONTROLLER_STRUCTURES` cap and per-player
  `MAX_CONSTRUCTION_SITES` cap).
- `Exclusions`
  `RoomPosition.createConstructionSite()` delegates to the room method —
  owned by `CONSTRUCTION-SITE-010`.
- `Verification Notes`
  Canonical order must be lifted from the API guard. The executable case
  list lives in
  `src/matrices/construction-site-create-validation.ts`.

### FLAG-CREATE-VALIDATION

- `Catalog Entries`
  `FLAG-009`
- `Canonical Source`
  Official `Room.createFlag()` API guard in
  `@screeps/engine/src/game/rooms.js` and the create-flag processor in
  `@screeps/engine/src/processor/intents/global/create-flag.js`.
- `Dimensions`
  failure condition, expected return code, precedence when multiple blockers
  are present
- `Applicability`
  `Room.createFlag(x, y, name?, color?, secondaryColor?)` argument
  validity (coords, name length, color constants), name uniqueness
  (`ERR_NAME_EXISTS`), and flag cap (`FLAGS_LIMIT`).
- `Exclusions`
  `RoomPosition.createFlag()` is owned by `ROOMPOS-ACTION-002`.
- `Verification Notes`
  Canonical order must be lifted from the API guard. The executable case
  list lives in `src/matrices/flag-create-validation.ts`.
