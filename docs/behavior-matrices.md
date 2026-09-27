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

The executable case list lives in `src/matrices/`, or inline in the test for
a short list no other test runs; this document is the human-readable
scope/source definition, and each definition's `Verification Notes` says
where its list lives, or that none enumerates the family yet.

## Entry Format

Every `matrix` entry in `behaviors.md` belongs to a definition, and every
case list in `src/matrices/` is named by one; `tests/00-framework/matrices.test.ts`
checks both. Each definition has these fields, in this order:

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

### STALE-RECEIVER

- `Catalog Entries`
  `UNDOC-STALERECV-001`
- `Canonical Source`
  Vanilla runtime behavior for public method calls on cached `RoomObject`
  wrappers whose backing object has been removed before the call.
- `Dimensions`
  receiver class, public method, setup removal path
- `Applicability`
  Source-confirmed rows currently include cached removed
  `ConstructionSite.remove()`, cached removed
  `Structure.notifyWhenAttacked(enabled)`, cached removed
  `StructureSpawn.spawnCreep()` / `renewCreep()` / `recycleCreep()`,
  cached removed `StructureLink.transferEnergy(target, amount)`, and cached
  removed `StructureTower.attack(target)` / `heal(target)` / `repair(target)`.
- `Exclusions`
  Stale target arguments, getter or field reads on stale cached objects, and
  `Structure.destroy()` as a stale receiver behavior.
- `Verification Notes`
  Each row must be verified against vanilla before being added. The matrix
  asserts only that the engine throws a runtime error on the stale call
  (`errorKind === 'runtime'`); exact error wording is allowed to differ
  between engines. Vanilla throws `Could not find an object with ID ...`,
  except `StructureSpawn.recycleCreep`, which bypasses the `data()` helper
  and throws a TypeError. The executable case list lives in
  `src/matrices/stale-receiver.ts`.

### STALE-ARGUMENT

- `Catalog Entries`
  `UNDOC-STALEARG-001`
- `Canonical Source`
  Vanilla runtime behavior for public action methods called on a fresh
  receiver with a cached `RoomObject` wrapper passed as a target argument
  whose backing object has been removed before the call.
- `Dimensions`
  receiver class, public method, target argument class, setup removal path
- `Applicability`
  Source-confirmed rows currently span `Creep` action methods that take a
  target argument (`transfer`, `withdraw`, `attack`, `heal`, `rangedAttack`,
  `rangedHeal`, `repair`, `dismantle`, `build`, `pickup`, `pull`) and
  structure target-takers (`StructureTower.attack` / `heal` / `repair`,
  `StructureLink.transferEnergy`, `StructureSpawn.renewCreep` /
  `recycleCreep`).
- `Exclusions`
  Stale receivers (the method's `this`) are owned by `UNDOC-STALERECV-001`;
  stale getter / field reads on cached objects are out of scope; live
  cross-tick wrapper access (where the backing object is still alive) is
  its own undocumented gap and out of scope here. Methods whose only
  object-typed arguments target singleton room objects that cannot be
  removed (`Source`, `Mineral`, `StructureController`) are excluded.
- `Verification Notes`
  Each row must be verified against vanilla before being added. Each case
  pins vanilla's rejection (`expected`): `ERR_INVALID_TARGET`, or a runtime
  error for `Creep.withdraw`, whose check reads `data(target.id).store`
  before the target test (`game/creeps.js:509`). A case whose action spends
  from or fills the receiver's store also checks the store is unchanged.
  The executable case list lives in `src/matrices/stale-argument.ts`.

### JSON-OBJECT

- `Catalog Entries`
  `UNDOC-JSONOBJ-001`
- `Canonical Source`
  Vanilla runtime behavior for direct `JSON.stringify()` on live game
  objects, including ordinary end-of-tick memory serialization of object
  graphs containing live game objects.
- `Dimensions`
  object class / ownership perspective, selector path, representative
  public scalar fields copied into the parsed JSON snapshot
- `Applicability`
  Direct `JSON.stringify()` on `Room`, `RoomPosition`, and canonical
  visible `RoomObject` families: creeps, power creeps, controllers,
  structures, sources, minerals, deposits, resources, construction sites,
  flags, tombstones, ruins, and nukes. Rows that require optional object
  families are capability-gated.
- `Exclusions`
  Complete serialized object shape, function or prototype preservation,
  cross-tick identity, and arbitrary `Memory` round-trip behavior. Those
  are separate API surfaces.
- `Verification Notes`
  The matrix asserts that serialization does not throw, that the result is
  parseable JSON, and that representative scalar fields on the parsed
  snapshot match the live object at serialization time. The executable case
  list lives in `src/matrices/json-objects.ts`.

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
  `STORE-RESTRICTED-002`, `STORE-RESTRICTED-003`,
  `STORE-RESTRICTED-004`, `STORE-RESTRICTED-005`, `STORE-BIND-002`
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
  Lab remains part of this family even though its allowed mineral type binds
  on the first deposit; `STORE-BIND-002` runs that binding for `H`, `O` and
  `G`, a list inline in its test. The executable case lists live in
  `src/matrices/store-restricted.ts` and, for the null capacities of
  resources a nuker or power spawn never takes (`STORE-RESTRICTED-004`),
  `src/matrices/store-disallowed.ts`.

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
  Vanilla's `ERR_TIRED` branches on a `cooldownTime` the `cooldown` getter
  exposes: `@screeps/engine/src/game/structures.js:321` (`runReaction`),
  `:364` (`reverseReaction`), `:454` (`unboostCreep`), `:504`
  (`transferEnergy`), `:730` (`send`), `:1370` (`launchNuke`), `:1439`
  (`produce`); `market.js:134` (`deal`, the terminal's); `creeps.js:383`
  and `:391` (`harvest`, the extractor's and the deposit's);
  `power-creeps.js:268` (`usePower`, the power's).
- `Dimensions`
  gated action
- `Applicability`
  The eleven actions the source lists, each at cooldown `1` and `0`
- `Exclusions`
  Gates that aren't a `cooldown` getter: creep fatigue (`move`),
  `upgradeBlocked` (`attackController`), `safeMode`, and a power creep's
  wall-clock `spawnCooldownTime`
- `Verification Notes`
  No case list enumerates the family yet: the test
  (`tests/23-store-api/23.5-timers.test.ts`) runs `runReaction` only.

### TIMER-SAFEMODE

- `Catalog Entries`
  `TIMER-SAFEMODE-001`
- `Canonical Source`
  Vanilla's game-layer safe-mode refusals, which read the controller's
  `safeMode` getter (`@screeps/engine/src/game/structures.js:184`, `undefined`
  once the timer has run out): `game/creeps.js` for the intents
  `CTRL-SAFEMODE-006` lists, `game/power-creeps.js:258` (`usePower`,
  `ERR_INVALID_ARGS`) and `:311` (`enableRoom`, `ERR_INVALID_TARGET`).
- `Dimensions`
  gated action
- `Applicability`
  The ten actions the row lists, each on the controller's last safe-mode tick
  (`safeMode` reads `1`) and the tick after
- `Exclusions`
  Safe mode's effect on movement and on construction-site stomping
  (`SAFEMODE-COMBAT-002`), and `claimController`, whose guard is unreachable
  (`CTRL-SAFEMODE-006`)
- `Verification Notes`
  No case list enumerates the family yet: the test
  (`tests/23-store-api/23.5-timers.test.ts`) runs a hostile `attack` only.

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
  `CONTROLLER_STRUCTURES` and `checkStructureAgainstController`
  (`@screeps/engine/src/utils.js:456-490`), which `isActive()` calls.
- `Dimensions`
  structure type, controller level (1-8) at which its limit changes
- `Applicability`
  Spawn, extension, link, tower and lab: the owned types a room can hold more
  of than one
- `Exclusions`
  Roads, constructed walls and containers, which are unowned and always active
  (`utils.js:458`); storage, terminal, observer, power spawn, extractor, nuker
  and factory, allowed once at RCL 8 and never counted (`utils.js:474`);
  ramparts, whose 2500 a room can't hold; distance-to-controller
  tie-breaking between same-type structures
- `Verification Notes`
  Each case places one more structure than the level allows and reads the
  active count. Inactive-below-RCL behavior is owned by `CTRL-STRUCTLIMIT-002`.
  The executable case list lives in `src/matrices/ctrl-structlimit.ts`.

### CONTROLLER-LEVELS

- `Catalog Entries`
  `CTRL-UPGRADE-007`
- `Canonical Source`
  The controller's `progressTotal` getter,
  `@screeps/engine/src/game/structures.js:181`, from `CONTROLLER_LEVELS`.
- `Dimensions`
  controller level (1-8)
- `Applicability`
  An owned controller at each level: `CONTROLLER_LEVELS[level]` at 1-7,
  `undefined` at 8
- `Exclusions`
  The upgrade amount per tick, and level-up (`CTRL-UPGRADE-012`)
- `Verification Notes`
  The test (`tests/06-controller/6.4-upgrade.test.ts`) still compares
  `CONTROLLER_LEVELS` with a literal table and never reads a controller, so
  no engine runs the row yet.

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
  Vanilla's tower target checks, `@screeps/engine/src/game/structures.js:770`
  (`attack`: creeps, power creeps, structures), `:790` (`heal`: creeps,
  power creeps) and `:810` (`repair`: structures). The controller is a
  registered structure (`game/game.js:298-300`), so it passes.
- `Dimensions`
  tower action, target class
- `Applicability`
  `attack`, `heal` and `repair` against a creep, a power creep, a structure
  with hits, the controller (a structure without), a construction site and
  a source: 18 return codes
- `Exclusions`
  What the processor then does with an accepted target, range falloff, and
  tower intent priority
- `Verification Notes`
  No case list enumerates the target classes yet. The tests
  (`tests/07-combat/7.12-tower-intent.test.ts`,
  `tests/07-combat/7.9-7.11-tower.test.ts`) run a hostile creep and a
  construction site for `attack`, a friendly creep for `heal`, and a damaged
  rampart and a creep for `repair`.

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
  Room-status restrictions are not part of this executable validation matrix;
  `NUKE-LAUNCH-014` through `NUKE-LAUNCH-017` register and test those vanilla
  behaviors explicitly through `RoomSpec.status`.
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
  visibility case.
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

### NUKE-IMPACT-FOOTPRINT

- `Catalog Entries`
  `NUKE-IMPACT-014`
- `Canonical Source`
  Official nuke impact processor (`@screeps/engine/src/processor/intents/nukes/tick.js:39-44`)
  — nested `dx,dy ∈ [-2, 2]` loop with
  `damage = range == 0 ? NUKE_DAMAGE[0] : NUKE_DAMAGE[2]`.
- `Dimensions`
  per-tile offset `(dx, dy)` over the 7x7 box around the impact, derived
  Chebyshev range, and expected per-tile damage.
- `Applicability`
  Structure damage on a single rampart placed at each tile of the 7x7 box,
  pinning every cell of the 5x5 blast (range 0-2) and every cell of the
  range-3 ring (no damage).
- `Exclusions`
  Creep deaths, room-wide cleanup, controller side effects, multiple-nuke
  cumulative damage, and rampart-vs-covered-structure absorption (those are
  owned by `NUKE-IMPACT-005`, `NUKE-IMPACT-006`, `NUKE-IMPACT-009`-`012`, and
  `RAMPART-PROTECT-008`).
- `Verification Notes`
  Single nuke landing per row keeps each cell's damage attributable to one
  observable; high-hits ramparts ensure the engine can record full damage
  without dropping the rampart to 0.
  The executable case list lives in `src/matrices/nuke-impact-footprint.ts`.

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
  remain in the local boost facets. The case list is
  `src/matrices/boost-tables.ts`, which no test runs yet: the section 8 tests
  loop over `BOOSTS` directly.

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

### ROAD-TERRAIN-RATIO

- `Catalog Entries`
  `ROAD-HITS-001`, `CONSTRUCTION-COST-003`
- `Canonical Source`
  `CONSTRUCTION_COST_ROAD_SWAMP_RATIO` and `CONSTRUCTION_COST_ROAD_WALL_RATIO`,
  applied by `Room.createConstructionSite()` (`@screeps/engine/src/game/rooms.js`)
  to a road site's cost and by the build processor
  (`@screeps/engine/src/processor/intents/creeps/build.js:171-187`) to a
  completed road's hits.
- `Dimensions`
  terrain under the road tile
- `Applicability`
  Plain, swamp, and natural-wall tiles for a completed road's hits
  (`ROAD-HITS-001`); swamp and natural-wall tiles for a road site's
  `progressTotal` (`CONSTRUCTION-COST-003`), since plain is
  `CONSTRUCTION-COST-001`'s
- `Exclusions`
  Road decay by terrain (`ROAD-DECAY`) and road wear
- `Verification Notes`
  Both place through player code, since a placement helper would skip the
  scaling. The case lists are inline in
  `tests/13-structures-infrastructure/13.1-13.2-road.test.ts` and
  `tests/15-structure-common/15.3-construction-cost.test.ts`.

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
  Terrain multipliers for roads (`ROAD-TERRAIN-RATIO`) and construction-site
  progress side behavior
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

### CONSTRUCTION-SITE-OVER-STRUCTURE

- `Catalog Entries`
  `CONSTRUCTION-SITE-017`
- `Canonical Source`
  Vanilla `utils.checkConstructionSite`
  (`@screeps/engine/src/utils.js:181-184`): a site is rejected with
  `ERR_INVALID_TARGET` when a structure of another `CONSTRUCTION_COST` type
  occupies the tile and neither it nor the placed type is a road or rampart.
- `Dimensions`
  existing structure type, placed site type
- `Applicability`
  Twelve representative pairs of spawn, extension, tower, container, road and
  rampart: five where two non-road, non-rampart types block each other (a
  container against the rest, both ways), seven where a road or rampart on
  either side stacks
- `Exclusions`
  Same-type stacking (`utils.js:172`) and site-on-site placement, owned by
  `CONSTRUCTION-SITE-011:invalidTarget`
- `Verification Notes`
  The executable case list lives in
  `src/matrices/construction-site-over-structure.ts`.

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
  Raw buffer shape
- `Verification Notes`
  This family is about mask values only. The executable case list lives in
  `src/matrices/room-terrain.ts`.

### ROOM-EVENTLOG

- `Catalog Entries`
  `ROOM-EVENTLOG-002`
- `Canonical Source`
  Vanilla's event pushes: `@screeps/engine/src/processor/intents/_damage.js:93`
  (creep `attack` via `creeps/attack.js`, tower `attack` via
  `towers/attack.js:52`), `towers/heal.js:51`, `towers/repair.js:52`, and
  `creeps/harvest.js:110` (mineral).
- `Dimensions`
  event source
- `Applicability`
  The five sources the row lists, one actor and target each
- `Exclusions`
  Sources another 16.6 row owns (creep death and attack kills, transfers,
  exits, controller actions, source harvest, build, creep repair, creep heals,
  ranged and mass attacks, hit-back, nukes, dismantle, powers); invader-core
  controller actions and transfers, which only its NPC logic drives; a
  deposit harvest, which the docs promise and vanilla doesn't log
  (`ROOM-EVENTLOG-028`); raw JSON form and current-tick exposure
- `Verification Notes`
  No case list enumerates the sources yet: the test
  (`tests/16-room-mechanics/16.6-eventlog.test.ts`) checks the tower's
  `EVENT_HEAL`, and `ROOM-EVENTLOG-001`'s test logs a creep melee attack.

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
  covers creep targets damaged or healed by creep and tower actions; no row
  covers a structure or power creep target.

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
  `runReaction` / `reverseReaction`; no row covers factory production.

### SOURCE-REGEN

- `Catalog Entries`
  `SOURCE-REGEN-001`
- `Canonical Source`
  Source capacity constants and the source tick
  (`@screeps/engine/src/processor/intents/sources/tick.js:46-59`).
- `Dimensions`
  room state
- `Applicability`
  Owned, reserved, and neutral rooms, each reached the way a player reaches
  it (a claim, a reservation, a reservation that lapses) from a neutral
  room's capacity; keeper rooms, which have no controller
  (`RoomSpec.controller: false`)
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
  This family covers decay-time mapping only. `RUIN_DECAY_STRUCTURES` has one
  entry, `powerBank`; RUIN-002 has a test for it and one for a default
  (a destroyed container), in `tests/18-game-objects/18.2-ruin.test.ts`.

### GCL-LEVELS

- `Catalog Entries`
  `GCL-001`
- `Canonical Source`
  `Game.gcl` in `@screeps/engine/src/game/game.js:130-131,158-162`, from
  `GCL_MULTIPLY` and `GCL_POW`.
- `Dimensions`
  GCL level edge
- `Applicability`
  The last point of level 1, and the first point of levels 2 and 3 (level 3's
  threshold is the first that isn't a whole number)
- `Exclusions`
  GCL growth from upgrading (`CTRL-UPGRADE-008`) and the room limit a level
  sets (`CTRL-CLAIM-008:gclNotEnough`)
- `Verification Notes`
  The case list is inline in `tests/06-controller/6.11-gcl.test.ts`.

### GPL-LEVELS

- `Catalog Entries`
  `GPL-002`
- `Canonical Source`
  `Game.gpl` in `@screeps/engine/src/game/game.js:133-134`, from
  `POWER_LEVEL_MULTIPLY` and `POWER_LEVEL_POW`.
- `Dimensions`
  account power at a level edge
- `Applicability`
  999, 1000, 3999, 4000 and 9000 power: each side of the first two levels,
  and level three
- `Exclusions`
  Zero power (`GPL-001`) and spending power on power creeps
- `Verification Notes`
  The case list is inline in `tests/19-power/19.0-gpl.test.ts`.

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
  Spawn, renew, and upgrade run their case lists from
  `src/matrices/power-creep-spawn-validation.ts`,
  `src/matrices/power-creep-renew-validation.ts`, and
  `src/matrices/power-creep-upgrade-validation.ts`.

### POWER-INFO

- `Catalog Entries`
  `POWER-OPERATE-001`, `POWER-OPERATE-002`, `POWER-DISRUPT-001`,
  `POWER-DISRUPT-002`, `POWER-REGEN-001`, `POWER-REGEN-002`,
  `POWER-COMBAT-001`, `POWER-GENERATE-001`, `TOWER-POWER-001`,
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
  Each row's test reads its power's `POWER_INFO` entry directly.

### POWER-TARGETS

- `Catalog Entries`
  `POWER-OPERATE-005`, `POWER-DISRUPT-003`, `POWERCREEP-ENABLE-003`
- `Canonical Source`
  Official power API validation and target checks.
- `Dimensions`
  power, target class, room power-enabled state where relevant
- `Applicability`
  Room-bound operate powers and disrupt powers with structure targets
- `Exclusions`
  Table-driven effect magnitudes, cooldowns, ranges, and ops costs
- `Verification Notes`
  Vanilla's game-layer `usePower` has no target-type check; the processor's
  per-power switch drops a mismatched target without ops, cooldown or effect,
  and a room without power enabled returns `ERR_INVALID_ARGS` for any power
  (POWERCREEP-ENABLE-003, operate powers only). Valid targets' effect shapes
  are EFFECT-HOST-001's. The executable case list lives in
  `src/matrices/power-targets.ts`.

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
  Invader-core natural effects are excluded; `placeObject` takes no
  `effects` for a core.

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
  Normal in-world rooms, novice/respawn protection rooms, admin-closed rooms,
  valid-format room names outside the world, and invalid-format room names
- `Exclusions`
  Exit descriptions and linear-distance rules
- `Verification Notes`
  Timestamp presence and meaning is defined per returned status: invalid-format
  names return `undefined`; the two `closed` outcomes split on timestamp
  (admin-closed → number, off-world → null). The novice, respawn and
  admin-closed rows need the `roomStatus` capability.

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
  `INTENT-CREEP-002`
- `Canonical Source`
  Vanilla's driver stores one intent per object and intent name, the later
  call replacing the earlier (`@screeps/driver/lib/runtime/runtime.js:66-71`);
  every creep method queues through it (`@screeps/engine/src/game/creeps.js`,
  `intents.set`).
- `Dimensions`
  creep method
- `Applicability`
  The sixteen methods the row lists: those whose two calls can take different
  targets, directions, resources or text
- `Exclusions`
  Methods whose repeated calls can't differ visibly: `rangedMassAttack`,
  `suicide` and `generateSafeMode` take nothing that varies, a creep reaches
  one controller for `upgradeController`, `claimController`,
  `reserveController` and `attackController`, and `notifyWhenAttacked` sets
  nothing a player reads. Blocking priority between different methods
  (`INTENT-CREEP-001`, `-004`).
- `Verification Notes`
  No case list enumerates the methods yet: the test
  (`tests/24-intent-resolution/24.1b-intent-overwrite.test.ts`) calls
  `attack` twice.

### INTENT-CREEP-CANCEL

- `Catalog Entries`
  `INTENT-CREEP-003`
- `Canonical Source`
  `Creep.prototype.cancelOrder` (`@screeps/engine/src/game/creeps.js:1008-1014`)
  deletes the intent stored under the name it's given
  (`@screeps/driver/lib/runtime/runtime.js:92-99`), the intent name each
  method queues under (`moveTo` and `moveByPath` queue `move`).
- `Dimensions`
  creep intent name
- `Applicability`
  The twenty-three intents the row lists, each canceled once queued; one
  name with nothing queued (`ERR_NOT_FOUND`); and `cancelOrder('moveTo')`
  after a `moveTo`
- `Exclusions`
  `notifyWhenAttacked`, whose intent sets nothing a player reads; overwrite
  behavior and cross-method priority blocking
- `Verification Notes`
  No case list enumerates the intents yet: the tests
  (`tests/24-intent-resolution/24.1b-intent-overwrite.test.ts`) cancel a
  queued `attack`, and cancel `attack` with nothing queued.

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

### MEMORY-ACCESSORS

- `Catalog Entries`
  `MEMORY-007`
- `Canonical Source`
  The `memory` accessors in `@screeps/engine/src/game/rooms.js:551`,
  `structures.js:865` (spawn), `flags.js:33-49` and `power-creeps.js:75`, each
  reading and writing its `Memory` collection by name.
- `Dimensions`
  game object class
- `Applicability`
  `Room`, `StructureSpawn`, `Flag`, and a spawned `PowerCreep`, each written
  through the accessor and read through `Memory`, then the reverse
- `Exclusions`
  `creep.memory` (`UNDOC-CREEPMEM-001`), and the errors for writing another
  player's object's memory
- `Verification Notes`
  The case list is inline in `tests/25-memory/25.1-25.3-memory.test.ts`.

### RAWMEMORY-SEGMENTS

- `Catalog Entries`
  `RAWMEMORY-002`
- `Canonical Source`
  Official `RawMemory` runtime implementation and memory-segment limits
  (`@screeps/driver/lib/runtime/runtime.js:129-145` for ids and the active
  count, `:264` for a segment's length at the end of the tick).
- `Dimensions`
  segment id validity, per-segment length, active segment count
- `Applicability`
  `RawMemory.segments` and `RawMemory.setActiveSegments(ids)`
- `Exclusions`
  Foreign segments and main `Memory` parse/serialize behavior
- `Verification Notes`
  This family covers limit values only; next-tick activation is owned by
  `RAWMEMORY-003`. The executable case list lives in
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
  Single-branch rows are owned by `LAB-RUN-005..012`. Verified vanilla
  API-guard order is: ownership → cooldown → active RCL → target validity
  → range → caller capacity → reagent availability → argument/reaction
  validity.
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
  Single-branch rows are owned by `LAB-REVERSE-005..012`. Verified vanilla
  API-guard order is: ownership → cooldown → active RCL → target validity
  → range → same-output-lab argument validity → compound availability →
  reverse-pair validity → output capacity. The executable case list lives in
  `src/matrices/lab-reverse-validation.ts`.

### FACTORY-PRODUCE-VALIDATION

- `Catalog Entries`
  `FACTORY-PRODUCE-011`
- `Canonical Source`
  Official `StructureFactory.produce()` API guard in
  `@screeps/engine/src/game/structures.js` and the factory-produce processor
  in `@screeps/engine/src/processor/intents/factories/produce.js`.
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
  `FACTORY-PRODUCE-001` and `FACTORY-COMMODITY-*`. Level-mismatch/full and
  power-effect/full pairs are excluded from the executable matrix because
  leveled commodities reduce total stored resources before adding output, so
  they cannot also exercise the factory full branch.
- `Verification Notes`
  Verified vanilla API-guard order is: ownership → cooldown → argument
  validity → target validity (level mismatch) → active RCL → missing
  `PWR_OPERATE_FACTORY` effect → resources → capacity.
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
  target validity (target is a non-spawning creep), range, resource
  availability (energy then mineral), and matching unboosted body-part
  availability.
- `Exclusions`
  Successful body-part selection and boost type mapping, owned by
  `BOOST-CREEP-001..009`.
- `Verification Notes`
  Verified vanilla API-guard order is: ownership → active RCL → target
  validity → range → energy availability → mineral availability → matching
  unboosted body parts. The executable case list lives in
  `src/matrices/boost-creep-validation.ts`.

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
  `unboostCreep(creep)` target validity, ownership (lab and creep), active
  RCL, cooldown, boosted-part availability, and range.
- `Exclusions`
  Boost-mineral spillback amount, owned by `UNBOOST-004`. The
  invalid-target/not-found pair is excluded because a non-creep target cannot
  also have boosted body-part state.
- `Verification Notes`
  No `ERR_FULL` branch — surplus minerals spill onto the creep tile (see
  Coverage Notes in `8.2 Unboost`). Verified vanilla API-guard order is:
  target validity → ownership → active RCL → cooldown → boosted-part
  availability → range. The executable case list lives in
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
  active-structure state, argument validity (destination room name,
  resource type, description length), resource availability for the sent
  amount, cooldown, and energy-cost availability.
- `Exclusions`
  Energy-cost and range-fee math, owned by separate `TERMINAL-SEND-*`
  behavior entries.
- `Verification Notes`
  Verified vanilla API-guard order is: ownership → active RCL → destination
  room-name validity → resource-type validity → sent-resource availability
  → cooldown → terminal energy-cost availability → description validity.
  The executable case list lives in `src/matrices/terminal-send-validation.ts`.

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
  source/target ownership, resource availability, target capacity, same-room
  range, and cooldown.
- `Exclusions`
  Same-room loss-free transfer and cross-room loss math, owned by
  separate `LINK-*` behavior entries.
- `Verification Notes`
  Verified vanilla API-guard order is: amount argument validity → target
  validity → target ownership → source ownership under rampart visibility →
  cooldown → active RCL → source energy availability → target capacity →
  same-room range. The executable case list lives in
  `src/matrices/link-validation.ts`.

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
  effective range. Verified vanilla API-guard order is: ownership → target
  validity → energy availability → active RCL.
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
  Verified vanilla API-guard order is: ownership → target validity → energy
  availability → active RCL. The executable case list lives in
  `src/matrices/tower-heal-validation.ts`.

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
  Verified vanilla API-guard order is: ownership → target validity → energy
  availability → active RCL. The executable case list lives in
  `src/matrices/tower-repair-validation.ts`.

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
  Verified vanilla API-guard order is: ownership → room-name argument
  validity → active RCL → observer room range. The executable case list
  lives in `src/matrices/observer-validation.ts`.

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
  `spawnCreep(body, name, opts?)` ownership, caller busy state (already
  spawning), argument validity (name/options, opts.directions, body), name
  uniqueness, and energy availability.
- `Exclusions`
  Successful directions/dryRun/memory semantics, owned by
  `SPAWN-CREATE-005..013` and `SPAWN-TIMING-*`. The inactive-spawn RCL
  branch is not in the executable precedence matrix because the public
  fixture API cannot honestly create a player-visible spawn that is inactive
  for `spawnCreep()` without adapter internals.
- `Verification Notes`
  Verified vanilla API-guard order for the covered branches is:
  name/options validity → name existence → directions validity → ownership
  → busy → body validity → energy availability. The executable case list
  lives in `src/matrices/spawn-create-validation.ts`.

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
  Renew amount math, owned by `RENEW-CREEP-002..009`. The inactive-spawn RCL
  branch is not in the executable precedence matrix because the public
  fixture API cannot honestly create a player-visible inactive spawn for
  `renewCreep()` without adapter internals.
- `Verification Notes`
  Verified vanilla API-guard order for the covered branches is: busy →
  target validity → ownership → range → energy availability → TTL-full.
  The executable case list lives in `src/matrices/renew-creep-validation.ts`.

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
  `recycleCreep(creep)` spawn ownership, target validity, target-creep
  ownership, and range.
- `Exclusions`
  Recycled-resource placement (container vs. tombstone), tracked as a
  Coverage Note in `9.5 Recycle Creep`. The inactive-spawn RCL branch is not
  in the executable precedence matrix because the public fixture API cannot
  honestly create a player-visible inactive spawn for `recycleCreep()`
  without adapter internals.
- `Verification Notes`
  Verified vanilla API-guard order for the covered branches is:
  spawn ownership → target validity → target ownership → range. The
  executable case list lives in `src/matrices/recycle-creep-validation.ts`.

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
  owned by `CTRL-SAFEMODE-008`. The cooldown comes from activating, which
  another active safe mode, an attack's `upgradeBlocked` or a low timer
  would refuse, so it pairs with none of them.
- `Verification Notes`
  Distinct from `CTRL-SAFEMODE-BLOCKED`, which describes how active safe
  mode blocks hostile actions. The three `ERR_TIRED` conditions are one
  expression (`game/structures.js:219-222`); `:upgradeBlocked` is set by
  another player's `attackController`. The executable case list lives in
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
  intentionally not part of this family. Verified vanilla API-guard order is:
  room/controller ownership → hostile-room busy. The executable case list lives in
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
  Verified vanilla API-guard order is: ownership → busy → body-part
  availability → target validity → range. The executable case list lives in
  `src/matrices/combat-melee-validation.ts`.

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
  Verified vanilla API-guard order is: ownership → busy → body-part
  availability → target validity → range. The executable case list lives in
  `src/matrices/combat-ranged-validation.ts`.

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
  Verified vanilla API-guard order is: ownership → busy → body-part
  availability. The executable case list lives in
  `src/matrices/combat-rma-validation.ts`.

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
  Verified vanilla API-guard order is: ownership → busy → body-part
  availability → target validity → range. The executable case list lives in
  `src/matrices/combat-heal-validation.ts`.

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
  Verified vanilla API-guard order is: ownership → busy → body-part
  availability → target validity → range. The executable case list lives in
  `src/matrices/combat-rangedheal-validation.ts`.

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
  The executable case list lives in `src/matrices/build-validation.ts`.

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
  The executable case list lives in `src/matrices/repair-validation.ts`.

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
  Dismantle yield math, owned by `DISMANTLE-001..008`. Another player's
  safe mode, checked after range, is owned by `CTRL-SAFEMODE-006`. Not yet
  listed: a target under `PWR_FORTIFY` or `EFFECT_INVULNERABILITY` returns
  `ERR_INVALID_TARGET` after that (`game/creeps.js:1040-1043`).
- `Verification Notes`
  The executable case list lives in `src/matrices/dismantle-validation.ts`.

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
  Reservation-reduction math, owned by `CTRL-RESERVE-007`. The
  invalid-controller-state/cooldown pair is excluded because attack cooldown
  is only established by successfully attacking a controller, which makes the
  later invalid-controller-state setup unavailable through public API state.
  Another player's safe mode, checked after the cooldown, is owned by
  `CTRL-SAFEMODE-006`. Not yet listed: a controller under
  `EFFECT_INVULNERABILITY` returns `ERR_INVALID_TARGET` last
  (`game/creeps.js:911-913`).
- `Verification Notes`
  The executable case list lives in `src/matrices/ctrl-attack-validation.ts`.

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
  requirements (`CLAIM`), GCL availability (`ERR_GCL_NOT_ENOUGH`), target
  validity (already owned/reserved/no controller), and range.
- `Exclusions`
  Successful claim side-effects (`safeModeAvailable`, downgrade timer
  reset) — owned by separate `CTRL-CLAIM-*` entries. The novice-room
  `ERR_FULL` branch is not in the executable matrix because that room status
  is not exposed by the public fixture API, nor is another player's safe
  mode (`ERR_NO_BODYPART`) after the controller checks. An owned and a
  reserved controller exclude each other.
- `Verification Notes`
  A reservation is made in-test with `reserveController`. The executable
  case list lives in `src/matrices/ctrl-claim-validation.ts`.

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
  `CTRL-RESERVE-007`. An owned and a reserved controller exclude each
  other.
- `Verification Notes`
  A reservation is made in-test with `reserveController`. The executable
  case list lives in `src/matrices/ctrl-reserve-validation.ts`.

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
  (not yours, blocked by another player's safe mode), range, and controller
  ownership.
- `Exclusions`
  Progress math and level-advance side effects, owned by
  `CTRL-UPGRADE-001..012`.
- `Verification Notes`
  A final invalid-controller-state guard exists in source but is not
  player-observable through public controller state. The executable case
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
  The executable case list lives in `src/matrices/ctrl-gensafe-validation.ts`.

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
  (target is a registered object), range, and target-is-controller validity.
- `Exclusions`
  Persisted-sign visibility, owned by `CTRL-SIGN-001..003`. Invalid-target
  cannot be paired with range or not-controller because an invalid target has
  no meaningful range or non-controller object state.
- `Verification Notes`
  The executable case list lives in `src/matrices/ctrl-sign-validation.ts`.

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
  requirements (`WORK`), target validity (omitted, `null`, id-less, or not
  a harvestable object), resource availability (depleted source), range,
  and the room controller's owner or reservation.
- `Exclusions`
  Harvest yield math, owned by `HARVEST-001..014`. Mineral and deposit
  variants are owned by `HARVEST-MINERAL-VALIDATION` and
  `DEPOSIT-HARVEST-VALIDATION`. Busy is excluded with both hostile-room
  conditions because a spawning creep cannot be placed in a room another
  player controls or reserves through the public fixture API. The four
  invalid-target forms exclude each other, the three with no target
  object exclude depletion and range, and a controller is owned or
  reserved, not both.
- `Verification Notes`
  The omitted, `null` and id-less targets fail one expression
  (`game/creeps.js:346`); an object of another type fails after the
  source, mineral and deposit branches. A reservation is made in-test with
  `reserveController`, since no room spec field seeds one. The executable
  case list lives in `src/matrices/harvest-validation.ts`.

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
  branch in vanilla. The executable case list lives in
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
  The executable case list lives in
  `src/matrices/deposit-harvest-validation.ts`.

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
  Resource-pile merge/separate semantics, owned by `DROP-001..010`. The two
  resource-availability conditions exclude each other: each sets what the
  creep carries.
- `Verification Notes`
  The executable case list lives in `src/matrices/drop-validation.ts`.

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
  `creep.move(target)` ownership, caller busy state, range of a creep
  target, fatigue, body-part requirements (`MOVE`), and argument validity
  (direction constant).
- `Exclusions`
  Collision resolution, owned by `MOVE-COLLISION-*`. Busy/fatigue and
  fatigue/no-bodypart are excluded because spawning creeps do not accrue
  fatigue and fatigue cannot be generated without MOVE parts through public
  movement state; range/invalid-args because the argument is a creep or a
  direction, not both.
- `Verification Notes`
  Vanilla checks a creep target's range before fatigue and body parts
  (`game/creeps.js:135-138`), so an adjacent creep target returns `OK` from
  a fatigued or MOVE-less creep. The executable case list lives in
  `src/matrices/move-basic-validation.ts`.

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
  (target not a creep, the creep itself, or a spawning creep), and range.
- `Exclusions`
  Pull-pact resolution and fatigue propagation, owned by
  `MOVE-PULL-001..010`. The three invalid-target forms exclude each other,
  and self/range because the creep is never out of its own range.
- `Verification Notes`
  Vanilla rejects all three invalid-target forms in one expression before
  the range check (`game/creeps.js:1102-1109`). The executable case list
  lives in `src/matrices/move-pull-validation.ts`.

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
  The executable case list lives in `src/matrices/pickup-validation.ts`.

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
  owned by `TRANSFER-001..014`. Pairs that need two resource types or two
  targets at once: the unknown and omitted resource type with each other
  and with the capacity and lab-mineral conditions, the lab with the
  storeless target, the capacity case, and the two full-spawn cases.
- `Verification Notes`
  The negative-amount check comes first (`game/creeps.js:435-437`), so its
  case passes a valid resource type. `:labMineral` cases need `chemistry`.
  The executable case list lives in `src/matrices/transfer-validation.ts`.

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
  Successful withdraw side effects, owned by `WITHDRAW-001..016`. The
  busy/safemode-not-owner pair is excluded because a spawning creep cannot be
  placed in a hostile safe-mode room through public fixture state; the
  disrupted terminal with safe mode because a power creep can't use a power
  in another player's safe mode; a power bank with a rampart owner because
  it has no player owner; and pairs that need two targets at once.
- `Verification Notes`
  `:disruptedTerminal` cases need `powerCreeps` and `powerEffects`: a power
  creep casts `PWR_DISRUPT_TERMINAL` in-test. `:invalidNuker` needs `nuke`
  and `:invalidPowerBank` needs `powerBank`. `:fullAmount` leaves the creep
  free capacity below `amount`, past the no-free-capacity check. The
  executable case list lives in `src/matrices/withdraw-validation.ts`.

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
  owned by `CONSTRUCTION-SITE-010`. Which types rcl 0 allows is owned by
  `CONSTRUCTION-SITE-012`/`-013`, and structure stacking by
  `CONSTRUCTION-SITE-017`. Pairs whose two conditions set the same thing
  (the coordinate, the type, the controller's owner, the tile) are
  excluded. Not yet listed: a spawn name another spawn or spawn site holds,
  or one created earlier in the tick (`ERR_INVALID_ARGS`,
  `game/rooms.js:1045-1050`).
- `Verification Notes`
  A reservation is made in-test with `reserveController`, and the player
  reads `controller.reservation` before the call (see
  `CONSTRUCTION-SITE-013`'s test). `:wallTerrain` needs `terrain`. The
  executable case list lives in
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
  Verified vanilla API-guard order is: coordinate validity → flag cap →
  color validity → name uniqueness → name length. The executable case list
  lives in `src/matrices/flag-create-validation.ts`.
