# screeps-ok Behavioral Catalog

A comprehensive enumeration of every testable Screeps gameplay behavior,
organized by game system and facet. Each entry maps to one canonical
conformance test or one generated test family.

**How to read this document:**
- **Area** = major game system (top-level heading)
- **Facet** = specific mechanic within that system (sub-heading)
- Coverage (which entries have tests) is tracked by scanning `tests/` — see
  `docs/coverage.html` for the current report
- Facets marked with a capability tag require that adapter capability
- Entries use the inline form `` `ID` `class` `oracle` ``
- `class` is one of `behavior` or `matrix`
- `oracle` records the current reference status, such as
  `verified_vanilla` or `needs_vanilla_verification`
- Matrix-backed and scoped shared-rule definitions live in
  `docs/behavior-matrices.md`

**Catalog entry rules:**
- A catalog entry must describe one public, deterministic, directly testable
  behavior with one clear interpretation.
- The catalog is intended to be comprehensive enough that an engine matching
  it is behaviorally indistinguishable from vanilla Screeps for the covered
  surface. Do not omit meaningful player-observable API contracts just because
  they are "edge cases" or validation branches.
- `behavior` entries describe one concrete gameplay rule and should usually map
  to one canonical test.
- `matrix` entries describe one gameplay rule that expands into a generated
  family of cases from a canonical table or data source.
- Every `matrix` entry must have a companion definition in
  `docs/behavior-matrices.md` covering canonical source, dimensions,
  applicability, and exclusions.
- If a statement requires unrelated assertions, split it into multiple entries.
- Distinct public call shapes and overloads are part of the behavior surface.
  If vanilla exposes multiple accepted input forms or overloads for one method,
  the catalog must explicitly own them unless a matrix definition covers the
  full family.
- Meaningful return-code branches and special-case success branches are part of
  the behavior surface. If players can observe a distinct `OK`,
  `ERR_INVALID_ARGS`, `ERR_INVALID_TARGET`, `ERR_NOT_FOUND`, etc., outcome for
  a method, that branch should normally have an owner.
- Phrase entries in terms of observable outcomes, not hidden implementation.
  Prefer statements like "moves one step toward a reachable target" over
  statements like "computes a path", unless the computation itself is public
  behavior.
- Shared mechanics should be cataloged once in the section that owns the
  mechanic. Wrapper-specific contracts and divergences should be cataloged in
  the wrapper type's section. Example: shared movement resolution belongs in
  movement, while power-creep-specific `ERR_BUSY` wrapper behavior belongs in
  the power-creep section.
- For shared-rule matrices in movement, applicability must explicitly say
  whether they cover all creep kinds, including spawned power creeps. If power
  creeps inherit the same public movement semantics through wrappers, include
  them in the matrix family unless the power-creep section owns a documented
  divergence. Do not let wrapper ownership accidentally remove parity coverage
  for inherited movement behavior.
- A catalog entry must describe established behavioral truth, not an
  attractive hypothesis. If a claimed rule has not yet been demonstrated well
  enough to trust as vanilla behavior, keep it in `Notes`, `Coverage Notes`, or
  `Framework Notes` until the behavior itself is established.
- Do not use catalog entries for editorial guidance, framework limitations,
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
- `MOVE-BASIC-001` `matrix` `verified_vanilla`
  `move(direction)` moves the creep one tile in the direction of the constant,
  for every Screeps direction constant, across creep kinds that use standard
  movement semantics, including spawned power creeps.
- `MOVE-BASIC-002` `behavior` `verified_vanilla`
  `move()` into a wall tile returns OK but the creep does not move.
- `MOVE-BASIC-003` `behavior` `verified_vanilla`
  `move()` returns `ERR_TIRED` when the creep's fatigue is greater than zero.
- `MOVE-BASIC-004` `behavior` `verified_vanilla`
  `move()` returns `ERR_NO_BODYPART` when the creep has no active MOVE parts.
- `MOVE-BASIC-005` `behavior` `verified_vanilla`
  `move()` returns `ERR_INVALID_ARGS` when given a value that is not a valid
  Screeps direction constant.
- `MOVE-BASIC-006` `behavior` `verified_vanilla`
  `move(targetCreep)` on an adjacent creep returns `OK`.
- `MOVE-BASIC-007` `behavior` `verified_vanilla`
  `move(targetCreep)` returns `ERR_NOT_IN_RANGE` when the target creep is not
  adjacent.
- `MOVE-BASIC-008` `behavior` `verified_vanilla`
  `moveByPath()` moves the creep one step along a provided path array of path
  step objects.
- `MOVE-BASIC-009` `behavior` `verified_vanilla`
  `moveByPath()` moves the creep one step along a provided serialized path
  string.
- `MOVE-BASIC-010` `behavior` `verified_vanilla`
  `moveByPath()` moves the creep one step along a provided array of
  `RoomPosition` objects.
- `MOVE-BASIC-011` `behavior` `verified_vanilla`
  `moveByPath()` returns `OK` when the next step is a valid adjacent tile.
- `MOVE-BASIC-012` `behavior` `verified_vanilla`
  `moveByPath()` returns `ERR_NOT_FOUND` when the creep's position is not on
  the provided path.
- `MOVE-BASIC-013` `behavior` `verified_vanilla`
  `moveByPath()` returns `ERR_NOT_FOUND` when the creep is already at the end
  of the provided path.
- `MOVE-BASIC-014` `behavior` `verified_vanilla`
  `moveByPath()` returns `ERR_INVALID_ARGS` when the argument is not a
  supported path representation.
- `MOVE-BASIC-015` `behavior` `verified_vanilla`
  `moveTo()` moves the creep one step toward a reachable target.
- `MOVE-BASIC-016` `behavior` `verified_vanilla`
  `moveTo()` returns `OK` when the target is reachable and the creep can issue
  a first movement step.
- `MOVE-BASIC-017` `behavior` `verified_vanilla`
  `moveTo()` returns `OK` when the creep is already at the target position.
- `MOVE-BASIC-018` `behavior` `verified_vanilla`
  `moveTo()` returns `ERR_NO_PATH` when no path to the target exists.
- `MOVE-BASIC-019` `behavior` `verified_vanilla`
  `moveTo({noPathFinding: true})` returns `ERR_NOT_FOUND` when no reusable path
  is available.
- `MOVE-BASIC-020` `behavior` `verified_vanilla`
  `moveTo()` returns `ERR_TIRED` when the creep has fatigue > 0.
- `MOVE-BASIC-021` `behavior` `verified_vanilla`
  `moveTo()` returns `ERR_NO_BODYPART` when the creep has no MOVE parts.
- `MOVE-BASIC-022` `behavior` `verified_vanilla`
  `moveTo()` returns `ERR_INVALID_TARGET` for invalid target arguments.
- `MOVE-BASIC-023` `behavior` `verified_vanilla`
  `move()` returns `ERR_NOT_OWNER` when called on a creep the player does not
  own.
- `MOVE-BASIC-024` `behavior` `verified_vanilla`
  `move()` returns `ERR_BUSY` when the creep is still spawning.
- `MOVE-BASIC-025` `behavior` `verified_vanilla`
  `move(targetCreep)` moves the calling creep one tile toward the target
  creep's position.
- `MOVE-BASIC-026` `behavior` `verified_vanilla`
  `moveByPath()` returns `ERR_TIRED` when the creep's fatigue is greater than
  zero.

Coverage Notes
- `move()` into an occupied tile is owned by the collision resolution facet
  (`MOVE-COLLISION-*`), not this section.
- Power-creep-specific `move()`, `moveTo()`, and `moveByPath()` wrapper
  contracts are owned by `19.2 Movement & Actions` (`POWERCREEP-MOVE-*`), not
  this section.
- Universal API guards (`ERR_NOT_OWNER`, `ERR_BUSY`) apply to all movement
  methods; listed once under `move()` as representative.
- Structure walkability rules (constructedWall, rampart ownership) are owned
  by the relevant structure facets, not this section.

### 1.2 Fatigue Calculation
- `MOVE-FATIGUE-001` `behavior` `verified_vanilla`
  Moving onto a plains tile generates 2 fatigue per weighted non-MOVE body
  part.
- `MOVE-FATIGUE-002` `behavior` `verified_vanilla`
  Each undamaged MOVE body part reduces the creep's fatigue by 2 at the start
  of each tick.
- `MOVE-FATIGUE-003` `behavior` `verified_vanilla`
  Empty CARRY parts do not contribute weight for fatigue calculation.
- `MOVE-FATIGUE-004` `behavior` `verified_vanilla`
  Non-empty CARRY parts contribute weight for fatigue calculation like other
  non-MOVE parts.
- `MOVE-FATIGUE-005` `behavior` `verified_vanilla`
  Moving onto swamp generates fatigue equal to 10 per weighted body part.
- `MOVE-FATIGUE-006` `matrix` `verified_vanilla`
  Boosted MOVE parts reduce fatigue per tick by the boosted amount for `ZO`,
  `ZHO2`, and `XZHO2`.
- `MOVE-FATIGUE-007` `behavior` `verified_vanilla`
  Damaged (0 HP) MOVE parts do not contribute to fatigue reduction.
- `MOVE-FATIGUE-008` `behavior` `verified_vanilla`
  Fatigue reduction cannot bring a creep's fatigue below zero.

Coverage Notes
- The `ERR_TIRED` return code from `move()` when fatigue > 0 is owned by
  `MOVE-BASIC-003`, not this section.

### 1.3 Roads
- `ROAD-FATIGUE-001` `behavior` `verified_vanilla`
  A road on a tile reduces the fatigue multiplier for creeps moving onto it
  to 1 (half of the plain-terrain multiplier).
- `ROAD-FATIGUE-002` `behavior` `verified_vanilla`
  A road on swamp reduces the fatigue multiplier to 1.
- `ROAD-FATIGUE-003` `behavior` `verified_vanilla`
  A road on a natural-wall tile reduces the fatigue multiplier to 1 (same as
  plain- and swamp-road).
- `ROAD-TRAVERSAL-001` `behavior` `verified_vanilla`
  A completed road structure on a natural-wall tile makes that tile
  traversable by creeps — paired with `MOVE-BASIC-002`, which covers the
  wall-without-road case (move returns OK but the creep does not move).
- `ROAD-TRAVERSAL-002` `behavior` `verified_vanilla`
  `Room.findPath` routes through a road on a natural-wall tile when that is
  the only traversable path — the room's CostMatrix treats the wall-road
  as cost-1 walkable, matching the move-resolver's acceptance in
  `ROAD-TRAVERSAL-001`.

Coverage Notes
- Road wear mechanics are owned by `13.2 Road — Wear` (`ROAD-WEAR-*`).
- Road construction costs (including terrain-ratio scaling on swamp and
  wall) are owned by `15.3 Construction Costs` (`CONSTRUCTION-COST-001`,
  `CONSTRUCTION-COST-003`).

### 1.4 Room Transitions
- `ROOM-TRANSITION-001` `behavior` `verified_vanilla`
  A creep moving onto an exit tile appears in the adjacent room at the
  opposite edge on the next tick.
- `ROOM-TRANSITION-002` `behavior` `verified_vanilla`
  A creep retains its identity (same ID and name) after crossing a room
  border.
- `ROOM-TRANSITION-003` `behavior` `verified_vanilla`
  Fatigue resets to 0 when a creep moves onto an exit tile.
- `ROOM-TRANSITION-005` `behavior` `verified_vanilla`
  A creep's body composition, hit points, and store contents are preserved
  intact across a room transition.

Coverage Notes
- Room adjacency and coordinate topology are owned by `21. Map`
  (`MAP-ROOM-*`).
- The previously listed `ROOM-TRANSITION-004` ("`creep.room` returns the
  previous room for one tick after crossing") was dropped on
  2026-04-09: vanilla source `@screeps/engine/src/game/rooms.js`
  `RoomObject` constructor sets `this.room` and `this.pos` from the same
  data field, so the two are always in sync and there is no observable
  one-tick lag. Empirically verified with `creep.room.name` immediately
  after crossing.
- Cross-room pull is intentionally not listed as catalog behavior yet. A
  naive same-tick setup with the puller crossing first fails on vanilla
  because pull state lives in per-room `roomObjects` and is lost when the
  puller leaves the room. Keep this as an investigation note until a
  successful vanilla choreography establishes an observable rule.

### 1.5 Pulling
- `MOVE-PULL-001` `behavior` `verified_vanilla`
  `pull()` on an adjacent creep returns `OK`.
- `MOVE-PULL-002` `behavior` `verified_vanilla`
  The pulled creep must call `move()` toward the puller in the same tick for
  the pull to complete.
- `MOVE-PULL-003` `behavior` `verified_vanilla`
  When a pull completes, the pulled creep moves into the puller's previous
  tile as the puller moves.
- `MOVE-PULL-004` `behavior` `verified_vanilla`
  `pull()` returns `ERR_NOT_IN_RANGE` when the target is not adjacent.
- `MOVE-PULL-005` `behavior` `verified_vanilla`
  The pulling creep accumulates fatigue for both itself and the pulled creep.
- `MOVE-PULL-006` `behavior` `verified_vanilla`
  Pull can chain through multiple creeps in a train.
- `MOVE-PULL-007` `behavior` `verified_vanilla`
  `pull()` returns `ERR_INVALID_TARGET` for an invalid target: `:self` (pull
  yourself), `:nonCreep` (pull a structure), `:spawning` (pull a creep that is
  still spawning).
- `MOVE-PULL-008` `behavior` `verified_vanilla`
  `pull()` on an adjacent enemy creep returns `OK`; cross-owner pulling is
  permitted.
- `MOVE-PULL-009` `behavior` `verified_vanilla`
  When the pulled creep calls `move()` in a direction not toward the puller,
  the pull does not complete and the pulled creep moves under its own power.
- `MOVE-PULL-010` `behavior` `verified_vanilla`
  `pull()` returns `OK` when the puller has fatigue > 0, but the pull does not
  resolve because the puller cannot move.

### 1.6 Collision Resolution
- `MOVE-COLLISION-001` `behavior` `verified_vanilla`
  When multiple creeps attempt to occupy the same tile in the same tick, at
  most one creep occupies that tile after movement resolves.
- `MOVE-COLLISION-002` `behavior` `verified_vanilla`
  A creep that loses collision resolution remains on its original tile and does
  not receive an action error code from `move()`.
- `MOVE-COLLISION-003` `behavior` `verified_vanilla`
  Two creeps moving into each other's starting tiles in the same tick can swap
  positions.
- `MOVE-COLLISION-004` `behavior` `verified_vanilla`
  A creep can move onto a tile vacated by another creep moving away in the
  same tick.
- `MOVE-COLLISION-005` `behavior` `verified_vanilla`
  A hostile creep blocks movement onto its tile.
- `MOVE-COLLISION-006` `behavior` `verified_vanilla`
  In a circular movement chain (A moves to B's tile, B moves to C's tile,
  C moves to A's tile), all creeps either rotate positions simultaneously or
  all remain in place.

Coverage Notes
- Same-input determinism should be proven through concrete repeated scenarios,
  not kept as a standalone abstract catalog item.
- The exact collision-priority algorithm is not catalog truth yet.
- Replace inferred priority-factor bullets with a small set of verified,
  observable tie-break scenarios.
- Structure-based movement blocking (constructedWall, rampart ownership) is
  owned by the relevant structure facets, not this section.

### 1.7 Power Creep Movement
- `MOVE-POWER-001` `behavior` `verified_vanilla`
  In a same-tile movement collision tie between a power creep and a regular
  creep, the regular creep wins the destination tile.

Coverage Notes
- Power-creep-specific `move()`, `moveTo()`, and `moveByPath()` wrapper
  contracts, plus power-creep fatigue and road wear, are owned by
  `19.2 Movement & Actions` (`POWERCREEP-MOVE-*`).

---

## 2. Pathfinding

### 2.1 PathFinder.search
- `PATHFINDER-001` `behavior` `verified_vanilla`
  `PathFinder.search()` accepts a bare `RoomPosition` goal with implicit
  `range: 0`.
- `PATHFINDER-002` `behavior` `verified_vanilla`
  `PathFinder.search()` accepts a single goal object with `{ pos, range }`.
- `PATHFINDER-003` `behavior` `verified_vanilla`
  For non-empty goals, `PathFinder.search()` returns
  `{ path, ops, cost, incomplete }`.
- `PATHFINDER-004` `behavior` `verified_vanilla`
  `roomCallback(roomName)` can return a `CostMatrix` to influence routing in
  that room.
- `PATHFINDER-005` `behavior` `verified_vanilla`
  `roomCallback(roomName)` can return `false` to exclude a room from search.
- `PATHFINDER-006` `behavior` `verified_vanilla`
  `PathFinder.search()` accepts multiple goal positions and finds the closest
  reachable goal.
- `PATHFINDER-007` `behavior` `verified_vanilla`
  `plainCost` option overrides the default cost of plains tiles.
- `PATHFINDER-008` `behavior` `verified_vanilla`
  `swampCost` option overrides the default cost of swamp tiles.
- `PATHFINDER-009` `behavior` `verified_vanilla`
  `maxOps` option limits the number of pathfinding operations.
- `PATHFINDER-010` `behavior` `verified_vanilla`
  `maxRooms` option limits the number of rooms searched.
- `PATHFINDER-011` `behavior` `verified_vanilla`
  `flee` mode finds a path away from the goal positions.
- `PATHFINDER-012` `behavior` `verified_vanilla`
  `PathFinder.search()` returns `incomplete: true` with a partial path when no
  full path exists.
- `PATHFINDER-013` `behavior` `verified_vanilla`
  `PathFinder.search()` with an empty goal array returns `{ path: [], ops: 0 }`
  without `cost` or `incomplete`.
- `PATHFINDER-014` `behavior` `verified_vanilla`
  `PathFinder.search()` with a nullish goal returns `{ path: [], ops: 0 }`
  without `cost` or `incomplete`.
- `PATHFINDER-015` `behavior` `verified_vanilla`
  `maxCost` limits search by cumulative path cost.
- `PATHFINDER-016` `behavior` `verified_vanilla`
  `heuristicWeight` is accepted and can change search behavior without changing
  the result shape.
- `PATHFINDER-017` `behavior` `verified_vanilla`
  When the origin is already within goal range, the returned path is empty.
- `PATHFINDER-018` `behavior` `verified_vanilla`
  Consecutive positions in the returned path are at Chebyshev distance 1 from
  each other.
- `PATHFINDER-019` `behavior` `verified_vanilla`
  When goal `range` is greater than 0, the path terminates within `range`
  tiles of the goal rather than on the goal position itself.
- `PATHFINDER-020` `behavior` `verified_vanilla`
  `PathFinder.search()` can return a path spanning multiple rooms when origin
  and goal are in different rooms.

### 2.2 CostMatrix
- `COSTMATRIX-001` `behavior` `verified_vanilla`
  `new CostMatrix()` creates a matrix with all values 0.
- `COSTMATRIX-002` `behavior` `verified_vanilla`
  `set(x, y, cost)` and `get(x, y)` round-trip the assigned value.
- `COSTMATRIX-003` `behavior` `verified_vanilla`
  `serialize()` and `CostMatrix.deserialize()` round-trip correctly.
- `COSTMATRIX-004` `behavior` `verified_vanilla`
  `clone()` returns an independent copy of the matrix.
- `COSTMATRIX-005` `behavior` `verified_vanilla`
  `set(x, y, cost)` clamps assigned values into the inclusive `0..255` range.
- `COSTMATRIX-006` `behavior` `verified_vanilla`
  A `CostMatrix` value of 0 means `PathFinder.search()` uses the default
  terrain cost for that tile.
- `COSTMATRIX-007` `behavior` `verified_vanilla`
  A `CostMatrix` value of 255 makes the tile unwalkable for
  `PathFinder.search()`.
- `COSTMATRIX-008` `behavior` `verified_vanilla`
  A `CostMatrix` value between 1 and 254 overrides the terrain cost for that
  tile, causing `PathFinder.search()` to prefer lower-cost alternatives.

Coverage Notes
- RoomPosition find/path helpers (`findClosestByPath`, `findClosestByRange`,
  `findInRange`, `findPathTo`, `getDirectionTo`, filter option) are owned by
  section 22.3 (`ROOMPOS-FIND-*`) and 22.2 (`ROOMPOS-SPATIAL-005`). Six
  duplicate entries formerly in section 2.3 dropped; they also had an ID
  collision with section 22.1's `ROOMPOS-001`.

### 2.3 Legacy Pathfinding
- `LEGACY-PATH-001` `behavior` `verified_vanilla`
  `Room.findPath()` without `serialize: true` returns a path step array between
  two positions in the same room.
- `LEGACY-PATH-002` `behavior` `verified_vanilla`
  `Room.serializePath()` and `Room.deserializePath()` round-trip a path.
- `LEGACY-PATH-003` `behavior` `verified_vanilla`
  `PathFinder.use()` exists, accepts boolean toggles, and leaves
  `Room.findPath()` callable across toggles.
- `LEGACY-PATH-004` `behavior` `verified_vanilla`
  `Room.findPath()` returns an empty result (`[]`, or `''` with
  `serialize: true`) when the source position is not in the room.
- `LEGACY-PATH-005` `behavior` `verified_vanilla`
  `Room.findPath()` returns an empty result (`[]`, or `''` with
  `serialize: true`) when the destination position is not in the room.
- `LEGACY-PATH-006` `behavior` `verified_vanilla`
  `Room.findPath()` returns an empty result (`[]`, or `''` with
  `serialize: true`) when source and destination are the same position.
- `LEGACY-PATH-007` `behavior` `verified_vanilla`
  `Room.findPath()` returns a single direct step for adjacent positions.
- `LEGACY-PATH-008` `behavior` `verified_vanilla`
  `Room.findPath({ serialize: true })` returns a serialized path string.
- `LEGACY-PATH-009` `behavior` `verified_vanilla`
  Each element of the path step array contains `x`, `y`, `dx`, `dy`, and
  `direction` fields.

---

## 3. Harvesting

### 3.1 Source Harvest
- `HARVEST-001` `behavior` `verified_vanilla`
  Each WORK part harvests 2 energy per tick from a source.
- `HARVEST-002` `behavior` `verified_vanilla`
  `harvest()` returns ERR_NOT_IN_RANGE when too far.
- `HARVEST-003` `behavior` `verified_vanilla`
  `harvest()` returns ERR_NO_BODYPART when the creep has no WORK parts.
- `HARVEST-004` `behavior` `verified_vanilla`
  `harvest()` returns ERR_NOT_ENOUGH_RESOURCES when the source has 0 energy.
- `HARVEST-005` `behavior` `verified_vanilla`
  Successful `harvest(source)` increases the creep's `store.energy` by the
  harvested amount.
- `HARVEST-006` `behavior` `verified_vanilla`
  Successful `harvest(source)` can exceed free carry capacity and drops the
  overflow energy after processing.
- `HARVEST-007` `behavior` `verified_vanilla`
  `harvest()` requires the creep to be adjacent to the source (range 1).
- `HARVEST-008` `behavior` `verified_vanilla`
  `harvest()` returns OK on success.
- `HARVEST-009` `behavior` `verified_vanilla`
  Successful `harvest(source)` reduces the source's `energy` by the harvested
  amount.
- `HARVEST-010` `behavior` `verified_vanilla`
  `harvest(source)` returns `ERR_NOT_OWNER` when the room controller is owned
  or reserved by another player.
- `HARVEST-011` `behavior` `verified_vanilla`
  `harvest()` returns `ERR_NOT_OWNER` when called on a creep not owned by the
  player.
- `HARVEST-012` `behavior` `verified_vanilla`
  `harvest()` returns `ERR_BUSY` while the creep is spawning.
- `HARVEST-013` `behavior` `verified_vanilla`
  `harvest()` returns `ERR_INVALID_TARGET` for a target that is not a source,
  mineral, or deposit.
- `HARVEST-014` `behavior` `verified_vanilla`
  When the source's remaining energy is less than the full harvest amount
  (2 × WORK parts), the creep harvests only the remaining energy.

Coverage Notes
- Harvest boost magnitudes (UO/UHO2/XUHO2) are owned by `BOOST-HARVEST-001`
  (section 8.8). A previous harvest-boost entry was dropped as duplicate
  coverage.
- Source energy capacity per room state is owned by `SOURCE-REGEN-001`
  (section 17.1). A previous source-capacity entry was dropped as duplicate
  coverage.
- Shared `harvest()` API gates (`ERR_NOT_OWNER` on the acting creep,
  `ERR_BUSY`, `ERR_INVALID_TARGET`) are temporarily owned here even though they
  also apply to mineral and deposit harvest calls.

### 3.2 Mineral Harvest
- `HARVEST-MINERAL-001` `behavior` `verified_vanilla`
  Successful `harvest(mineral)` adds `HARVEST_MINERAL_POWER` (1) unit per WORK
  part of `mineral.mineralType` to the creep's store.
- `HARVEST-MINERAL-002` `behavior` `verified_vanilla`
  `harvest(mineral)` reduces the mineral's `mineralAmount` by the harvested
  quantity.
- `HARVEST-MINERAL-003` `behavior` `verified_vanilla`
  After a successful mineral harvest, the extractor enters cooldown for
  `EXTRACTOR_COOLDOWN` ticks.
- `HARVEST-MINERAL-004` `behavior` `verified_vanilla`
  `harvest(mineral)` returns `ERR_NOT_ENOUGH_RESOURCES` when the mineral is
  depleted.
- `HARVEST-MINERAL-005` `behavior` `verified_vanilla`
  The mineral's `mineralType` determines the resource harvested.
- `HARVEST-MINERAL-006` `behavior` `verified_vanilla`
  `harvest(mineral)` returns `ERR_NOT_FOUND` when no extractor is present on
  the mineral tile.
- `HARVEST-MINERAL-007` `behavior` `verified_vanilla`
  `harvest(mineral)` returns `ERR_NOT_OWNER` when the extractor is owned by
  another player.
- `HARVEST-MINERAL-008` `behavior` `verified_vanilla`
  `harvest(mineral)` returns `ERR_RCL_NOT_ENOUGH` when the extractor is
  inactive.
- `HARVEST-MINERAL-009` `behavior` `verified_vanilla`
  `harvest(mineral)` returns `ERR_TIRED` while the extractor is on cooldown.
- `HARVEST-MINERAL-010` `behavior` `verified_vanilla`
  `harvest(mineral)` returns `ERR_NOT_IN_RANGE` when the creep is not
  adjacent.
- `HARVEST-MINERAL-011` `behavior` `verified_vanilla`
  `harvest(mineral)` returns `OK` when all mineral-harvest preconditions are
  met.
- `HARVEST-MINERAL-012` `behavior` `verified_vanilla`
  Successful `harvest(mineral)` can exceed free carry capacity and drops the
  overflow mineral after processing.
- `HARVEST-MINERAL-013` `behavior` `verified_vanilla`
  When the mineral's remaining amount is less than the full harvest amount
  (WORK part count), the creep harvests only the remaining amount.

Coverage Notes
- Mineral depletion triggering regeneration is owned by `MINERAL-REGEN-004`
  (section 17.3). A previous mineral-regeneration entry was dropped as
  duplicate coverage.
- Extractor-gated `harvest(mineral)` outcomes are owned here because they are
  part of the mineral harvest contract. The extractor section should not
  duplicate these action outcomes.

### 3.3 Deposit Harvest `capability: deposit`
- `DEPOSIT-HARVEST-001` `behavior` `verified_vanilla`
  Successful `harvest(deposit)` adds `HARVEST_DEPOSIT_POWER` units per WORK
  part of `deposit.depositType` to the creep's store.
- `DEPOSIT-HARVEST-002` `behavior` `verified_vanilla`
  `harvest(deposit)` returns `ERR_NOT_IN_RANGE` when the creep is not
  adjacent.
- `DEPOSIT-HARVEST-003` `behavior` `verified_vanilla`
  `harvest(deposit)` returns `ERR_TIRED` while the deposit is on cooldown.
- `DEPOSIT-HARVEST-004` `behavior` `verified_vanilla`
  `harvest(deposit)` returns `OK` when deposit-harvest preconditions are met.
- `DEPOSIT-HARVEST-005` `behavior` `verified_vanilla`
  Successful `harvest(deposit)` can exceed free carry capacity and drops the
  overflow resource after processing.

Coverage Notes
- Deposit object properties and lifecycle (`depositType`, `lastCooldown`,
  `cooldown`, `ticksToDecay`, and disappearance on decay) are owned by
  `17.5 Deposit Lifecycle` (`DEPOSIT-*`), not this section.

---

## 4. Resource Transfer

### 4.1 Transfer
- `TRANSFER-001` `behavior` `verified_vanilla`
  Successful `transfer()` decreases the creep store and increases the target
  store by the transferred amount.
- `TRANSFER-002` `behavior` `verified_vanilla`
  Omitting `amount` transfers as much as possible up to the source amount and
  the target's free capacity.
- `TRANSFER-003` `behavior` `verified_vanilla`
  `transfer()` returns ERR_NOT_IN_RANGE when target is not adjacent.
- `TRANSFER-004` `behavior` `verified_vanilla`
  `transfer()` returns ERR_NOT_ENOUGH_RESOURCES when creep lacks the resource.
- `TRANSFER-005` `behavior` `verified_vanilla`
  `transfer()` returns `ERR_INVALID_ARGS` when `resourceType` is omitted,
  invalid, or `amount` is negative.
- `TRANSFER-006` `behavior` `verified_vanilla`
  `transfer()` returns ERR_FULL when target store has no free capacity.
- `TRANSFER-007` `behavior` `verified_vanilla`
  `transfer()` returns ERR_INVALID_TARGET for invalid targets.
- `TRANSFER-008` `behavior` `verified_vanilla`
  Lab transfer validates that the resource matches the lab's allowed types.
- `TRANSFER-009` `behavior` `verified_vanilla`
  `transfer()` returns `ERR_NOT_OWNER` when the acting creep is not owned by
  the player.
- `TRANSFER-010` `behavior` `verified_vanilla`
  `transfer()` returns `ERR_BUSY` while the acting creep is spawning.
- `TRANSFER-011` `behavior` `verified_vanilla`
  `transfer(controller, RESOURCE_ENERGY)` redirects to
  `upgradeController()` instead of ordinary transfer.
- `TRANSFER-012` `behavior` `verified_vanilla`
  Transferring a mineral into an empty lab initializes that mineral slot
  capacity on the lab.
- `TRANSFER-013` `behavior` `verified_vanilla`
  `transfer()` returns `ERR_FULL` when the specified `amount` exceeds the
  target's free capacity, even if the target has some capacity remaining.
- `TRANSFER-014` `behavior` `verified_vanilla`
  `transfer()` to another creep is valid and follows the same store mechanics
  as transfer to a structure.

### 4.2 Withdraw
- `WITHDRAW-001` `behavior` `verified_vanilla`
  Successful `withdraw()` increases the creep store and decreases the target
  store by the withdrawn amount.
- `WITHDRAW-002` `behavior` `verified_vanilla`
  Omitting `amount` withdraws as much as possible up to the target amount and
  the creep's free capacity.
- `WITHDRAW-003` `behavior` `verified_vanilla`
  `withdraw()` returns ERR_NOT_IN_RANGE when target is not adjacent.
- `WITHDRAW-004` `behavior` `verified_vanilla`
  `withdraw()` returns ERR_NOT_ENOUGH_RESOURCES when the structure lacks the resource.
- `WITHDRAW-005` `behavior` `verified_vanilla`
  `withdraw()` returns ERR_NOT_OWNER for hostile structures without a public rampart.
- `WITHDRAW-006` `behavior` `verified_vanilla`
  `withdraw()` works on tombstones and ruins.
- `WITHDRAW-007` `behavior` `verified_vanilla`
  `withdraw()` returns ERR_FULL when the creep has no free capacity.
- `WITHDRAW-008` `behavior` `verified_vanilla`
  Terminal withdraw is blocked by PWR_DISRUPT_TERMINAL effect.
- `WITHDRAW-009` `behavior` `verified_vanilla`
  `withdraw()` returns `ERR_NOT_OWNER` when the acting creep is not owned by
  the player.
- `WITHDRAW-010` `behavior` `verified_vanilla`
  `withdraw()` returns `ERR_BUSY` while the acting creep is spawning.
- `WITHDRAW-011` `behavior` `verified_vanilla`
  `withdraw()` returns `ERR_INVALID_ARGS` when `resourceType` is invalid or
  `amount` is negative.
- `WITHDRAW-012` `behavior` `verified_vanilla`
  `withdraw()` returns `ERR_NOT_OWNER` during hostile safe mode.
- `WITHDRAW-013` `behavior` `verified_vanilla`
  `withdraw()` returns `ERR_INVALID_TARGET` for nukers and power banks.
- `WITHDRAW-014` `behavior` `verified_vanilla`
  `withdraw()` returns `ERR_INVALID_TARGET` when the target cannot hold and
  does not contain the requested resource type.
- `WITHDRAW-015` `behavior` `verified_vanilla`
  Withdrawing the last non-energy mineral from a lab clears that mineral slot
  capacity on the lab.
- `WITHDRAW-016` `behavior` `verified_vanilla`
  `withdraw()` returns `ERR_FULL` when the specified `amount` exceeds the
  creep's free capacity, even if the creep has some capacity remaining.

### 4.3 Pickup
- `PICKUP-001` `behavior` `verified_vanilla`
  `pickup(resource)` picks up an adjacent `Resource` object.
- `PICKUP-002` `behavior` `verified_vanilla`
  The full amount is picked up, limited by the creep's free capacity.
- `PICKUP-003` `behavior` `verified_vanilla`
  `pickup()` returns ERR_NOT_IN_RANGE when the resource is not adjacent.
- `PICKUP-004` `behavior` `verified_vanilla`
  `pickup()` returns ERR_FULL when the creep has no free capacity.
- `PICKUP-005` `behavior` `verified_vanilla`
  `pickup()` returns `ERR_NOT_OWNER` when the acting creep is not owned by the
  player.
- `PICKUP-006` `behavior` `verified_vanilla`
  `pickup()` returns `ERR_BUSY` while the acting creep is spawning.
- `PICKUP-007` `behavior` `verified_vanilla`
  `pickup()` returns `ERR_INVALID_TARGET` for a target that is not a
  `Resource`.
- `PICKUP-008` `behavior` `verified_vanilla`
  Successful `pickup()` removes the resource pile when its amount reaches 0.
- `PICKUP-009` `behavior` `verified_vanilla`
  Successful `pickup()` reduces the resource pile's amount by the picked-up
  quantity.

### 4.4 Drop
- `DROP-001` `behavior` `verified_vanilla`
  Successful `drop()` decreases the creep's stored amount of the resource by
  the dropped amount.
- `DROP-002` `behavior` `verified_vanilla`
  Omitting `amount` drops all of the specified resource.
- `DROP-003` `behavior` `verified_vanilla`
  Dropping onto a tile with an existing dropped resource of the same type adds to it.
- `DROP-004` `behavior` `verified_vanilla`
  `drop()` returns ERR_NOT_ENOUGH_RESOURCES when the creep lacks the resource.
- `DROP-005` `behavior` `verified_vanilla`
  `drop()` returns `ERR_NOT_OWNER` when the acting creep is not owned by the
  player.
- `DROP-006` `behavior` `verified_vanilla`
  `drop()` returns `ERR_BUSY` while the acting creep is spawning.
- `DROP-007` `behavior` `verified_vanilla`
  `drop()` returns `ERR_INVALID_ARGS` when `resourceType` is invalid.
- `DROP-008` `behavior` `verified_vanilla`
  Successful `drop()` inserts resources into a same-tile container before
  creating or merging a dropped resource pile.
- `DROP-009` `behavior` `verified_vanilla`
  Successful `drop()` onto a tile with no container and no existing same-type
  resource creates a new `Resource` object on the tile.
- `DROP-010` `behavior` `verified_vanilla`
  Dropping a different resource type onto a tile with an existing resource pile
  creates a separate `Resource` object for that type.

### 4.5 Dropped Resources
- `DROP-DECAY-001` `behavior` `verified_vanilla`
  Dropped resources decay by `ceil(amount / ENERGY_DECAY)` per tick.
- `DROP-DECAY-002` `behavior` `verified_vanilla`
  A dropped resource disappears when its amount reaches 0.
- `DROP-DECAY-004` `behavior` `verified_vanilla` Dropped resources are created when a creep overflows its carry capacity.
- `DROP-DECAY-005` `behavior` `verified_vanilla` Any player's creep can pick up any dropped resource.
- `DROP-DECAY-006` `behavior` `verified_vanilla`
  Dropped resources expose their public `amount` and `resourceType` through the
  `Resource` object API.

Coverage Notes
- Creep-death → dropped-resources flow is owned by `CREEP-DEATH-007`
  (section 9.7: tombstone decay emits dropped resources). Former
  DROP-DECAY-003 dropped as a duplicate.

---

## 5. Construction & Repair

### 5.1 Build
- `BUILD-001` `behavior` `verified_vanilla`
  Each WORK part contributes 5 progress per tick to a construction site.
- `BUILD-002` `behavior` `verified_vanilla`
  Building costs 1 energy per progress point.
- `BUILD-003` `behavior` `verified_vanilla`
  `build()` returns ERR_NOT_IN_RANGE when too far.
- `BUILD-004` `behavior` `verified_vanilla`
  When a site reaches progressTotal, the structure is created.
- `BUILD-005` `behavior` `verified_vanilla`
  `build()` has a Chebyshev range of 3 — a site at distance 3 succeeds and
  distance 4 returns ERR_NOT_IN_RANGE.
- `BUILD-006` `behavior` `verified_vanilla`
  `build()` returns OK on success.
- `BUILD-007` `behavior` `verified_vanilla`
  `build()` returns ERR_NO_BODYPART when the creep has no WORK parts.
- `BUILD-008` `behavior` `verified_vanilla`
  `build()` returns ERR_NOT_ENOUGH_RESOURCES when the creep has no energy.
- `BUILD-009` `behavior` `verified_vanilla`
  A creep can build any visible construction site, regardless of which
  player owns it (vanilla has no alliance system; the literal rule is
  "no ownership check on the site").

- `BUILD-010` `behavior` `verified_vanilla`
  When the creep has less energy than the full build amount (5 × WORK parts),
  `build()` contributes progress equal to the available energy.

Coverage Notes
- Build boost magnitudes are owned by `BOOST-BUILD-001` and zero-extra-cost is
  owned by `BOOST-BUILD-002` (section 8.9).

### 5.2 Repair
- `REPAIR-001` `behavior` `verified_vanilla`
  Each WORK part repairs 100 hits per tick.
- `REPAIR-002` `behavior` `verified_vanilla`
  Repairing costs 1 energy per 100 hits repaired.
- `REPAIR-003` `behavior` `verified_vanilla`
  `repair()` returns ERR_NOT_IN_RANGE when too far.
- `REPAIR-004` `behavior` `verified_vanilla`
  `repair()` returns `ERR_NOT_ENOUGH_RESOURCES` when the creep has no energy.
- `REPAIR-005` `behavior` `verified_vanilla`
  `repair()` has a Chebyshev range of 3 — a target at distance 3 succeeds
  and distance 4 returns ERR_NOT_IN_RANGE.
- `REPAIR-006` `behavior` `verified_vanilla`
  `repair()` cannot repair above the structure's hitsMax.
- `REPAIR-007` `behavior` `verified_vanilla`
  `repair()` returns ERR_NO_BODYPART when the creep has no WORK parts.
- `REPAIR-008` `behavior` `verified_vanilla`
  A creep can repair any visible structure, regardless of which player
  owns the surrounding room (engine repair.js never checks ownership).

- `REPAIR-009` `behavior` `verified_vanilla`
  When the creep has less energy than the full repair cost (WORK part count),
  `repair()` restores fewer hits proportional to the available energy.

Coverage Notes
- Repair boost magnitudes are owned by `BOOST-BUILD-001` and zero-extra-cost is
  owned by `BOOST-BUILD-002` (section 8.9).

### 5.3 Dismantle
- `DISMANTLE-001` `behavior` `verified_vanilla`
  Each WORK part dismantles 50 hits per tick from a structure.
- `DISMANTLE-002` `behavior` `verified_vanilla`
  Dismantling returns 0.25 energy per hit to the creep's store.
- `DISMANTLE-003` `behavior` `verified_vanilla`
  `dismantle()` returns ERR_NOT_IN_RANGE when too far.
- `DISMANTLE-004` `behavior` `verified_vanilla`
  When a rampart covers the target tile, `dismantle()` damage is redirected
  to the rampart instead of the underlying structure (same redirect as
  `attack()`).
- `DISMANTLE-005` `behavior` `verified_vanilla`
  `dismantle()` returns ERR_NO_BODYPART when the creep has no WORK parts.
- `DISMANTLE-006` `behavior` `verified_vanilla`
  `dismantle()` has a Chebyshev range of 1 — adjacent only.
- `DISMANTLE-007` `behavior` `verified_vanilla`
  When a structure reaches 0 hits from dismantling, it is destroyed.
- `DISMANTLE-008` `behavior` `verified_vanilla`
  When the energy returned from dismantling exceeds the creep's free carry
  capacity, the overflow is dropped as a resource.

Coverage Notes
- Dismantle boost magnitudes are owned by `BOOST-DISMANTLE-001`
  (section 8.10).
- Safe mode blocking dismantle is owned by `CTRL-SAFEMODE-006` (section 6.8).

### 5.4 Construction Sites
- `CONSTRUCTION-SITE-001` `behavior` `verified_vanilla`
  `createConstructionSite()` places a new site at a position.
- `CONSTRUCTION-SITE-002` `behavior` `verified_vanilla`
  MAX_CONSTRUCTION_SITES (100) is enforced as a global limit per player.
- `CONSTRUCTION-SITE-003` `behavior` `verified_vanilla`
  Construction site type must be valid for the room's RCL — placing a
  structure unavailable at the current RCL returns ERR_RCL_NOT_ENOUGH.
- `CONSTRUCTION-SITE-004` `behavior` `verified_vanilla`
  A hostile creep moving onto a construction site destroys it instantly
  (movement.js processor removes the site mid-move).
- `CONSTRUCTION-SITE-005` `behavior` `verified_vanilla`
  Exception: a site placed under an already-standing hostile creep
  survives — only the move intent triggers the site-destruction path.
- `CONSTRUCTION-SITE-006` `behavior` `verified_vanilla`
  `ConstructionSite.remove()` removes the site by the owner.
- `CONSTRUCTION-SITE-007` `behavior` `verified_vanilla`
  Only one construction site can exist at a given position.
- `CONSTRUCTION-SITE-008` `behavior` `verified_vanilla`
  Cannot place a construction site on a wall terrain tile (except roads).
  Coverage Notes: test exists but is gated on both adapters — vanilla
  caches `staticTerrainData` at runner startup so player-side wall checks
  ignore custom DB terrain (driver/runtime/make.js:18-51), and xxscreeps
  has terrain capability false.
- `CONSTRUCTION-SITE-009` `matrix` `verified_vanilla`
  A ruin does not block construction-site placement at its tile, for
  any pairing of the ruin's destroyed `structureType` and the placed
  `structureType`. Engine `utils.checkConstructionSite`
  (utils.js:172-184) filters on same-type structures and existing
  construction sites but never inspects ruins, which are walkable.
- `CONSTRUCTION-SITE-010` `behavior` `verified_vanilla`
  Unknown construction-site structure types return `ERR_INVALID_ARGS` for
  both `Room.createConstructionSite()` and
  `RoomPosition.createConstructionSite()`. Engine `rooms.js`
  `createConstructionSite` rejects types absent from `CONSTRUCTION_COST`;
  `RoomPosition.createConstructionSite` delegates to the room method.

---

## 6. Controller

### 6.1 Claim Controller
- `CTRL-CLAIM-001` `behavior` `verified_vanilla`
  On success, the controller is set to level 1 with the claiming player as
  owner.
- `CTRL-CLAIM-002` `behavior` `verified_vanilla`
  `claimController()` requires at least one CLAIM body part.
- `CTRL-CLAIM-003` `behavior` `verified_vanilla`
  The controller must be unowned (level 0) and not reserved by a hostile player.
- `CTRL-CLAIM-004` `behavior` `verified_vanilla`
  Range is 1 (adjacent).
- `CTRL-CLAIM-005` `behavior` `verified_vanilla`
  GCL room cap is checked — returns ERR_GCL_NOT_ENOUGH if exceeded.
- `CTRL-CLAIM-006` `behavior` `verified_vanilla`
  Returns ERR_INVALID_TARGET if the controller is already owned.
- `CTRL-CLAIM-007` `behavior` `verified_vanilla`
  `controller.my` returns `undefined` on a never-owned controller (vanilla
  `OwnedStructure.my` returns `undefined` when `user` is unset). This is the
  never-owned sentinel — distinct from the previously-owned `my === false`
  sentinel produced by `unclaim()` (CTRL-UNCLAIM-001) or downgrade-to-zero
  (CTRL-DOWNGRADE-002), where the engine sets `user` to `null` rather than
  clearing it.

### 6.2 Reserve Controller
- `CTRL-RESERVE-001` `behavior` `verified_vanilla`
  Adds 1 tick per CLAIM part per tick to the reservation timer.
- `CTRL-RESERVE-002` `behavior` `verified_vanilla`
  `reserveController()` requires at least one CLAIM body part.
- `CTRL-RESERVE-003` `behavior` `verified_vanilla`
  The controller must be unowned (level 0).
- `CTRL-RESERVE-004` `behavior` `verified_vanilla`
  Range is 1 (adjacent).
- `CTRL-RESERVE-005` `behavior` `verified_vanilla`
  Reservation is capped at CONTROLLER_RESERVE_MAX (5000 ticks).
- `CTRL-RESERVE-006` `behavior` `verified_vanilla`
  The reservation timer decreases by 1 per tick when no creep is actively
  reserving the controller. (Observable via the player-facing `ticksToEnd`
  getter, which derives from a fixed `endTime` minus `gameTime`.)
- `CTRL-RESERVE-007` `behavior` `verified_vanilla`
  `attackController()` on a controller reserved by another player reduces the
  reservation's `endTime` by `CONTROLLER_RESERVE` (1) per CLAIM part.
  (Catalog note: the original entry said `reserveController()` reduces a
  hostile reservation, but the engine API blocks that path with
  `ERR_INVALID_TARGET`; the actual reduction mechanism is attackController —
  engine `processor/intents/creeps/attackController.js:33-40`.)

### 6.3 Attack Controller
- `CTRL-ATTACK-001` `behavior` `verified_vanilla`
  Reduces the downgrade timer by CONTROLLER_CLAIM_DOWNGRADE (300) per CLAIM
  part.
- `CTRL-ATTACK-002` `behavior` `verified_vanilla`
  `attackController()` requires at least one CLAIM body part.
- `CTRL-ATTACK-003` `behavior` `verified_vanilla`
  Sets upgradeBlocked for CONTROLLER_ATTACK_BLOCKED_UPGRADE (1000) ticks.
- `CTRL-ATTACK-004` `behavior` `verified_vanilla`
  Range is 1 (adjacent).
- `CTRL-ATTACK-005` `behavior` `verified_vanilla`
  `attackController()` is not blocked against the player's own controller: the
  intent returns `OK`, decrements the controller's own `ticksToDowngrade` by
  `CONTROLLER_CLAIM_DOWNGRADE` per CLAIM part, and sets `upgradeBlocked` as on
  a hostile attack.
- `CTRL-ATTACK-006` `behavior` `verified_vanilla`
  `attackController()` returns `ERR_INVALID_TARGET` when the controller is
  unowned.

### 6.4 Upgrade Controller
- `CTRL-UPGRADE-001` `behavior` `verified_vanilla`
  Each WORK part contributes 1 progress per tick.
- `CTRL-UPGRADE-002` `behavior` `verified_vanilla`
  Upgrading costs 1 energy per progress point.
- `CTRL-UPGRADE-003` `behavior` `verified_vanilla`
  `upgradeController()` returns ERR_NOT_IN_RANGE when not within range 3.
- `CTRL-UPGRADE-004` `behavior` `verified_vanilla`
  Returns ERR_NOT_ENOUGH_RESOURCES when the creep has no energy.
- `CTRL-UPGRADE-005` `behavior` `verified_vanilla`
  `upgradeController()` has a range of 3.
- `CTRL-UPGRADE-006` `behavior` `verified_vanilla`
  At RCL 8, upgrade is capped at CONTROLLER_MAX_UPGRADE_PER_TICK (15).
- `CTRL-UPGRADE-007` `matrix` `verified_vanilla`
  Progress thresholds per level: 200, 45K, 135K, 405K, 1.215M, 3.645M,
  10.935M.
- `CTRL-UPGRADE-008` `behavior` `verified_vanilla`
  GCL progress is incremented alongside controller progress.
- `CTRL-UPGRADE-009` `behavior` `verified_vanilla`
  `upgradeController()` returns `ERR_INVALID_TARGET` while the controller's
  `upgradeBlocked` window is active (client-side check in
  `@screeps/engine/src/game/creeps.js:937`).
- `CTRL-UPGRADE-010` `behavior` `verified_vanilla`
  `upgradeController()` is blocked for CONTROLLER_NUKE_BLOCKED_UPGRADE (200)
  ticks after a nuke lands.
- `CTRL-UPGRADE-011` `behavior` `verified_vanilla`
  When the creep has less energy than the full upgrade amount (WORK part
  count), `upgradeController()` contributes progress equal to the available
  energy.
- `CTRL-UPGRADE-012` `behavior` `verified_vanilla`
  When controller progress reaches the level threshold, the controller
  advances to the next level and progress resets to zero.

Coverage Notes
- Upgrade boost magnitudes and zero-extra-cost are owned by
  `BOOST-UPGRADE-001` and `BOOST-UPGRADE-003` (section 8.11). Former
  CTRL-UPGRADE-007 dropped; remaining entries renumbered (008→007, 009→008,
  010→009, 011→010). CTRL-UPGRADE-007 reclassified `behavior`→`matrix`.

### 6.5 Sign Controller
- `CTRL-SIGN-001` `behavior` `verified_vanilla`
  `signController()` stores text on the controller.
- `CTRL-SIGN-002` `behavior` `verified_vanilla`
  Range is 1 (adjacent).
- `CTRL-SIGN-003` `behavior` `verified_vanilla`
  Any player can sign any controller (including hostile).

### 6.6 Generate Safe Mode
- `CTRL-GENSAFE-001` `behavior` `verified_vanilla` `generateSafeMode()` requires 1000 ghodium (SAFE_MODE_COST) in the creep's store.
- `CTRL-GENSAFE-002` `behavior` `verified_vanilla` Range is 1 (adjacent).
- `CTRL-GENSAFE-003` `behavior` `verified_vanilla` On success, increments the controller's safeModeAvailable count.
- `CTRL-GENSAFE-004` `behavior` `verified_vanilla` Returns ERR_NOT_ENOUGH_RESOURCES when the creep lacks ghodium.

### 6.7 Downgrade & Level Loss
- `CTRL-DOWNGRADE-001` `behavior` `verified_vanilla`
  The controller loses a level when `ticksToDowngrade` reaches 0.
- `CTRL-DOWNGRADE-002` `behavior` `verified_vanilla`
  An owned controller at level 1 that loses its level becomes unowned: level
  drops to 0, owner is cleared, and `my === false` (the previously-owned
  sentinel — `unclaim`-style processors set `user` to `null`, distinct from
  the never-owned `my === undefined` covered by CTRL-CLAIM-007).
- `CTRL-DOWNGRADE-003` `behavior` `verified_vanilla`
  `upgradeController()` resets the controller's downgrade timer.
- `CTRL-DOWNGRADE-004` `behavior` `verified_vanilla`
  Each RCL has a downgrade timer: 1→20K, 2→10K, 3→20K, 4→40K, 5→80K,
  6→120K, 7→150K, 8→200K.
- `CTRL-DOWNGRADE-005` `behavior` `verified_vanilla`
  The timer decrements by 1 each tick the controller is not upgraded.
- `CTRL-DOWNGRADE-006` `behavior` `verified_vanilla`
  On downgrade from level N > 1 to N-1, the controller's `progress` is
  incremented by `Math.round(CONTROLLER_LEVELS[N-1] * 0.9)` (a head start
  toward re-upgrading); progress is only cleared to 0 when the controller
  drops to level 0 (unowned).
- `CTRL-DOWNGRADE-007` `behavior` `verified_vanilla`
  The controller can downgrade through multiple levels if neglected.

Coverage Notes
- Structures becoming inactive above the RCL limit is owned by
  `CTRL-STRUCTLIMIT-002` (section 6.10). Former CTRL-DOWNGRADE-007 dropped;
  CTRL-DOWNGRADE-008 renumbered to 007.

### 6.8 Safe Mode Mechanics
- `CTRL-SAFEMODE-001` `behavior` `verified_vanilla`
  `activateSafeMode()` consumes one available safe mode charge and starts safe
  mode for SAFE_MODE_DURATION ticks when the controller is eligible.
- `CTRL-SAFEMODE-002` `behavior` `verified_vanilla`
  Safe mode activation starts a SAFE_MODE_COOLDOWN period during which
  `activateSafeMode()` cannot be used again.
- `CTRL-SAFEMODE-003` `behavior` `verified_vanilla`
  `activateSafeMode()` returns ERR_NOT_ENOUGH_RESOURCES when
  `safeModeAvailable` is 0.
- `CTRL-SAFEMODE-004` `behavior` `verified_vanilla`
  `activateSafeMode()` returns ERR_TIRED when the controller's safe mode
  cooldown is active.
- `CTRL-SAFEMODE-005` `behavior` `verified_vanilla`
  `activateSafeMode()` fails and does not activate when the controller's
  downgrade timer is below CONTROLLER_DOWNGRADE_SAFEMODE_THRESHOLD.
- `CTRL-SAFEMODE-006` `matrix` `verified_vanilla`
  Hostile creep intents in a foreign safe-moded room short-circuit at the
  Creep prototype guard with a method-specific return code, across
  `attack()`, `rangedAttack()`, `rangedMassAttack()`, `dismantle()`,
  `withdraw()`, `heal()`, `rangedHeal()`, and `attackController()`.
- `CTRL-SAFEMODE-007` `behavior` `verified_vanilla`
  `activateSafeMode()` returns `ERR_BUSY` when another owned controller already
  has an active safe mode.
- `CTRL-SAFEMODE-008` `behavior` `verified_vanilla`
  When `activateSafeMode()` is called on two different owned controllers in the
  same tick, both calls return `OK` but only the most recent call's intent is
  processed; the earlier intent is dropped so its controller keeps its
  `safeModeAvailable` charge and does not enter safe mode.

Notes
- Any hostile movement restrictions during safe mode should be added only as
  concrete observable outcomes, not as a broad summary rule.

### 6.9 Unclaim
- `CTRL-UNCLAIM-001` `behavior` `verified_vanilla`
  `StructureController.unclaim()` resets the controller to level 0 (unowned),
  clearing `user` (set to `null`), `progress`, `downgradeTime`, `safeMode`, and
  `safeModeAvailable` in a single processor step. After unclaim, `controller.my`
  is `false` (the previously-owned sentinel — distinct from never-owned
  `undefined`, covered by CTRL-CLAIM-007). Owned structures in the room are
  **not** destroyed by unclaim itself; they remain present and simply become
  inactive because every `CONTROLLER_STRUCTURES[type][0]` is 0 (already covered
  by `CTRL-STRUCTLIMIT-002`).

Coverage Notes
- Original CTRL-UNCLAIM-002 ("All owned structures in the room are
  destroyed") and CTRL-UNCLAIM-003 ("Destroyed structures become ruins")
  dropped: both contradicted the engine's `unclaim` processor
  (`@screeps/engine/src/processor/intents/controllers/unclaim.js`), which
  only updates the controller object and leaves room structures intact.
  The inactive-above-RCL-limit outcome is owned by `CTRL-STRUCTLIMIT-002`.

### 6.10 Structure Limits per RCL
- `CTRL-STRUCTLIMIT-001` `matrix` `verified_vanilla`
  The maximum active owned structure count for each structure type and
  controller level matches the canonical `CONTROLLER_STRUCTURES` table.
- `CTRL-STRUCTLIMIT-002` `behavior` `verified_vanilla`
  Owned structures above the room's current controller-level limit remain
  present but inactive until the room again satisfies the limit.

Coverage Notes
- Constant-across-level limits for containers, roads, walls, and ramparts are
  covered by the same structure-limit matrix.

---

## 7. Combat

### 7.1 Melee Attack
- `COMBAT-MELEE-001` `behavior` `verified_vanilla`
  Each ATTACK part deals 30 damage per tick.
- `COMBAT-MELEE-002` `behavior` `verified_vanilla`
  `attack()` returns ERR_NOT_IN_RANGE when target is not adjacent.
- `COMBAT-MELEE-003` `behavior` `verified_vanilla`
  `attack()` returns ERR_NO_BODYPART when the creep has no ATTACK parts.
- `COMBAT-MELEE-004` `behavior` `verified_vanilla`
  `attack()` has a range of 1 (adjacent).
- `COMBAT-MELEE-005` `behavior` `verified_vanilla`
  Attacking a creep or structure on a rampart-occupied tile hits the rampart instead.
- `COMBAT-MELEE-006` `behavior` `verified_vanilla`
  After a melee attack the target's ATTACK parts deal counter-damage back to the
  attacker, unless the attacker stands on its own rampart.
- `COMBAT-MELEE-007` `behavior` `verified_vanilla`
  Can target creeps, power creeps, and structures; non-attackable objects
  (e.g. sources) return ERR_INVALID_TARGET.

- `COMBAT-MELEE-008` `behavior` `verified_vanilla`
  Counter-damage per ATTACK part on the target is `ATTACK_POWER` (30), the
  same rate as a regular melee attack.

Coverage Notes
- Attack boost magnitudes are owned by `BOOST-ATTACK-001` (section 8.4).

### 7.2 Ranged Attack
- `COMBAT-RANGED-001` `behavior` `verified_vanilla`
  Each RANGED_ATTACK part deals 10 damage per tick.
- `COMBAT-RANGED-002` `behavior` `verified_vanilla`
  `rangedAttack()` returns ERR_NOT_IN_RANGE when target is beyond range 3.
- `COMBAT-RANGED-003` `behavior` `verified_vanilla`
  `rangedAttack()` has a range of 1–3.
- `COMBAT-RANGED-004` `behavior` `verified_vanilla`
  `rangedAttack()` returns ERR_NO_BODYPART when the creep has no
  RANGED_ATTACK parts.
- `COMBAT-RANGED-005` `behavior` `verified_vanilla`
  Can target creeps, power creeps, and structures; non-attackable objects
  (e.g. sources) return ERR_INVALID_TARGET.

- `COMBAT-RANGED-006` `behavior` `verified_vanilla`
  `rangedAttack()` on a target standing on a hostile rampart hits the rampart
  instead of the target.

Coverage Notes
- Ranged attack boost magnitudes are owned by `BOOST-RANGED-001`
  (section 8.5).

### 7.3 Ranged Mass Attack
- `COMBAT-RMA-001` `behavior` `verified_vanilla`
  `rangedMassAttack()` damages every hostile creep, power creep, and structure
  within range 3 of the attacker in a single call.
- `COMBAT-RMA-002` `matrix` `verified_vanilla`
  Per-target damage per RANGED_ATTACK part at each range band matches the
  canonical `RANGED_ATTACK_DISTANCE_RATE` distance-rate table.
- `COMBAT-RMA-003` `behavior` `verified_vanilla`
  `rangedMassAttack()` does not damage the player's own creeps or unowned
  structures.
- `COMBAT-RMA-004` `behavior` `verified_vanilla`
  `rangedMassAttack()` damage to a target standing on a hostile rampart is
  redirected to the rampart.

### 7.4 Heal
- `COMBAT-HEAL-001` `behavior` `verified_vanilla`
  Each HEAL part restores 12 HP per tick at range 1.
- `COMBAT-HEAL-002` `behavior` `verified_vanilla`
  `heal()` has a range of 1 (adjacent).
- `COMBAT-HEAL-003` `behavior` `verified_vanilla`
  Accepts any creep or power creep target regardless of ownership; the engine
  imposes a type-only check, with no friend/foe restriction.
- `COMBAT-HEAL-004` `behavior` `verified_vanilla`
  Healing a creep already at full HP returns OK but has no effect.

- `COMBAT-HEAL-005` `behavior` `verified_vanilla`
  `heal()` returns `ERR_NOT_IN_RANGE` when the target is beyond range 1.
- `COMBAT-HEAL-006` `behavior` `verified_vanilla`
  `heal()` returns `ERR_NO_BODYPART` when the creep has no HEAL parts.

Coverage Notes
- Heal boost magnitudes are owned by `BOOST-HEAL-001` (section 8.6).

### 7.5 Ranged Heal
- `COMBAT-RANGEDHEAL-001` `behavior` `verified_vanilla`
  Each HEAL part restores 4 HP per tick at range 1–3.
- `COMBAT-RANGEDHEAL-002` `behavior` `verified_vanilla`
  `rangedHeal()` has a range of 1–3.
- `COMBAT-RANGEDHEAL-003` `behavior` `verified_vanilla`
  When both `rangedHeal()` and `rangedAttack()` intents are queued on the same
  creep in one tick, `rangedHeal` takes priority and `rangedAttack` is suppressed
  (engine intent priority table).

- `COMBAT-RANGEDHEAL-004` `behavior` `verified_vanilla`
  `rangedHeal()` returns `ERR_NOT_IN_RANGE` when the target is beyond range 3.
- `COMBAT-RANGEDHEAL-005` `behavior` `verified_vanilla`
  `rangedHeal()` returns `ERR_NO_BODYPART` when the creep has no HEAL parts.

Coverage Notes
- Heal boost multipliers (including for rangedHeal) are owned by
  `BOOST-HEAL-001` (section 8.6).

### 7.6 Body Part Damage Model
- `COMBAT-BODYPART-001` `behavior` `verified_vanilla`
  Incoming damage is applied to the earliest surviving body part first, and
  later parts remain unchanged until earlier parts are exhausted.
- `COMBAT-BODYPART-002` `behavior` `verified_vanilla`
  Each body part has 100 hits, and `hitsMax` equals body length multiplied by
  100.
- `COMBAT-BODYPART-003` `behavior` `verified_vanilla`
  A body part at 0 hits is destroyed and is excluded from
  `getActiveBodyparts(type)`.
- `COMBAT-BODYPART-004` `behavior` `verified_vanilla`
  A body part with HP greater than 0 functions at full effectiveness
  regardless of remaining HP.

Coverage Notes
- The gameplay consequences of destroyed MOVE, WORK, CARRY, ATTACK, HEAL, and
  other body parts should be covered in their type-specific movement, combat,
  harvesting, transfer, and controller-action sections rather than as one
  umbrella statement here.

Coverage Notes
- Entire section 7.7 (Boost Damage Reduction, COMBAT-TOUGH-001 through 005)
  dropped. Tough damage-reduction magnitudes are owned by `BOOST-TOUGH-001`
  (section 8.7); self-only scope is owned by `BOOST-TOUGH-002` (section 8.7).
  COMBAT-TOUGH-005 (effective HP calculation) is a derived value, not an
  independent observable. Subsequent facets renumbered.

### 7.7 Simultaneous Damage & Healing
- `COMBAT-SIMULT-001` `behavior` `verified_vanilla` Damage and healing are resolved simultaneously: `newHits = oldHits + healing - damage`.
- `COMBAT-SIMULT-002` `behavior` `verified_vanilla` A creep survives if healing equals or exceeds damage in the same tick.
- `COMBAT-SIMULT-003` `behavior` `verified_vanilla` Overkill damage does not carry over to the next tick.
- `COMBAT-SIMULT-004` `behavior` `verified_vanilla` A creep dies only if hits reach 0 after simultaneous resolution.
- `COMBAT-SIMULT-005` `behavior` `verified_vanilla` Multiple sources of damage and healing are summed independently.

### 7.8 Tower Attack
- `TOWER-ATTACK-001` `behavior` `verified_vanilla`
  When `tower.attack()` executes, the tower's energy decreases by
  `TOWER_ENERGY_COST` in the same tick.
- `TOWER-ATTACK-002` `matrix` `verified_vanilla`
  Tower attack damage by range matches the canonical Screeps tower falloff
  curve derived from the tower attack constants.
- `TOWER-ATTACK-003` `matrix` `verified_vanilla`
  `tower.attack()` target acceptance and invalid-target behavior match the
  canonical target matrix across creeps, power creeps, structures, and
  non-attackable objects.
- `TOWER-ATTACK-004` `behavior` `verified_vanilla`
  `tower.attack()` returns `ERR_NOT_ENOUGH_ENERGY` when the tower's stored
  energy is below `TOWER_ENERGY_COST`.

### 7.9 Tower Heal
- `TOWER-HEAL-001` `behavior` `verified_vanilla`
  When `tower.heal()` executes, the tower's energy decreases by
  `TOWER_ENERGY_COST` in the same tick.
- `TOWER-HEAL-002` `matrix` `verified_vanilla`
  Tower heal amount by range matches the canonical Screeps tower falloff curve
  derived from the tower heal constants.
- `TOWER-HEAL-003` `matrix` `verified_vanilla`
  `tower.heal()` target acceptance and invalid-target behavior match the
  canonical target matrix across creeps, power creeps, structures, and
  non-healable objects.
- `TOWER-HEAL-004` `behavior` `verified_vanilla`
  `tower.heal()` returns `ERR_NOT_ENOUGH_ENERGY` when the tower's stored
  energy is below `TOWER_ENERGY_COST`.

### 7.10 Tower Repair
- `TOWER-REPAIR-001` `behavior` `verified_vanilla`
  When `tower.repair()` executes, the tower's energy decreases by
  `TOWER_ENERGY_COST` in the same tick.
- `TOWER-REPAIR-002` `matrix` `verified_vanilla`
  Tower repair amount by range matches the canonical Screeps tower falloff
  curve derived from the tower repair constants.
- `TOWER-REPAIR-003` `matrix` `verified_vanilla`
  `tower.repair()` target acceptance and invalid-target behavior match the
  canonical target matrix across repairable structures, non-repairable
  structures, creeps, and other invalid targets.
- `TOWER-REPAIR-004` `behavior` `verified_vanilla`
  `tower.repair()` returns `ERR_NOT_ENOUGH_ENERGY` when the tower's stored
  energy is below `TOWER_ENERGY_COST`.

### 7.11 Tower Action Priority
- `TOWER-INTENT-001` `behavior` `verified_vanilla`
  A tower performs at most one of attack, heal, or repair in a tick.
- `TOWER-INTENT-002` `behavior` `verified_vanilla`
  When heal, repair, and attack intents are all queued for the same tower in
  one tick, heal is preferred over repair and repair is preferred over attack.
- `TOWER-INTENT-003` `behavior` `verified_vanilla`
  Lower-priority tower intents submitted in the same tick do not execute after
  the chosen tower action resolves.

### 7.12 Tower Power Effects
- `TOWER-POWER-001` `matrix` `verified_vanilla`
  `PWR_OPERATE_TOWER` and `PWR_DISRUPT_TOWER` modify tower attack, heal, and
  repair power according to `POWER_INFO` for each supported power level.
- `TOWER-POWER-002` `behavior` `verified_vanilla`
  `PWR_OPERATE_TOWER` and `PWR_DISRUPT_TOWER` can affect the same tower at the
  same time.

### 7.13 Nukes — Launch `capability: nuke`
- `NUKE-LAUNCH-001` `behavior` `verified_vanilla` Launching requires `NUKER_ENERGY_CAPACITY` (300000) energy and `NUKER_GHODIUM_CAPACITY` (5000) ghodium.
- `NUKE-LAUNCH-002` `behavior` `verified_vanilla` Nuker enters a long cooldown after launch (`NUKER_COOLDOWN`, 100000 ticks).
- `NUKE-LAUNCH-003` `behavior` `verified_vanilla` Maximum range is `NUKE_RANGE` (10 rooms).
- `NUKE-LAUNCH-004` `behavior` `verified_vanilla` Creates an in-flight Nuke object visible in the target room via `FIND_NUKES`.
- `NUKE-LAUNCH-005` `behavior` `verified_vanilla` `launchNuke()` returns `ERR_NOT_ENOUGH_RESOURCES` when energy or ghodium is insufficient.
- `NUKE-LAUNCH-006` `behavior` `verified_vanilla` `launchNuke()` returns `ERR_TIRED` when the nuker is on cooldown.
- `NUKE-LAUNCH-007` `behavior` `verified_vanilla` `launchNuke()` returns `ERR_NOT_IN_RANGE` when the target room is beyond `NUKE_RANGE`.
- `NUKE-LAUNCH-008` `matrix` `needs_vanilla_verification`
  `launchNuke()` failure return codes and precedence match the canonical
  validation matrix for ownership, argument type, cooldown, active-structure
  state, range, and resource availability.
- `NUKE-LAUNCH-009` `behavior` `needs_vanilla_verification`
  `launchNuke()` can target a valid position in the nuker's own room.
- `NUKE-LAUNCH-010` `behavior` `needs_vanilla_verification`
  `launchNuke()` can target a valid in-range room that is not visible to the
  launching player.
- `NUKE-LAUNCH-011` `behavior` `needs_vanilla_verification`
  A successful `launchNuke()` queues an intent; in the same player tick that
  returns `OK`, the nuker's store and cooldown are unchanged and the target
  room does not yet expose the new nuke via `FIND_NUKES`.
- `NUKE-LAUNCH-012` `behavior` `needs_vanilla_verification`
  On the first player tick after a launch intent has processed,
  `nuker.cooldown === NUKER_COOLDOWN - 1`.
- `NUKE-LAUNCH-013` `behavior` `needs_vanilla_verification`
  After launch, `nuker.cooldown` decreases by exactly `1` on each subsequent
  tick until it reaches `0`.
- `NUKER-PROPS-001` `matrix` `needs_vanilla_verification`
  `StructureNuker` legacy resource properties mirror the store and capacity
  constants: `energy`, `ghodium`, `energyCapacity`, and `ghodiumCapacity`.

### 7.14 Nukes — Impact `capability: nuke`
- `NUKE-IMPACT-001` `behavior` `verified_vanilla` Nuke lands after `NUKE_LAND_TIME` (50000 ticks); `nuke.timeToLand` is set on launch.
- `NUKE-IMPACT-002` `behavior` `verified_vanilla` Damage at ground zero (range 0) is `NUKE_DAMAGE[0]` (10,000,000).
- `NUKE-IMPACT-003` `behavior` `verified_vanilla` Damage in radius 1–2 is `NUKE_DAMAGE[2]` (5,000,000).
- `NUKE-IMPACT-005` `behavior` `verified_vanilla` Ramparts do not protect creeps from nuke damage; every creep in the room dies.
- `NUKE-IMPACT-006` `behavior` `verified_vanilla` All dropped resources, construction sites, tombstones, and ruins in the entire room are removed when the nuke lands (room-wide cleanup, not just the blast area).
- `NUKE-IMPACT-007` `behavior` `verified_vanilla` Nukes do not create tombstones or ruins from what they destroy.
- `NUKE-IMPACT-008` `matrix` `needs_vanilla_verification`
  Additional object-type outcomes at nuke impact match the canonical matrix:
  power creeps, actively-spawning spawns, controllers, sources, minerals,
  deposits, flags, and portals.
- `NUKE-IMPACT-009` `behavior` `needs_vanilla_verification`
  A nuke landing in a room with active controller safe mode ends that safe mode
  in the landing tick.
- `NUKE-IMPACT-010` `behavior` `needs_vanilla_verification`
  Active controller safe mode does not prevent nuke structure damage, room-wide
  creep kills, or room-wide cleanup.
- `NUKE-IMPACT-011` `behavior` `needs_vanilla_verification`
  A nuke landing while the controller's `upgradeBlocked` window is still active
  does not refresh or extend that existing block window.
- `NUKE-IMPACT-012` `behavior` `needs_vanilla_verification`
  Multiple nukes landing in the same room on the same tick apply cumulative
  damage to structures that survive each prior nuke's damage.

Coverage Notes
- `NUKE-IMPACT-004` (rampart absorbs nuke damage for structures underneath)
  was a duplicate of `RAMPART-PROTECT-008` (section 12.1) and is dropped here;
  the nuke + rampart structure-absorption observable is owned by section 12.1.

### 7.15 Safe Mode — Combat Effects
- `SAFEMODE-COMBAT-001` `behavior` `verified_vanilla`
  Towers can still operate during safe mode.
- `SAFEMODE-COMBAT-002` `behavior` `verified_vanilla`
  Construction sites owned by the safe-moded room's owner are protected from
  hostile creep stomping while safe mode is active.

Coverage Notes
- Hostile creep action blocking (attack, rangedAttack, rangedMassAttack,
  dismantle, withdraw, heal, rangedHeal, attackController) is owned by
  `CTRL-SAFEMODE-006` (section 6.8). Former SAFEMODE-COMBAT-001/002/003
  dropped; SAFEMODE-COMBAT-004/005 renumbered to 001/002.

---

## 8. Boosts `capability: chemistry`

### 8.1 Boost Application
- `BOOST-CREEP-001` `behavior` `verified_vanilla`
  `Lab.boostCreep()` returns `OK` and marks the target body parts as boosted.
- `BOOST-CREEP-002` `behavior` `verified_vanilla`
  `boostCreep()` consumes `LAB_BOOST_MINERAL` compound and `LAB_BOOST_ENERGY`
  energy per part boosted.
- `BOOST-CREEP-003` `behavior` `verified_vanilla`
  `boostCreep(creep, bodyPartsCount)` limits the number of parts boosted.
- `BOOST-CREEP-004` `behavior` `verified_vanilla`
  `boostCreep()` returns `ERR_NOT_IN_RANGE` when the creep is not adjacent.
- `BOOST-CREEP-005` `behavior` `verified_vanilla`
  `boostCreep()` returns `ERR_NOT_ENOUGH_RESOURCES` when the lab lacks
  compound or energy.
- `BOOST-CREEP-006` `behavior` `verified_vanilla`
  `boostCreep()` returns `ERR_NOT_FOUND` when the creep has no matching
  unboosted parts.
- `BOOST-CREEP-007` `behavior` `verified_vanilla`
  A boosted `ATTACK` part deals increased damage matching the compound's
  multiplier.
- `BOOST-CREEP-008` `behavior` `verified_vanilla`
  A boosted `HEAL` part heals increased HP matching the compound's
  multiplier.
- `BOOST-CREEP-009` `behavior` `verified_vanilla`
  The lab's stored mineral compound determines which body part type is
  boosted; `boostCreep()` affects only unboosted parts of the type associated
  with the compound in the `BOOSTS` table.

### 8.2 Unboost
- `UNBOOST-001` `behavior` `verified_vanilla`
  `Lab.unboostCreep()` returns `OK`, removes all boosts from the creep, and
  drops returned compounds near the lab.
- `UNBOOST-002` `behavior` `verified_vanilla`
  `unboostCreep()` returns `ERR_NOT_FOUND` when the creep has no boosts.
- `UNBOOST-003` `behavior` `verified_vanilla`
  `unboostCreep()` returns `ERR_NOT_IN_RANGE` when the creep is not adjacent.
- `UNBOOST-004` `behavior` `verified_vanilla`
  Each unboosted body part drops `LAB_UNBOOST_MINERAL` (15) of its compound as
  a resource pile on the creep's own tile (not the lab's store): the engine
  unboost processor calls `_create-energy(target.x, target.y, ...)`.
- `UNBOOST-005` `behavior` `verified_vanilla`
  Lab cooldown after a successful unboost equals
  `sum_over_compounds(parts * calcTotalReactionsTime(compound)
  * LAB_UNBOOST_MINERAL / LAB_REACTION_AMOUNT)` ticks. For a tier-1 boost like
  `UH` this reduces to `parts * REACTION_TIME[UH] * 3`.

Coverage Notes
- A previously listed UNBOOST entry asserting `ERR_FULL when lab cannot hold
  the returned compounds` was dropped on 2026-04-11. Vanilla
  `@screeps/engine/src/game/structures.js` `StructureLab.unboostCreep` has no
  ERR_FULL branch and the unboost processor never returns capacity errors —
  returned compounds spill onto the creep tile via `_create-energy` (which
  prefers a same-tile container then falls back to a dropped resource), so
  there is nothing for the lab to "fail to hold".

### 8.3 Per-Part Boost Aggregation
- `BOOST-AGGREGATION-001` `matrix` `verified_vanilla`
  For additive boost mechanics, total effect equals the sum of each active
  body part's individual boosted or unboosted contribution across attack,
  ranged attack, heal, harvest, build, repair, dismantle, upgrade, move, and
  carry capacity.

Coverage Notes
- `TOUGH` is excluded from this matrix because boosted `TOUGH` modifies damage
  taken by the boosted part rather than contributing a simple additive output.

### 8.4 Attack Boosts
- `BOOST-ATTACK-001` `matrix` `verified_vanilla`
  ATTACK boost effect magnitudes match the canonical Screeps `BOOSTS` table for
  `UH`, `UH2O`, and `XUH2O`.

### 8.5 Ranged Boosts
- `BOOST-RANGED-001` `matrix` `verified_vanilla`
  `RANGED_ATTACK` boost effect magnitudes match the canonical Screeps `BOOSTS`
  table for `KO`, `KHO2`, and `XKHO2`.

### 8.6 Heal Boosts
- `BOOST-HEAL-001` `matrix` `verified_vanilla`
  `HEAL` boost effect magnitudes match the canonical Screeps `BOOSTS` table for
  `LO`, `LHO2`, and `XLHO2`.

### 8.7 Tough Boosts
- `BOOST-TOUGH-001` `matrix` `verified_vanilla`
  `TOUGH` damage-reduction magnitudes match the canonical Screeps `BOOSTS`
  table for `GO`, `GHO2`, and `XGHO2`.
- `BOOST-TOUGH-002` `behavior` `verified_vanilla`
  Tough damage reduction applies only to the boosted `TOUGH` body part itself.

### 8.8 Harvest Boosts
- `BOOST-HARVEST-001` `matrix` `verified_vanilla`
  Harvest boost effect magnitudes match the canonical Screeps `BOOSTS` table
  for `UO`, `UHO2`, and `XUHO2`.
- `BOOST-HARVEST-002` `behavior` `verified_vanilla`
  Harvest boosts apply only during `harvest()`, not other `WORK` actions.

### 8.9 Build/Repair Boosts
- `BOOST-BUILD-001` `matrix` `verified_vanilla`
  Build and repair boost effect magnitudes match the canonical Screeps
  `BOOSTS` table for `LH`, `LH2O`, and `XLH2O`.
- `BOOST-BUILD-002` `behavior` `verified_vanilla`
  Build and repair boosts do not increase energy cost.

### 8.10 Dismantle Boosts
- `BOOST-DISMANTLE-001` `matrix` `verified_vanilla`
  Dismantle boost effect magnitudes match the canonical Screeps `BOOSTS` table
  for `ZH`, `ZH2O`, and `XZH2O`.

### 8.11 Upgrade Boosts
- `BOOST-UPGRADE-001` `matrix` `verified_vanilla`
  Upgrade boost effect magnitudes match the canonical Screeps `BOOSTS` table
  for `GH`, `GH2O`, and `XGH2O`.
- `BOOST-UPGRADE-002` `behavior` `verified_vanilla`
  Upgrade boosts do not increase energy cost.

### 8.12 Move Boosts
- `BOOST-MOVE-001` `matrix` `verified_vanilla`
  Move boost effect magnitudes match the canonical Screeps `BOOSTS` table for
  `ZO`, `ZHO2`, and `XZHO2`.

Coverage Notes
- Concrete fatigue outcomes from move boosts are also covered in movement
  section `1.2 Fatigue Calculation`.

### 8.13 Carry Boosts
- `BOOST-CARRY-001` `matrix` `verified_vanilla`
  Carry boost capacity increases match the canonical Screeps `BOOSTS` table for
  `KH`, `KH2O`, and `XKH2O`.
- `BOOST-CARRY-002` `behavior` `verified_vanilla`
  Boosted `CARRY` parts still contribute zero fatigue when empty.

---

## 9. Spawning & Creep Lifecycle

### 9.1 spawnCreep
- `SPAWN-CREATE-001` `behavior` `verified_vanilla`
  `spawnCreep()` requires a non-empty body.
- `SPAWN-CREATE-002` `behavior` `verified_vanilla`
  `spawnCreep()` rejects bodies longer than `MAX_CREEP_SIZE` (50).
- `SPAWN-CREATE-003` `behavior` `verified_vanilla`
  `spawnCreep()` requires a name that is unique among living and spawning
  creeps.
- `SPAWN-CREATE-004` `behavior` `verified_vanilla`
  Spawn cost equals the sum of `BODYPART_COST` for the requested body.
- `SPAWN-CREATE-005` `behavior` `verified_vanilla`
  When `energyStructures` is provided, `spawnCreep()` draws energy only from
  the listed structures.
- `SPAWN-CREATE-006` `behavior` `verified_vanilla`
  When `energyStructures` is provided, `spawnCreep()` draws energy from the
  listed structures in listed order.
- `SPAWN-CREATE-007` `behavior` `verified_vanilla`
  `spawnCreep()` returns `ERR_NOT_ENOUGH_ENERGY` when the selected energy
  sources cannot pay the spawn cost.
- `SPAWN-CREATE-008` `behavior` `verified_vanilla`
  `spawnCreep()` returns `ERR_NAME_EXISTS` when the requested name is already
  in use.
- `SPAWN-CREATE-009` `behavior` `verified_vanilla`
  `spawnCreep()` returns `ERR_BUSY` when the spawn is already spawning.
- `SPAWN-CREATE-010` `behavior` `verified_vanilla`
  `spawnCreep(..., { dryRun: true })` performs feasibility checks without
  consuming energy or creating a creep.
- `SPAWN-CREATE-011` `behavior` `verified_vanilla`
  `spawnCreep(..., { memory })` seeds the spawned creep's initial memory.
- `SPAWN-CREATE-012` `behavior` `verified_vanilla`
  `spawnCreep()` returns `ERR_INVALID_ARGS` when the body array contains an
  invalid part type.
- `SPAWN-CREATE-013` `behavior` `verified_vanilla`
  On success, `spawnCreep()` deducts the spawn cost from the spawn and
  contributing extensions.

Coverage Notes
- Default spawn-plus-extension drain order should be covered through concrete
  scenarios if we decide that exact source ordering is part of the public
  contract.

### 9.2 Spawning Duration & Direction
- `SPAWN-TIMING-001` `behavior` `verified_vanilla`
  Spawn duration is `CREEP_SPAWN_TIME` (3) ticks per body part.
- `SPAWN-TIMING-002` `behavior` `verified_vanilla`
  While spawning, the creep remains on the spawn position with
  `creep.spawning === true`.
- `SPAWN-TIMING-003` `behavior` `verified_vanilla`
  When `opts.directions` is omitted, the spawn chooses the first available exit
  tile in the default priority order `TOP`, `TOP_RIGHT`, `RIGHT`,
  `BOTTOM_RIGHT`, `BOTTOM`, `BOTTOM_LEFT`, `LEFT`, `TOP_LEFT`.
- `SPAWN-TIMING-004` `behavior` `verified_vanilla`
  When `opts.directions` is provided, the spawn chooses the first available
  exit tile from that direction order.
- `SPAWN-TIMING-005` `behavior` `verified_vanilla`
  Custom directions are ignored for 1-tick spawns created by single-part creeps
  under `PWR_OPERATE_SPAWN`.
- `SPAWN-TIMING-006` `behavior` `verified_vanilla`
  When spawning completes, the creep exits the spawn tile in the chosen
  direction.

### 9.3 Spawn Stomping
- `SPAWN-STOMP-001` `behavior` `verified_vanilla`
  If spawning completes with every adjacent tile blocked and a hostile creep
  occupies a blocked chosen exit tile, the hostile creep is destroyed to free
  an exit tile.
- `SPAWN-STOMP-002` `behavior` `verified_vanilla`
  After spawn stomping, the new creep moves to the vacated tile.
- `SPAWN-STOMP-003` `behavior` `verified_vanilla`
  Spawn stomping destroys the hostile creep outside normal combat damage
  resolution.
- `SPAWN-STOMP-004` `behavior` `verified_vanilla`
  Spawn stomping does not occur if any chosen exit tile is open when spawning
  completes.
- `SPAWN-STOMP-005` `behavior` `verified_vanilla`
  Spawn stomping does not occur when the blocked chosen exit tiles contain no
  hostile creeps.
- `SPAWN-STOMP-006` `behavior` `verified_vanilla`
  With restricted spawn directions, spawn stomping does not occur if an open
  adjacent tile exists outside the chosen direction list.

### 9.4 Renew Creep
- `RENEW-CREEP-001` `behavior` `verified_vanilla`
  `renewCreep()` can target only an adjacent creep.
- `RENEW-CREEP-002` `behavior` `verified_vanilla`
  A successful `renewCreep()` returns `OK`, increases the target creep's
  `ticksToLive` by
  `floor(SPAWN_RENEW_RATIO * CREEP_LIFE_TIME / CREEP_SPAWN_TIME / body.length)`
  in the same tick.
- `RENEW-CREEP-003` `behavior` `verified_vanilla`
  A successful `renewCreep()` returns `OK` and spends
  `ceil(CREEP_SPAWN_TIME * body.length * BODYPART_COST_SUM / SPAWN_RENEW_RATIO / CREEP_LIFE_TIME)`
  energy in the same tick.
- `RENEW-CREEP-004` `behavior` `verified_vanilla`
  A successful `renewCreep()` returns `OK` and removes all boosts from the
  target creep.
- `RENEW-CREEP-005` `behavior` `verified_vanilla`
  A successful `renewCreep()` returns `OK` and does not refund the removed
  boost compounds or boost energy.
- `RENEW-CREEP-006` `behavior` `verified_vanilla`
  If boost removal reduces `storeCapacity`, excess carried resources are
  dropped until the creep's store fits the new capacity.
- `RENEW-CREEP-007` `behavior` `verified_vanilla`
  Creeps with any `CLAIM` part cannot be renewed.
- `RENEW-CREEP-008` `behavior` `verified_vanilla`
  `renewCreep()` returns `ERR_NOT_ENOUGH_ENERGY` when the spawn lacks energy
  to pay the renewal cost.
- `RENEW-CREEP-009` `behavior` `verified_vanilla`
  `renewCreep()` returns `ERR_BUSY` when the spawn is currently spawning a
  creep.
- `RENEW-CREEP-010` `behavior` `verified_vanilla`
  `renewCreep()` returns `ERR_FULL` when the renewal would push the creep's
  `ticksToLive` beyond `CREEP_LIFE_TIME`.

### 9.5 Recycle Creep
- `RECYCLE-CREEP-001` `behavior` `verified_vanilla`
  `recycleCreep()` destroys an adjacent creep during the current tick's intent
  resolution.
- `RECYCLE-CREEP-002` `behavior` `verified_vanilla`
  Recycled body value returned as energy equals
  `CREEP_CORPSE_RATE * remainingTTL / CREEP_LIFE_TIME` of the creep's total
  body cost.
- `RECYCLE-CREEP-003` `behavior` `verified_vanilla`
  Recycling returns both energy and boost compounds from the target creep.
- `RECYCLE-CREEP-004` `behavior` `verified_vanilla`
  `recycleCreep()` returns `ERR_NOT_IN_RANGE` when the target creep is not
  adjacent to the spawn.

Coverage Notes
- Container-vs-tombstone placement of recycled resources should be kept as a
  concrete scenario once we verify the exact vanilla outcome.

### 9.6 Creep Spawning State
- `CREEP-SPAWNING-001` `behavior` `verified_vanilla`
  `creep.spawning` is `true` while the creep is being spawned.
- `CREEP-SPAWNING-002` `behavior` `verified_vanilla`
  `creep.ticksToLive` is `undefined` while the creep is spawning.
- `CREEP-SPAWNING-003` `behavior` `verified_vanilla`
  A spawning creep cannot perform creep actions.
- `CREEP-SPAWNING-004` `behavior` `verified_vanilla`
  A spawning creep's body parts are visible before spawning completes.

### 9.7 Aging & Death
- `CREEP-LIFETIME-001` `behavior` `verified_vanilla`
  A living creep's `ticksToLive` decrements by 1 each completed tick.
- `CREEP-LIFETIME-002` `behavior` `verified_vanilla`
  Creeps without `CLAIM` parts start with `CREEP_LIFE_TIME` `ticksToLive`.
- `CREEP-LIFETIME-003` `behavior` `verified_vanilla`
  Creeps with any `CLAIM` part start with `CREEP_CLAIM_LIFE_TIME`
  `ticksToLive`.
- `CREEP-DEATH-001` `behavior` `verified_vanilla`
  A creep with `ticksToLive === 1` dies during that tick's resolution and does
  not appear on the next tick.
- `CREEP-DEATH-002` `behavior` `verified_vanilla`
  A creep's death creates a tombstone during that tick's resolution, and the
  tombstone appears on the next tick at the position of death.
- `CREEP-DEATH-003` `behavior` `verified_vanilla`
  When a live container is on the death tile, death resources are diverted into
  that container before any remainder is placed into the tombstone.
- `CREEP-DEATH-004` `behavior` `verified_vanilla`
  A creep tombstone stores any death resources not diverted into a same-tile
  container.
- `CREEP-DEATH-005` `behavior` `verified_vanilla`
  Resource amounts stored in a tombstone do not decay before the tombstone
  expires.
- `CREEP-DEATH-006` `behavior` `verified_vanilla`
  Tombstone decay time equals `TOMBSTONE_DECAY_PER_PART` (5) ticks per body
  part.
- `CREEP-DEATH-007` `behavior` `verified_vanilla`
  When a tombstone decays, any remaining stored resources become dropped
  resources on the same tile before the tombstone is removed.
- `CREEP-DEATH-008` `matrix` `verified_vanilla`
  Standard player-creep tombstone handling for carried resources matches across
  death sources that produce ordinary tombstones, including `ticksToLive`
  expiry and `suicide()`.
- `CREEP-DEATH-009` `behavior` `verified_vanilla`
  On `suicide()`, the tombstone store includes reclaimed body energy in addition
  to carried resources.
- `CREEP-DEATH-010` `behavior` `verified_vanilla`
  Body energy reclaim on death uses `CREEP_CLAIM_LIFE_TIME` for the life-rate
  denominator when the body contains any `CLAIM` part; otherwise it uses
  `CREEP_LIFE_TIME`.
- `CREEP-DEATH-011` `behavior` `verified_vanilla`
  Death at a zero deposit rate (Source Keeper suicide, nuke — vanilla `_die.js`
  `dropRate <= 0`) produces a tombstone with an empty store: neither body
  reclaim nor carried resources are deposited.
- `CREEP-DEATH-012` `behavior` `verified_vanilla`
  When multiple resource types are reclaimed onto a partially-full same-tile
  container, the container is filled sequentially (body-energy first, then
  body-minerals, then carried resources), with each overflow going to the
  tombstone before the next resource type is tried.

### 9.8 Suicide
- `CREEP-SUICIDE-001` `behavior` `verified_vanilla`
  A successful `suicide()` returns `OK` and removes the creep during the
  current tick's intent resolution.
- `CREEP-SUICIDE-002` `behavior` `verified_vanilla`
  A successful `suicide()` returns `OK` and creates a tombstone during that
  tick's resolution, and the tombstone appears on the next tick at the
  creep's position.
- `CREEP-SUICIDE-003` `behavior` `verified_vanilla`
  `suicide()` returns `ERR_NOT_OWNER` when called on a creep that is not yours.
- `CREEP-SUICIDE-004` `behavior` `verified_vanilla`
  `suicide()` returns `ERR_BUSY` when called on a spawning creep.

### 9.9 Say
- `CREEP-SAY-001` `behavior` `verified_vanilla`
  `say()` displays a message visible for one tick.
- `CREEP-SAY-002` `behavior` `verified_vanilla`
  `say(message, true)` makes the message visible to all players.
- `CREEP-SAY-003` `behavior` `verified_vanilla`
  Without the public flag, only the owner sees the message.

### 9.10 cancelOrder
Coverage Notes
- Canonical `cancelOrder(methodName)` behaviors live in section `24.2 Intent
  Resolution`, where they can be specified against queued same-tick intents
  without duplicating the same rule surface in two places.

---

## 10. Structures — Energy & Storage

### 10.1 Extension
- `EXTENSION-001` `behavior` `verified_vanilla`
  An active extension contributes exactly its stored energy to
  `room.energyAvailable`.
- `EXTENSION-002` `behavior` `verified_vanilla`
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
- `CONTAINER-001` `matrix` `verified_vanilla`
  Container decay amount and decay interval match the canonical Screeps values
  for owned and unowned rooms.
- `CONTAINER-002` `behavior` `verified_vanilla`
  When a container is destroyed, its remaining contents become dropped
  resources on the same tile.
- `CONTAINER-003` `behavior` `verified_vanilla`
  A hostile creep adjacent to a container can successfully `withdraw()` from
  it, subject to the normal `withdraw()` preconditions and blockers.

Coverage Notes
- Container store-type semantics and capacity constants belong in section `23. Store API`.

### 10.4 Link
- `LINK-001` `behavior` `verified_vanilla`
  A successful `transferEnergy()` returns `OK`, decreases the source link's
  energy by `amount`, and increases the target link's energy by
  `amount - ceil(amount * LINK_LOSS_RATIO)`.
- `LINK-002` `behavior` `verified_vanilla`
  A successful `transferEnergy()` sets the source link's cooldown to
  `LINK_COOLDOWN * max(abs(dx), abs(dy))` between source and target.
- `LINK-003` `behavior` `verified_vanilla`
  Transfer loss rounds up: sending 1 energy delivers 0.
- `LINK-004` `behavior` `verified_vanilla`
  `transferEnergy()` returns `ERR_INVALID_TARGET` when the target is the source
  link itself.
- `LINK-005` `behavior` `verified_vanilla`
  `transferEnergy()` returns `ERR_INVALID_TARGET` when the target is not a
  StructureLink.
- `LINK-006` `behavior` `verified_vanilla`
  `transferEnergy()` returns `ERR_NOT_OWNER` when the target link belongs to a
  different player.
- `LINK-007` `behavior` `verified_vanilla`
  `transferEnergy()` returns `ERR_INVALID_ARGS` for a negative amount.
- `LINK-008` `behavior` `verified_vanilla`
  `transferEnergy()` returns `ERR_TIRED` while the source link has cooldown > 0.
- `LINK-009` `behavior` `verified_vanilla`
  `transferEnergy()` returns `ERR_RCL_NOT_ENOUGH` when the source link is
  inactive due to insufficient room controller level.
- `LINK-010` `behavior` `verified_vanilla`
  `transferEnergy()` returns `ERR_NOT_ENOUGH_ENERGY` when the source link has
  less energy than the requested amount.
- `LINK-011` `behavior` `verified_vanilla`
  `transferEnergy()` returns `ERR_FULL` when the target link lacks enough free
  capacity for the requested amount.
- `LINK-012` `behavior` `verified_vanilla`
  `transferEnergy()` returns `ERR_NOT_IN_RANGE` when the target link is in a
  different room.
- `LINK-013` `behavior` `verified_vanilla`
  When `amount` is omitted, `transferEnergy()` transfers all of the source
  link's stored energy.

Coverage Notes
- Link store-type semantics and capacity constants belong in section `23. Store API`.

---

## 11. Structures — Production

### 11.1 Lab Reactions `capability: chemistry`
- `LAB-RUN-001` `matrix` `verified_vanilla`
  `runReaction(lab1, lab2)` produces the canonical reaction product for the
  minerals currently stored in `lab1` and `lab2` for every valid input pair.
- `LAB-RUN-002` `behavior` `verified_vanilla`
  When `runReaction(lab1, lab2)` executes successfully, it consumes
  `LAB_REACTION_AMOUNT` units from `lab1` and `lab2` and adds
  `LAB_REACTION_AMOUNT` units to the lab calling `runReaction()` in the same
  tick.
- `LAB-RUN-003` `behavior` `verified_vanilla`
  While `PWR_OPERATE_LAB` is active on the lab calling `runReaction()`, a successful
  `runReaction(lab1, lab2)` consumes and produces
  `LAB_REACTION_AMOUNT + POWER_INFO[PWR_OPERATE_LAB].effect[level-1]` units in
  the same tick.
- `LAB-RUN-004` `behavior` `verified_vanilla`
  A successful `runReaction(lab1, lab2)` returns `OK` and sets the cooldown of
  the lab calling `runReaction()` to
  `REACTION_TIME[the produced compound]`.
- `LAB-RUN-005` `behavior` `verified_vanilla`
  `runReaction(lab1, lab2)` returns `ERR_NOT_IN_RANGE` when either `lab1` or
  `lab2` is more than range 2 from the lab calling `runReaction()`.
- `LAB-RUN-006` `behavior` `verified_vanilla`
  `runReaction(lab1, lab2)` returns `ERR_NOT_ENOUGH_RESOURCES` when either
  `lab1` or `lab2` has less than the required reaction amount.
- `LAB-RUN-007` `behavior` `verified_vanilla`
  `runReaction(lab1, lab2)` returns `ERR_FULL` when the lab calling
  `runReaction()` lacks
  enough free mineral capacity for the reaction output amount.
- `LAB-RUN-008` `behavior` `verified_vanilla`
  `runReaction(lab1, lab2)` returns `ERR_INVALID_ARGS` when the minerals in
  `lab1` and `lab2` do not define a product or the lab calling
  `runReaction()` already holds a different mineral type.
- `LAB-RUN-009` `behavior` `verified_vanilla`
  `runReaction(lab1, lab2)` returns `ERR_INVALID_TARGET` when either argument is
  not another lab.
- `LAB-RUN-010` `behavior` `verified_vanilla`
  `runReaction(lab1, lab2)` returns `ERR_TIRED` while the lab calling
  `runReaction()` is on cooldown.
- `LAB-RUN-011` `behavior` `verified_vanilla`
  `runReaction(lab1, lab2)` returns `ERR_RCL_NOT_ENOUGH` while the lab calling
  `runReaction()` is inactive.
- `LAB-RUN-012` `behavior` `verified_vanilla`
  `runReaction(lab1, lab2)` returns `ERR_NOT_OWNER` when the lab calling
  `runReaction()` is not owned by the player.

### 11.2 Lab Reverse Reaction `capability: chemistry`
- `LAB-REVERSE-001` `matrix` `verified_vanilla`
  `reverseReaction(lab1, lab2)` splits each reversible compound into one valid
  canonical input pair from `REACTIONS`.
- `LAB-REVERSE-002` `behavior` `verified_vanilla`
  When `reverseReaction(lab1, lab2)` executes successfully, it consumes
  `LAB_REACTION_AMOUNT` units of the compound from the lab calling
  `reverseReaction()` and adds
  `LAB_REACTION_AMOUNT` units of each input mineral to `lab1` and `lab2` in the
  same tick.
- `LAB-REVERSE-003` `behavior` `verified_vanilla`
  While `PWR_OPERATE_LAB` is active on the lab calling `reverseReaction()`, a successful
  `reverseReaction(lab1, lab2)` consumes and produces
  `LAB_REACTION_AMOUNT + POWER_INFO[PWR_OPERATE_LAB].effect[level-1]` units in
  the same tick.
- `LAB-REVERSE-004` `behavior` `verified_vanilla`
  A successful `reverseReaction(lab1, lab2)` returns `OK` and sets the
  cooldown of the lab calling `reverseReaction()` to
  `REACTION_TIME[the consumed compound]`.
- `LAB-REVERSE-005` `behavior` `verified_vanilla`
  `reverseReaction(lab1, lab2)` returns `ERR_NOT_IN_RANGE` when either `lab1`
  or `lab2` is more than range 2 from the lab calling `reverseReaction()`.
- `LAB-REVERSE-006` `behavior` `verified_vanilla`
  `reverseReaction(lab1, lab2)` returns `ERR_NOT_ENOUGH_RESOURCES` when the
  lab calling `reverseReaction()` has less than the required compound amount.
- `LAB-REVERSE-007` `behavior` `verified_vanilla`
  `reverseReaction(lab1, lab2)` returns `ERR_FULL` when either `lab1` or `lab2`
  lacks enough free mineral capacity for the returned amount.
- `LAB-REVERSE-008` `behavior` `verified_vanilla`
  `reverseReaction(lab1, lab2)` returns `ERR_INVALID_ARGS` when the reacting lab
  mineral has no matching reverse pair for the target lab mineral types or both
  arguments refer to the same lab.
- `LAB-REVERSE-009` `behavior` `verified_vanilla`
  `reverseReaction(lab1, lab2)` returns `ERR_INVALID_TARGET` when either
  argument is not another lab.
- `LAB-REVERSE-010` `behavior` `verified_vanilla`
  `reverseReaction(lab1, lab2)` returns `ERR_TIRED` while the lab calling
  `reverseReaction()` is on cooldown.
- `LAB-REVERSE-011` `behavior` `verified_vanilla`
  `reverseReaction(lab1, lab2)` returns `ERR_RCL_NOT_ENOUGH` while the lab
  calling `reverseReaction()` is inactive.
- `LAB-REVERSE-012` `behavior` `verified_vanilla`
  `reverseReaction(lab1, lab2)` returns `ERR_NOT_OWNER` when the lab calling
  `reverseReaction()` is not owned by the player.

### 11.3 Reaction Chain `capability: chemistry`
Coverage Notes
- Base, tier-1, tier-2, and tier-3 compound chains should be generated from the
  canonical `REACTIONS` table rather than maintained as separate hand-written
  recipe bullets.
- Conformance of the reaction table itself is covered by `LAB-RUN-001`.

### 11.4 Factory Production `capability: factory`
- `FACTORY-PRODUCE-001` `matrix` `verified_vanilla`
  `produce(resourceType)` consumes the canonical
  `COMMODITIES[resourceType].components` and produces
  `COMMODITIES[resourceType].amount || 1` units for every factory-produced
  resource.
- `FACTORY-PRODUCE-002` `behavior` `verified_vanilla`
  A successful `produce(resourceType)` returns `OK` and sets factory cooldown to
  `COMMODITIES[resourceType].cooldown`.
- `FACTORY-PRODUCE-003` `behavior` `verified_vanilla`
  `produce(resourceType)` returns `ERR_NOT_ENOUGH_RESOURCES` when the factory
  lacks any required recipe component amount.
- `FACTORY-PRODUCE-004` `behavior` `verified_vanilla`
  `produce(resourceType)` returns `ERR_FULL` when consuming the recipe inputs
  and adding the output amount would exceed the factory's total store capacity.
- `FACTORY-PRODUCE-005` `behavior` `verified_vanilla`
  `produce(resourceType)` returns `ERR_BUSY` when the commodity's required level
  effect from `PWR_OPERATE_FACTORY` is not currently active.
- `FACTORY-PRODUCE-006` `behavior` `verified_vanilla`
  `produce(resourceType)` returns `ERR_TIRED` while the factory is on cooldown.
- `FACTORY-PRODUCE-007` `behavior` `verified_vanilla`
  `produce(resourceType)` returns `ERR_RCL_NOT_ENOUGH` while the factory is
  inactive.
- `FACTORY-PRODUCE-008` `behavior` `verified_vanilla`
  `produce(resourceType)` returns `ERR_INVALID_ARGS` when `resourceType` is not
  a factory commodity.
- `FACTORY-PRODUCE-009` `behavior` `verified_vanilla`
  `produce(resourceType)` returns `ERR_INVALID_TARGET` when the commodity exists
  but requires a different factory level than the structure's current level.
- `FACTORY-PRODUCE-010` `behavior` `verified_vanilla`
  `produce(resourceType)` returns `ERR_NOT_OWNER` when the factory is not owned
  by the player.

### 11.5 Factory Commodity Chains `capability: factory`
- `FACTORY-COMMODITY-001` `matrix` `verified_vanilla`
  Factory commodity level requirements and chain membership match the canonical
  `COMMODITIES` table for all factory-produced resources.
- `FACTORY-COMMODITY-002` `behavior` `verified_vanilla`
  A factory without an active `PWR_OPERATE_FACTORY` effect can produce only
  level 0 commodities.
- `FACTORY-COMMODITY-003` `behavior` `verified_vanilla`
  While `PWR_OPERATE_FACTORY` is active at level N, a factory can produce only
  level 0 commodities and level N commodities.

Coverage Notes
- Chain names and tier counts should be derived from `COMMODITIES`, not
  maintained as separate hand-written bullets.
- Factory error-code behavior for invalid commodity level requests is covered by
  `FACTORY-PRODUCE-009`.

### 11.6 Power Spawn `capability: powerCreeps`
- `POWER-SPAWN-001` `behavior` `verified_vanilla`
  A successful `processPower()` returns `OK`, consumes 1 power and
  `POWER_SPAWN_ENERGY_RATIO` energy and adds exactly 1 GPL progress.
- `POWER-SPAWN-002` `behavior` `verified_vanilla`
  While `PWR_OPERATE_POWER` is active, a successful `processPower()` returns
  `OK`, consumes and converts
  `1 + POWER_INFO[PWR_OPERATE_POWER].effect[level-1]` power, capped by the
  power currently stored, and adds exactly that amount of GPL progress.
- `POWER-SPAWN-003` `behavior` `verified_vanilla`
  `processPower()` returns `ERR_NOT_ENOUGH_RESOURCES` when the power spawn lacks
  enough power or energy for the amount that would be processed this tick, and
  leaves GPL progress unchanged.
- `POWER-SPAWN-004` `behavior` `verified_vanilla`
  `processPower()` returns `ERR_RCL_NOT_ENOUGH` while the power spawn is
  inactive.
- `POWER-SPAWN-005` `behavior` `verified_vanilla`
  `processPower()` returns `ERR_NOT_OWNER` when the power spawn is not owned by
  the player.

Coverage Notes
- Power spawn store-type semantics and capacity constants belong in section `23. Store API`.

---

## 12. Structures — Military

### 12.1 Rampart — Protection
- `RAMPART-PROTECT-001` `behavior` `verified_vanilla`
  A melee `attack()` targeting an object on a rampart tile damages the rampart
  instead of the covered target.
- `RAMPART-PROTECT-002` `behavior` `verified_vanilla`
  `dismantle()` targeting an object on a rampart tile damages the rampart
  instead of the covered target.
- `RAMPART-PROTECT-003` `behavior` `verified_vanilla`
  A non-public hostile rampart blocks hostile creep movement onto its tile.
- `RAMPART-PROTECT-004` `behavior` `verified_vanilla`
  A public rampart does not block hostile creep movement onto its tile.
- `RAMPART-PROTECT-005` `behavior` `verified_vanilla`
  `setPublic(true)` sets `isPublic` to `true` on the next tick.
- `RAMPART-PROTECT-006` `behavior` `verified_vanilla`
  `setPublic(false)` sets `isPublic` to `false` on the next tick.
- `RAMPART-PROTECT-007` `behavior` `verified_vanilla`
  `setPublic()` returns `ERR_NOT_OWNER` when the rampart is not owned by the
  player.
- `RAMPART-PROTECT-008` `behavior` `verified_vanilla`
  Nuke damage is applied to a rampart on the target tile before remaining
  damage is applied to other objects on that tile.
- `RAMPART-PROTECT-009` `behavior` `verified_vanilla`
  The rampart owner's creeps can always move onto the rampart tile regardless
  of the `isPublic` setting.
- `RAMPART-PROTECT-010` `behavior` `needs_vanilla_verification`
  When remaining nuke damage passes through a rampart to multiple non-rampart
  structures on the same tile, each covered structure receives the same
  remaining damage amount.

Coverage Notes
- Ranged attack and ranged mass attack damage redirects are owned by
  `COMBAT-RANGED-006` and `COMBAT-RMA-004` (section 7.2/7.3).

### 12.2 Rampart — Decay & Limits
- `RAMPART-DECAY-001` `behavior` `verified_vanilla`
  A rampart loses `RAMPART_DECAY_AMOUNT` hits every `RAMPART_DECAY_TIME` ticks.
- `RAMPART-DECAY-002` `behavior` `verified_vanilla`
  A rampart is removed in the same tick when decay reduces its hits to 0 or
  below.
- `RAMPART-DECAY-003` `matrix` `verified_vanilla`
  Owned rampart `hitsMax` by room controller level matches the canonical
  `RAMPART_HITS_MAX` table.
- `RAMPART-DECAY-004` `behavior` `verified_vanilla`
  `PWR_FORTIFY` prevents direct damage to a rampart while the effect is active.
- `RAMPART-DECAY-005` `behavior` `verified_vanilla`
  `PWR_SHIELD` creates a temporary rampart that is removed when the shield
  effect expires.

Coverage Notes
- Initial rampart hits on creation belong with construction behavior rather than
  ongoing rampart state.

### 12.3 Wall
- `WALL-001` `behavior` `verified_vanilla`
  Ordinary constructed walls do not decay.
- `WALL-002` `behavior` `verified_vanilla`
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
- `ROAD-HITS-001` `matrix` `verified_vanilla`
  A road produced by completing a construction site initializes with
  `ROAD_HITS` (5000) scaled by the underlying terrain ratio:
  1× on plain, `CONSTRUCTION_COST_ROAD_SWAMP_RATIO` (5×) on swamp,
  `CONSTRUCTION_COST_ROAD_WALL_RATIO` (150×) on natural wall. The engine
  branches on terrain at completion time, independent of the site's stored
  `progressTotal`.
- `ROAD-DECAY-001` `matrix` `verified_vanilla`
  Road decay amount by underlying terrain matches the canonical Screeps
  constants for plain, swamp, and wall terrain.
- `ROAD-DECAY-002` `behavior` `verified_vanilla`
  A road loses decay hits every `ROAD_DECAY_TIME` ticks.
- `ROAD-DECAY-003` `behavior` `verified_vanilla`
  A road is removed in the same tick when decay reduces its hits to 0 or below.

Coverage Notes
- `ROAD-HITS-001` is observed via `build()` completion (not `placeStructure`)
  so the engine's terrain-scaling branch actually runs.

### 13.2 Road — Wear
- `ROAD-WEAR-001` `matrix` `verified_vanilla`
  When a unit moves onto a road tile, road wear advances `nextDecayTime` earlier
  by the canonical amount for that mover type: `ROAD_WEAROUT * body.length` for
  creeps and `ROAD_WEAROUT_POWER_CREEP` for power creeps.
- `ROAD-WEAR-002` `behavior` `verified_vanilla`
  Road wear is applied in the same tick each time a unit successfully moves onto
  the road tile.
- `ROAD-WEAR-003` `behavior` `verified_vanilla`
  Road wear applies identically when the road is on a natural-wall tile —
  the engine keys off the presence of the road structure, not the underlying
  terrain.

### 13.3 Terminal
- `TERMINAL-SEND-001` `behavior` `verified_vanilla`
  A valid `send(resourceType, amount, targetRoomName)` call returns `OK` and
  queues a terminal transfer intent for later resolution.
- `TERMINAL-SEND-002` `behavior` `verified_vanilla`
  While `PWR_OPERATE_TERMINAL` is active, a successful
  `send(resourceType, amount, targetRoomName)` returns `OK` and sets cooldown
  on the terminal calling `send()` to
  `round(TERMINAL_COOLDOWN * POWER_INFO[PWR_OPERATE_TERMINAL].effect[level-1])`.
- `TERMINAL-SEND-003` `behavior` `verified_vanilla`
  When a terminal send resolves, the sending terminal spends
  `calcTerminalEnergyCost(amount, distance)` energy for the source room and
  target room, and the receiving terminal does not pay the transfer cost.
- `TERMINAL-SEND-004` `behavior` `verified_vanilla`
  While `PWR_OPERATE_TERMINAL` is active, terminal send energy cost is
  multiplied by `POWER_INFO[PWR_OPERATE_TERMINAL].effect[level-1]` and rounded
  up.
- `TERMINAL-SEND-005` `behavior` `verified_vanilla`
  `send(resourceType, amount, targetRoomName)` returns `ERR_INVALID_ARGS` when
  `resourceType`, `targetRoomName`, or `description` is invalid.
- `TERMINAL-SEND-006` `behavior` `verified_vanilla`
  `send(resourceType, amount, targetRoomName)` returns
  `ERR_NOT_ENOUGH_RESOURCES` when the terminal lacks the sent resource amount or
  the required energy cost.
- `TERMINAL-SEND-007` `behavior` `verified_vanilla`
  `send(resourceType, amount, targetRoomName)` returns `ERR_TIRED` while the
  terminal is on cooldown.
- `TERMINAL-SEND-008` `behavior` `verified_vanilla`
  `send(resourceType, amount, targetRoomName)` returns `ERR_RCL_NOT_ENOUGH`
  while the terminal is inactive.
- `TERMINAL-SEND-009` `behavior` `verified_vanilla`
  `send(resourceType, amount, targetRoomName)` returns `ERR_NOT_OWNER` when the
  terminal is not owned by the player.
- `TERMINAL-SEND-010` `behavior` `verified_vanilla`
  When a queued terminal send resolves successfully, the sending terminal's
  `cooldown` becomes `TERMINAL_COOLDOWN`.
- `TERMINAL-SEND-011` `behavior` `verified_vanilla`
  `send(resourceType, amount, targetRoomName)` can return `OK` but resolve to
  no transfer and no cooldown when the target room has no player terminal.
- `TERMINAL-SEND-012` `behavior` `verified_vanilla`
  When a terminal send resolves successfully, the target terminal receives the
  sent resource amount.

Coverage Notes
- Terminal store-type semantics and capacity constants belong in section `23. Store API`.
- Cooldown amount and market-order interactions should be derived from the
  terminal send and market processor paths rather than maintained here as loose
  summary bullets.

### 13.4 Observer
- `OBSERVER-001` `behavior` `verified_vanilla`
  A successful `observeRoom(roomName)` returns `OK` and makes the target room
  visible on the next tick, not the current tick.
- `OBSERVER-002` `behavior` `verified_vanilla`
  `observeRoom(roomName)` returns `ERR_NOT_IN_RANGE` when the target room is
  beyond `OBSERVER_RANGE`.
- `OBSERVER-003` `behavior` `verified_vanilla`
  While `PWR_OPERATE_OBSERVER` is active, `observeRoom(roomName)` ignores the
  normal `OBSERVER_RANGE` limit.
- `OBSERVER-004` `behavior` `verified_vanilla`
  `observeRoom(roomName)` returns `ERR_INVALID_ARGS` when `roomName` is not a
  valid room name.
- `OBSERVER-005` `behavior` `verified_vanilla`
  `observeRoom(roomName)` returns `ERR_RCL_NOT_ENOUGH` while the observer is
  inactive.
- `OBSERVER-006` `behavior` `verified_vanilla`
  `observeRoom(roomName)` returns `ERR_NOT_OWNER` when the observer is not owned
  by the player.

### 13.5 Extractor
- `EXTRACTOR-001` `behavior` `verified_vanilla`
  `StructureExtractor.cooldown` exposes the extractor's current cooldown and
  returns `0` when no cooldown is active.
- `EXTRACTOR-002` `behavior` `verified_vanilla`
  An extractor's public `cooldown` decreases by 1 each tick until it reaches
  `0`.

Coverage Notes
- `harvest(mineral)` action outcomes that depend on extractor presence,
  ownership, activity, or cooldown are owned by `3.2 Mineral Harvest`
  (`HARVEST-MINERAL-*`), not this section.

### 13.6 Portal

Cross-reference: inter-shard traversal and `Memory`/`InterShardMemory`
behavior across portals lives in section 29.2. Entries below cover the
same-shard portal mechanics and the shape of both same-shard and
cross-shard `destination` values.

- `PORTAL-001` `behavior` `verified_vanilla`
  A creep or power creep standing on a same-shard portal tile appears at the
  portal destination on the next tick.
- `PORTAL-002` `behavior` `verified_vanilla`
  A same-shard portal exposes `portal.destination` as a `RoomPosition` object.
- `PORTAL-003` `behavior` `verified_vanilla`
  A cross-shard portal exposes `portal.destination` as a plain object
  `{ shard, room }`.
- `PORTAL-004` `behavior` `verified_vanilla`
  A temporary portal exposes `ticksToDecay`, and a permanent portal returns
  `undefined` for `ticksToDecay`.
- `PORTAL-005` `behavior` `verified_vanilla`
  A creep or power creep standing on a portal tile is transported by the
  portal on the next tick without issuing a move intent.
- `PORTAL-006` `behavior` `verified_vanilla`
  A temporary portal's `ticksToDecay` counts down each tick and the portal
  is removed once the decay window elapses.

---

## 14. Structures — NPC

### 14.1 Keeper Lair
- `KEEPER-LAIR-001` `behavior` `verified_vanilla`
  When a keeper lair has a scheduled spawn, `ticksToSpawn` decreases by 1 each
  tick and stops being exposed when that spawn resolves.
- `KEEPER-LAIR-002` `behavior` `verified_vanilla`
  A keeper lair starts a new spawn timer when its current keeper is missing or
  below full hits.
- `KEEPER-LAIR-003` `behavior` `verified_vanilla`
  When the spawn timer completes, the keeper lair spawns a source keeper on its
  own tile in the same tick.

### 14.2 Invader Core
- `INVADER-CORE-001` `behavior` `verified_vanilla`
  `ticksToDeploy` counts down to deployment while an invader core has a pending
  deploy time.
- `INVADER-CORE-002` `behavior` `verified_vanilla`
  An invader core exposes its `level` as a public property.
- `INVADER-CORE-003` `behavior` `verified_vanilla`
  When an invader core has an active `spawning` state, the named creep is born
  on the invader core tile when `spawning.spawnTime` completes, and the core's
  `spawning` state clears in the same tick.
- `INVADER-CORE-004` `behavior` `verified_vanilla`
  When an invader core's `EFFECT_COLLAPSE_TIMER` expires, the room controller it
  governs becomes unowned level 0 in the same tick, and its progress, safe
  mode, power enablement, and controller effects are cleared.

Coverage Notes
- Stronghold orchestration began splitting into concrete observable behaviors
  in `14.5`; further family entries (rampart hits, effect propagation, reward
  contents) are still pending.

### 14.3 Power Bank `capability: powerCreeps`
- `POWER-BANK-001` `behavior` `verified_vanilla`
  When a power bank is attacked, it deals `POWER_BANK_HIT_BACK` of the received
  damage back to the attacker in the same tick.
- `POWER-BANK-002` `behavior` `verified_vanilla`
  `ticksToDecay` counts down to power bank removal.
- `POWER-BANK-003` `matrix` `needs_vanilla_verification`
  The public `powerBank.power` value lies within the canonical power bank
  capacity range.
- `POWER-BANK-004` `behavior` `verified_vanilla`
  When a power bank is destroyed, its stored power is dropped as a resource on
  the same tile.

Coverage Notes
- Concrete destruction-drop behavior for power banks is now covered by
  `POWER-BANK-004`.
- The critical-threshold behavior for generated power needs a dedicated
  observable rule before it belongs in the catalog.

### 14.4 NPC Ownership Query Surface
- `NPC-OWNERSHIP-001` `matrix` `verified_vanilla`
  For each NPC structure class listed in `docs/behavior-matrices.md` under
  `NPC-OWNERSHIP`, the public `my` and `owner` properties match the values
  defined for that class.

Coverage Notes
- This family is limited to public ownership query properties, not owner-gated
  API behavior.

### 14.5 Stronghold Layout `capability: invaderCore`
- `STRONGHOLD-LAYOUT-001` `matrix` `verified_vanilla`
  When a deploying invader core's deploy timer reaches its trigger
  (`core.deployTime <= gameTime + 1`), the engine places the canonical
  stronghold structure layout for `core.templateName` relative to the core
  position. For each canonical bunker template (`bunker1`–`bunker5`) listed
  in `docs/behavior-matrices.md` under `STRONGHOLD-LAYOUT`, every non-core
  template entry produces a structure of the listed `type` at the listed
  `(dx, dy)` offset from the core; the invader core itself remains in place
  with its `deployTime` cleared and no extra invader-core structure is
  created.

Coverage Notes
- Coverage of stronghold orchestration that previously sat in `14.2` has
  begun here as a layout matrix. Per-rampart hits scaling
  (`STRONGHOLD_RAMPART_HITS`), per-tile effect propagation
  (`EFFECT_COLLAPSE_TIMER`), and stronghold container reward contents are
  separate observables not covered by `STRONGHOLD-LAYOUT-001`.


---

## 15. Structure Common

### 15.1 Hits & Destruction
- `STRUCTURE-HITS-001` `matrix` `verified_vanilla`
  Fixed durability values for structures with constant hit totals match the
  canonical Screeps constants.
- `STRUCTURE-HITS-002` `behavior` `verified_vanilla`
  Destroyable structures expose `hits` and `hitsMax`.
- `STRUCTURE-HITS-003` `behavior` `verified_vanilla`
  A structure at 0 hits is destroyed in the same tick.
- `STRUCTURE-HITS-004` `behavior` `verified_vanilla`
  Destroying a structure by non-nuke means creates a ruin on that tile
  containing the structure's remaining store.
- `STRUCTURE-HITS-005` `behavior` `verified_vanilla`
  A ruin's `ticksToDecay` decrements by 1 each tick; when it reaches 0, the
  ruin is removed and any remaining store contents become dropped resources on
  the same tile.

### 15.2 isActive & RCL
- `STRUCTURE-ACTIVE-001` `behavior` `verified_vanilla`
  For owned structure types limited by `CONTROLLER_STRUCTURES`, `isActive()`
  returns `true` only for the allowed same-type structures closest to the room
  controller at the current controller level.
- `STRUCTURE-ACTIVE-002` `behavior` `verified_vanilla`
  Inactive structures still exist in the room but their gated gameplay actions
  fail active-structure checks.
- `STRUCTURE-ACTIVE-003` `behavior` `verified_vanilla`
  A structure becomes active again if the room controller later satisfies its
  active-limit requirements.
- `STRUCTURE-ACTIVE-004` `behavior` `verified_vanilla`
  Structures with no owner or no controller limit table entry return `true`
  from `isActive()`.
- `STRUCTURE-ACTIVE-005` `behavior` `verified_vanilla`
  When same-type owned structures are at equal controller distance, `isActive()`
  breaks the tie by the engine's object scan order.

### 15.3 Construction Costs
- `CONSTRUCTION-COST-001` `matrix` `verified_vanilla`
  Buildable structure construction costs match the canonical
  `CONSTRUCTION_COST` table.
- `CONSTRUCTION-COST-002` `behavior` `verified_vanilla`
  A construction site's `progressTotal` equals its structure's construction
  cost.
- `CONSTRUCTION-COST-003` `matrix` `verified_vanilla`
  A road construction site's `progressTotal` scales by the terrain ratio of
  the underlying tile: `CONSTRUCTION_COST_ROAD_SWAMP_RATIO` (5×) on swamp
  and `CONSTRUCTION_COST_ROAD_WALL_RATIO` (150×) on natural wall. Covers
  swamp- and wall-tile variants; plain is covered by `CONSTRUCTION-COST-001`.

### 15.4 Structure APIs
- `STRUCTURE-API-001` `behavior` `verified_vanilla`
  `destroy()` returns `ERR_NOT_OWNER` when the room controller is missing or not
  owned by the player.
- `STRUCTURE-API-002` `behavior` `verified_vanilla`
  `destroy()` returns `ERR_BUSY` when hostile creeps or hostile power creeps are
  present in the room.
- `STRUCTURE-API-003` `behavior` `verified_vanilla`
  A successful `destroy()` returns `OK`, removes the structure in the same
  tick, and creates a ruin on that tile containing the structure's remaining
  store.
- `STRUCTURE-API-004` `behavior` `verified_vanilla`
  `notifyWhenAttacked(enabled)` returns `ERR_NOT_OWNER` when the structure is
  not owned by the player or the room controller is hostile.
- `STRUCTURE-API-005` `behavior` `verified_vanilla`
  `notifyWhenAttacked(enabled)` returns `ERR_INVALID_ARGS` when `enabled` is not
  boolean.
- `STRUCTURE-API-006` `behavior` `verified_vanilla`
  A successful `notifyWhenAttacked(enabled)` returns `OK` and updates the
  structure's attack notification setting on the next tick.

### 15.5 Effects Substrate `capability: powerCreeps`
- `EFFECT-DECAY-001` `behavior` `verified_vanilla`
  An entry's `ticksRemaining` decrements by exactly 1 each subsequent tick
  while the host RoomObject remains alive.
- `EFFECT-DECAY-002` `behavior` `verified_vanilla`
  An entry is removed from the `effects` array on the tick its remaining
  duration would reach 0; the last tick it is observable, its
  `ticksRemaining` is 1.
- `EFFECT-APPLY-001` `behavior` `verified_vanilla`
  Re-applying a power that is already active on the same target replaces
  the existing entry rather than adding a second one. After
  re-application, exactly one entry for that power remains and its
  `ticksRemaining` reflects the new full duration, regardless of how much
  time the prior entry had left.
- `EFFECT-APPLY-002` `behavior` `verified_vanilla`
  Effects keyed on different powers coexist on the same target as
  independent entries with independent timers; expiry of one entry does
  not affect any other.
- `EFFECT-DESTROY-001` `behavior` `verified_vanilla`
  When a host RoomObject is destroyed, its active effects do not migrate
  to any successor object (e.g. ruin, dropped resources) on the same
  tile.
- `EFFECT-HOST-001` `matrix` `verified_vanilla`
  For each producer/target pair in the active effect-host matrix, a successful
  producer action exposes an active entry in the target RoomObject's `effects`
  array with the expected `power` and/or `effect` id, applicable `level`,
  exact effect-entry property shape, and positive `ticksRemaining`.

Coverage Notes
- The substrate tested here is the universal `RoomObject.effects`
  surface, not the per-power magnitudes — those remain in §7.12, §17.2,
  §17.4, §19.4–§19.7.
- Vanilla writes effects with both `power` and `effect` carrying the same
  numeric ID for power-applied entries, with only `power` set for
  PWR_SHIELD's auto-spawned rampart, and with only `effect` set for
  invader-core EFFECT_INVULNERABILITY. Player code should match against
  whichever field the producing path populates rather than assuming
  disjointness.
- The active effect-host matrix currently covers player-code power producers
  that are feasible through public setup helpers. Invader-core natural effects
  are deferred until the harness can create those active effects without direct
  effect injection.
- The runtime view of an entry exposes `ticksRemaining`, derived per tick
  from a server-side `endTime`. The server-side field is not surfaced to
  player code and is not part of the spec.

---

## 16. Room Mechanics

### 16.1 Visibility
- `ROOM-VIS-001` `behavior` `verified_vanilla`
  A visible room has a `Game.rooms[roomName]` entry on that tick.
- `ROOM-VIS-002` `behavior` `verified_vanilla`
  A non-visible room has no `Game.rooms[roomName]` entry on that tick.
- `ROOM-VIS-003` `behavior` `verified_vanilla`
  A room that exists in the engine but is unowned and has no player
  structures or creeps has no `Game.rooms[roomName]` entry for that player.
  Stricter than `ROOM-VIS-002`: the room is loaded, just outside the
  player's visibility.

Coverage Notes
- Observer-provided visibility timing is owned by `13.4 Observer`.

### 16.2 Energy Tracking
- `ROOM-ENERGY-001` `behavior` `verified_vanilla`
  `room.energyAvailable` equals the sum of stored energy in the room's active
  spawns and extensions.
- `ROOM-ENERGY-002` `behavior` `verified_vanilla`
  `room.energyCapacityAvailable` equals the sum of energy capacity in the
  room's active spawns and extensions.

### 16.3 Find
- `ROOM-FIND-001` `matrix` `verified_vanilla`
  `Room.find()` result sets for supported `FIND_*` constants match the
  canonical room-find mapping.
- `ROOM-FIND-002` `behavior` `verified_vanilla`
  `Room.find(type, {filter})` applies the filter to the selected result set
  before returning it.
- `ROOM-FIND-003` `behavior` `verified_vanilla`
  `FIND_EXIT_TOP`, `FIND_EXIT_RIGHT`, `FIND_EXIT_BOTTOM`, and
  `FIND_EXIT_LEFT` return walkable border positions on that side.
- `ROOM-FIND-004` `behavior` `verified_vanilla`
  `FIND_EXIT` returns the concatenation of the four side-specific exit result
  sets.
- `ROOM-FIND-005` `behavior` `verified_vanilla`
  `FIND_SOURCES_ACTIVE` returns only sources whose current energy is greater
  than `0`.
- `ROOM-FIND-006` `behavior` `verified_vanilla`
  Player-relative `FIND_*` constants such as `FIND_MY_CREEPS` and
  `FIND_HOSTILE_CREEPS` evaluate from the current player's perspective.

### 16.4 Look
- `ROOM-LOOK-001` `behavior` `verified_vanilla`
  `lookAt(x, y)` returns the public look entries on that tile, including a
  `terrain` entry alongside any creeps and structures occupying the tile.
- `ROOM-LOOK-002` `behavior` `verified_vanilla`
  `lookForAt(LOOK_STRUCTURES, x, y)` returns only the structures on that
  tile, omitting non-structure objects sharing the position.
- `ROOM-LOOK-003` `behavior` `verified_vanilla`
  `lookForAt(LOOK_CREEPS, x, y)` returns only the creeps on that tile,
  omitting non-creep objects sharing the position.
- `ROOM-LOOK-004` `behavior` `verified_vanilla`
  `lookForAt(LOOK_TERRAIN, x, y)` returns a single-element array containing
  the terrain string (`"plain"`, `"swamp"`, or `"wall"`) at that tile.
- `ROOM-LOOK-005` `behavior` `verified_vanilla`
  `lookForAtArea(type, top, left, bottom, right, true)` filters to objects
  whose position lies inside the bounding box, exposing each match under the
  requested look-type key in the entry.
- `ROOM-LOOK-006` `behavior` `verified_vanilla`
  `lookForAt(type, x, y)` returns `ERR_INVALID_ARGS` when `type` is neither
  `LOOK_TERRAIN` nor a registered `LOOK_*` constant. Engine `rooms.js`
  performs this validation before reading the tile.
- `ROOM-LOOK-007` `behavior` `verified_vanilla`
  `lookForAt(LOOK_ENERGY, x, y)` returns the same dropped `Resource` objects
  as `lookForAt(LOOK_RESOURCES, x, y)` because both look constants resolve
  to the room's dropped-resource backing register.
- `ROOM-LOOK-008` `behavior` `verified_vanilla`
  `lookForAtArea(LOOK_ENERGY, top, left, bottom, right, true)` returns the
  same dropped `Resource` objects as the equivalent call with
  `LOOK_RESOURCES`, exposed under the requested `"energy"` look-type key in
  each entry.
- `ROOM-LOOK-009` `behavior` `verified_vanilla`
  `lookAt(x, y)` on a tile holding a dropped resource yields two entries
  for the same resource — one with `type: "energy"` and one with
  `type: "resource"` — because `lookAt` walks both look constants against
  the dropped-resource backing register.
- `ROOM-LOOK-010` `behavior` `verified_vanilla`
  `lookForAt(type, x, y)` returns `[]` (not `ERR_INVALID_ARGS`) for a valid
  built-in `LOOK_*` constant whose register is empty at the queried tile —
  including `LOOK_NUKES`, `LOOK_POWER_CREEPS`, and `LOOK_DEPOSITS`. The
  validity check on `type` is independent of whether any object of that
  type is present.

### 16.5 Terrain
- `ROOM-TERRAIN-001` `matrix` `verified_vanilla`
  `Room.Terrain.get(x, y)` returns the canonical terrain mask values for
  plain, swamp, and wall tiles.
- `ROOM-TERRAIN-002` `behavior` `verified_vanilla`
  `Room.Terrain.getRawBuffer()` returns the room terrain as a 2500-byte
  `Uint8Array`.
- `ROOM-TERRAIN-003` `behavior` `verified_vanilla`
  `Game.map.getRoomTerrain(roomName)` provides equivalent terrain access to
  `new Room.Terrain(roomName)`.

### 16.6 Event Log
- `ROOM-EVENTLOG-001` `behavior` `verified_vanilla`
  `room.getEventLog()` returns the current tick's parsed room event array.
- `ROOM-EVENTLOG-002` `matrix` `verified_vanilla`
  Current-tick event entries use the canonical event-type and payload mapping.
- `ROOM-EVENTLOG-003` `behavior` `verified_vanilla`
  `room.getEventLog(true)` returns the current tick's raw event-log JSON
  string.
- `ROOM-EVENTLOG-004` `behavior` `verified_vanilla`
  Room events are only exposed for the current tick.
- `ROOM-EVENTLOG-005` `behavior` `verified_vanilla`
  `EVENT_OBJECT_DESTROYED` is emitted when a creep dies, with `data.type ===
  'creep'` and `objectId` referencing the destroyed creep.
- `ROOM-EVENTLOG-006` `behavior` `verified_vanilla`
  `EVENT_OBJECT_DESTROYED` is emitted when an attack reduces a structure's
  `hits` to 0, with `data.type` set to the destroyed `structureType`.
  Non-lethal damage on the same tick does not emit the event.
- `ROOM-EVENTLOG-007` `behavior` `verified_vanilla`
  `EVENT_TRANSFER` is emitted by creep `transfer` (`objectId=creep`,
  `targetId=target`), creep `withdraw` (`objectId=source`, `targetId=creep`,
  matching vanilla's role flip), and link `transferEnergy` (amount is
  pre-loss). Each carries `data.resourceType` and `data.amount`.
- `ROOM-EVENTLOG-008` `behavior` `verified_vanilla`
  `EVENT_EXIT` is emitted when a creep crosses a room boundary, with
  `data.room` set to the destination room name and `data.x`/`data.y` set to
  the creep's position in that destination room.
- `ROOM-EVENTLOG-009` `behavior` `verified_vanilla`
  `EVENT_ATTACK_CONTROLLER` is emitted when a CLAIM creep attacks an enemy
  controller. The event has no extra payload fields and the wrapper omits
  `data` entirely (matching vanilla's JSON output).
- `ROOM-EVENTLOG-010` `behavior` `verified_vanilla`
  `EVENT_RESERVE_CONTROLLER` is emitted with `data.amount` equal to
  CLAIM-parts × `CONTROLLER_RESERVE`.
- `ROOM-EVENTLOG-011` `behavior` `verified_vanilla`
  `EVENT_UPGRADE_CONTROLLER` is emitted with `data.amount` and
  `data.energySpent` set to the energy applied to the controller this tick.
- `ROOM-EVENTLOG-012` `behavior` `verified_vanilla`
  `EVENT_HARVEST` is emitted when a creep harvests a source, with
  `objectId` set to the creep, `data.targetId` set to the source, and
  `data.amount` set to the energy harvested this tick.
- `ROOM-EVENTLOG-013` `behavior` `verified_vanilla`
  `EVENT_BUILD` is emitted when a creep builds a construction site, with
  `objectId` set to the creep, `data.targetId` set to the site,
  `data.amount` equal to the progress added this tick, and `data.incomplete`
  reflecting whether the site still has work remaining.
- `ROOM-EVENTLOG-014` `behavior` `verified_vanilla`
  `EVENT_REPAIR` is emitted when a creep repairs a structure, with
  `objectId` set to the creep, `data.targetId` set to the structure, and
  `data.amount`/`data.energySpent` matching the hits restored this tick.
- `ROOM-EVENTLOG-015` `behavior` `verified_vanilla`
  `EVENT_ATTACK` from `rangedAttack` carries
  `data.attackType === EVENT_ATTACK_TYPE_RANGED` and `data.damage` equal to
  `RANGED_ATTACK_POWER` per RANGED_ATTACK part.
- `ROOM-EVENTLOG-016` `behavior` `verified_vanilla`
  `EVENT_ATTACK` from `rangedMassAttack` emits one entry per target hit,
  each with `data.attackType === EVENT_ATTACK_TYPE_RANGED_MASS` and
  `data.damage` scaled by `RANGED_ATTACK_DISTANCE_RATE`.
- `ROOM-EVENTLOG-017` `behavior` `verified_vanilla`
  When a creep with ATTACK parts is hit by a melee attack, an additional
  `EVENT_ATTACK` is emitted from the target with
  `data.attackType === EVENT_ATTACK_TYPE_HIT_BACK` and `data.damage` equal
  to the ATTACK-part hit-back amount.
- `ROOM-EVENTLOG-018` `behavior` `verified_vanilla`
  `EVENT_HEAL` from creep `heal()` carries
  `data.healType === EVENT_HEAL_TYPE_MELEE` and `data.amount` equal to
  `HEAL_POWER` per HEAL part.
- `ROOM-EVENTLOG-019` `behavior` `verified_vanilla`
  When a nuke lands, `EVENT_ATTACK` is emitted for each damaged structure
  with `data.attackType === EVENT_ATTACK_TYPE_NUKE` and `data.damage`
  matching `NUKE_DAMAGE` for the structure's range from the impact tile.
- `ROOM-EVENTLOG-020` `behavior` `verified_vanilla`
  `EVENT_POWER` is emitted when a power creep's `usePower` succeeds, with
  `objectId` set to the power creep, `data.power` equal to the activated
  `PWR_*` constant, and `data.targetId` set to the targeted object.
- `ROOM-EVENTLOG-021` `behavior` `verified_vanilla`
  `EVENT_ATTACK` from creep `dismantle()` carries
  `data.attackType === EVENT_ATTACK_TYPE_DISMANTLE` and `data.damage`
  equal to `DISMANTLE_POWER` per WORK part.
- `ROOM-EVENTLOG-022` `behavior` `verified_vanilla`
  `EVENT_HEAL` from creep `rangedHeal()` carries
  `data.healType === EVENT_HEAL_TYPE_RANGED` and `data.amount` equal to
  `RANGED_HEAL_POWER` per HEAL part.
- `ROOM-EVENTLOG-023` `behavior` `verified_vanilla`
  When a structure is destroyed on a tick where multiple attackers landed
  damage on it, `EVENT_OBJECT_DESTROYED` is emitted exactly once for that
  structure.
- `ROOM-EVENTLOG-024` `behavior` `verified_vanilla`
  On a kill-shot, `EVENT_OBJECT_DESTROYED` for the destroyed target precedes
  the originating `EVENT_ATTACK` in `Room.getEventLog()`'s array order.
- `ROOM-EVENTLOG-025` `behavior` `verified_vanilla`
  When a melee attack triggers a counter from a target with `ATTACK` parts,
  the `EVENT_ATTACK` entry with `attackType === EVENT_ATTACK_TYPE_HIT_BACK`
  precedes the originating `EVENT_ATTACK` entry in `Room.getEventLog()`'s
  array order.
- `ROOM-EVENTLOG-026` `matrix` `needs_vanilla_verification`
  Nuke-specific event-log details match the canonical matrix for `EVENT_ATTACK`
  object/target ids, absence of creep attack events from room-wide nuke kills,
  and rampart-before-covered-structure ordering.

### 16.7 Flags
- `FLAG-001` `behavior` `verified_vanilla`
  `Room.createFlag()` creates a player flag at the requested position and
  returns the flag name. The flag is visible only in the creating player's
  `Game.flags`.
- `FLAG-002` `behavior` `verified_vanilla`
  A created flag stores its `name`, `color`, and `secondaryColor`.
- `FLAG-003` `behavior` `verified_vanilla`
  A player cannot exceed `FLAGS_LIMIT` total flags.
- `FLAG-004` `behavior` `verified_vanilla`
  `Flag.remove()` removes the flag from the player's flag set.
- `FLAG-005` `behavior` `verified_vanilla`
  `Flag.setColor()` updates the flag's `color` and `secondaryColor`.
- `FLAG-006` `behavior` `verified_vanilla`
  `Flag.setPosition()` moves the flag to the requested room position.
- `FLAG-007` `behavior` `verified_vanilla`
  `createFlag()` returns `ERR_NAME_EXISTS` when the requested name is already
  in use by the player.
- `FLAG-008` `behavior` `verified_vanilla`
  `createFlag()` returns `ERR_FULL` when the player has reached `FLAGS_LIMIT`.

Coverage Notes
- Old FLAG-007 ("player-scoped and referenced by name") dropped: player-scoping
  merged into FLAG-001; "referenced by name" is API shape, not a behavior.
- `RoomPosition.createFlag()` is owned by ROOMPOS-ACTION-002 in section 22.

---

## 17. Source, Mineral & Deposit Lifecycle

### 17.1 Source Regeneration
- `SOURCE-REGEN-001` `matrix` `verified_vanilla`
  Source capacity matches the canonical room-state mapping for neutral,
  reserved or owned, and keeper rooms.
- `SOURCE-REGEN-002` `behavior` `verified_vanilla`
  When a source regeneration timer completes, the source restores to its
  current room-state capacity in the same tick.
- `SOURCE-REGEN-003` `behavior` `verified_vanilla`
  A source below its current full capacity exposes `ticksToRegeneration`.
- `SOURCE-REGEN-004` `behavior` `verified_vanilla`
  While `source.ticksToRegeneration` is defined, it decreases by `1` each tick
  until regeneration completes.
- `SOURCE-REGEN-005` `behavior` `verified_vanilla`
  A source at full capacity returns `undefined` for `ticksToRegeneration`.
- `SOURCE-REGEN-006` `behavior` `verified_vanilla`
  When a room's ownership state changes (neutral ↔ reserved ↔ owned), source
  capacity updates to the new room-state value on the next regeneration.

### 17.2 Source Power Effects
- `SOURCE-POWER-001` `matrix` `verified_vanilla`
  `PWR_REGEN_SOURCE` adds energy using the canonical effect, period, and
  duration for each supported power level.
- `SOURCE-POWER-002` `behavior` `verified_vanilla`
  `PWR_DISRUPT_SOURCE` prevents scheduled source regeneration from restoring
  energy while the effect is active.

### 17.3 Mineral Regeneration
- `MINERAL-REGEN-001` `matrix` `verified_vanilla`
  Mineral densities and full amounts match the canonical density mapping.
- `MINERAL-REGEN-002` `behavior` `verified_vanilla`
  When a mineral regeneration timer completes, the mineral restores to its
  current density amount in the same tick.
- `MINERAL-REGEN-003` `behavior` `verified_vanilla`
  A full mineral returns `undefined` for `ticksToRegeneration`.
- `MINERAL-REGEN-004` `behavior` `verified_vanilla`
  A depleted mineral exposes `ticksToRegeneration`, and that value decreases
  by `1` each tick until regeneration completes.
- `MINERAL-REGEN-005` `behavior` `verified_vanilla`
  A mineral's `mineralType` remains the same across regenerations.

### 17.4 Mineral Power Effects
- `MINERAL-POWER-001` `matrix` `verified_vanilla`
  `PWR_REGEN_MINERAL` adds mineral amount using the canonical effect, period,
  and duration for each supported power level.

### 17.5 Deposit Lifecycle `capability: deposit`
- `DEPOSIT-001` `matrix` `verified_vanilla`
  Deposit objects expose the canonical `depositType` values.
- `DEPOSIT-002` `behavior` `verified_vanilla`
  `deposit.lastCooldown` equals
  `ceil(DEPOSIT_EXHAUST_MULTIPLY * harvested^DEPOSIT_EXHAUST_POW)` for the
  deposit's current harvested count.
- `DEPOSIT-003` `behavior` `verified_vanilla`
  After a successful harvest, `deposit.cooldown` exposes the remaining wait in
  ticks until the next harvest becomes available, and returns `0` once that
  wait has elapsed.
- `DEPOSIT-004` `behavior` `verified_vanilla`
  `deposit.ticksToDecay` becomes defined after the first successful harvest
  and decreases by `1` each tick until the deposit is removed.
- `DEPOSIT-005` `behavior` `verified_vanilla`
  Repeated successful harvests can increase a deposit's exposed
  `lastCooldown` and future `cooldown`.
- `DEPOSIT-006` `behavior` `verified_vanilla`
  When `ticksToDecay` reaches `0`, the deposit object is removed from the room.

---

## 18. Game Objects

### 18.1 Tombstone
- `TOMBSTONE-001` `behavior` `verified_vanilla`
  When a creep is killed, a tombstone appears at its death position exposing
  the dead creep's name, the game time of death, and the creep's remaining
  store.
- `TOMBSTONE-002` `behavior` `verified_vanilla`
  A creep tombstone's initial `ticksToDecay` equals
  `body.length * TOMBSTONE_DECAY_PER_PART`.
- `TOMBSTONE-003` `behavior` `verified_vanilla`
  The tombstone's `store` contains the creep's carried resources plus
  body-part corpse energy computed from `CREEP_CORPSE_RATE`, the creep's
  remaining TTL fraction, and each part's `BODYPART_COST`.
- `TOMBSTONE-004` `behavior` `verified_vanilla`
  A tombstone is removed from the room when its `ticksToDecay` reaches `0`.
- `TOMBSTONE-005` `behavior` `verified_vanilla`
  A tombstone's `ticksToDecay` strictly decreases by one each subsequent
  tick until removal.

Coverage Notes
- Power creep tombstone decay dropped: requires `capability: powerCreeps`,
  not feasible for either adapter currently.

### 18.2 Ruin
- `RUIN-001` `behavior` `verified_vanilla`
  A ruin exposes the destroyed structure's `structureType`, `destroyTime`,
  remaining `store`, and decay timer.
- `RUIN-002` `matrix` `verified_vanilla`
  Ruin decay time matches `RUIN_DECAY_STRUCTURES` when present and
  `RUIN_DECAY` otherwise.
- `RUIN-003` `behavior` `verified_vanilla`
  Ruin resources can be withdrawn subject to the normal `withdraw()`
  preconditions and blockers.
- `RUIN-004` `behavior` `verified_vanilla`
  When a structure is destroyed, a ruin is created at its position in the
  same tick.
- `RUIN-005` `behavior` `verified_vanilla`
  A ruin is removed from the room when its `ticksToDecay` reaches `0`.
- `RUIN-006` `behavior` `verified_vanilla`
  A ruin's `ticksToDecay` strictly decreases by one each subsequent tick
  until removal.

### 18.3 Nuke (In-Flight)
- `NUKE-FLIGHT-001` `behavior` `verified_vanilla`
  Launching a nuke creates a `Nuke` object in the target room with
  `launchRoomName` and `timeToLand`.
- `NUKE-FLIGHT-002` `behavior` `verified_vanilla`
  `nuke.timeToLand` decreases by `1` each tick until the landing tick.
- `NUKE-FLIGHT-003` `behavior` `verified_vanilla`
  An in-flight nuke is visible in the target room before it lands.
- `NUKE-FLIGHT-004` `matrix` `needs_vanilla_verification`
  In-flight nuke visibility matches the canonical player-perspective matrix,
  including target-room visibility, launch-room absence, and no target-room
  visibility.
- `NUKE-FLIGHT-005` `behavior` `needs_vanilla_verification`
  After a nuke lands, the in-flight `Nuke` object is removed from the target
  room and no longer appears in `FIND_NUKES`.

---

## 19. Power Creeps `capability: powerCreeps`

### 19.0 Game.gpl
- `GPL-001` `behavior` `verified_vanilla`
  With zero processed account power, `Game.gpl` reports level `0`, progress `0`,
  and `POWER_LEVEL_MULTIPLY` progress required for the next level.
- `GPL-002` `matrix` `verified_vanilla`
  `Game.gpl.level`, `progress`, and `progressTotal` follow the vanilla account
  power formula at threshold edges:
  `level = floor((power / POWER_LEVEL_MULTIPLY) ** (1 / POWER_LEVEL_POW))`,
  `progress = power - level ** POWER_LEVEL_POW * POWER_LEVEL_MULTIPLY`, and
  `progressTotal = (level + 1) ** POWER_LEVEL_POW * POWER_LEVEL_MULTIPLY - base`.
- `GPL-003` `behavior` `verified_vanilla`
  `PowerCreep.create(name, POWER_CLASS.OPERATOR)` returns
  `ERR_NOT_ENOUGH_RESOURCES` when GPL level is `0`.
- `GPL-004` `behavior` `verified_vanilla`
  One GPL level allows exactly one allocated power creep level; after creating
  one power creep at GPL level `1`, another `PowerCreep.create()` returns
  `ERR_NOT_ENOUGH_RESOURCES`.
- `GPL-005` `behavior` `verified_vanilla`
  Creating or upgrading power creeps consumes free allocated power levels but
  does not change `Game.gpl`, which reflects total processed account power.

### 19.1 Lifecycle
- `POWERCREEP-CREATE-001` `behavior` `verified_vanilla`
  A successful `PowerCreep.create(name, className)` returns `OK` and queues a
  new unspawned power creep with that name and class.
- `POWERCREEP-CREATE-002` `matrix` `verified_vanilla`
  `PowerCreep.create()` failure codes match the canonical validation matrix
  for invalid arguments, duplicate name, and insufficient free power levels.
- `POWERCREEP-SPAWN-001` `behavior` `verified_vanilla`
  A successful `powerCreep.spawn(powerSpawn)` returns `OK`, places the power
  creep on the power spawn's tile and restores full hits and full TTL when the
  spawn resolves.
- `POWERCREEP-SPAWN-002` `matrix` `verified_vanilla`
  `powerCreep.spawn()` failure codes match the canonical validation matrix for
  busy, invalid target, ownership, inactive power spawn, and spawn cooldown.
- `POWERCREEP-LIFETIME-001` `behavior` `verified_vanilla`
  A spawned power creep's `ticksToLive` decreases by `1` each tick.
- `POWERCREEP-DEATH-001` `behavior` `verified_vanilla`
  A power creep death creates a tombstone on the death tile with the power
  creep snapshot fields and `TOMBSTONE_DECAY_POWER_CREEP` decay time.
- `POWERCREEP-RENEW-001` `behavior` `verified_vanilla`
  A successful `powerCreep.renew(target)` returns `OK` and resets
  `ticksToLive` to `POWER_CREEP_LIFE_TIME` in the same tick.
- `POWERCREEP-RENEW-002` `matrix` `verified_vanilla`
  `powerCreep.renew()` failure codes match the canonical validation matrix for
  invalid target, inactive power spawn, range, busy, and ownership.
- `POWERCREEP-DELETE-001` `behavior` `verified_vanilla`
  `powerCreep.delete()` queues deletion for an unspawned owned power creep.
- `POWERCREEP-DELETE-002` `behavior` `verified_vanilla`
  `powerCreep.delete()` returns `ERR_BUSY` for a spawned power creep.
- `POWERCREEP-DELETE-003` `behavior` `verified_vanilla`
  `powerCreep.delete()` returns `ERR_NOT_OWNER` for an unowned power creep.
- `POWERCREEP-UPGRADE-001` `behavior` `verified_vanilla`
  A successful `powerCreep.upgrade(power)` returns `OK`, increases the
  specified power's level by `1`, increases the power creep's `level` by `1`,
  increases `hitsMax` by `1000`, and increases `storeCapacity` by `100`.
- `POWERCREEP-UPGRADE-002` `matrix` `verified_vanilla`
  `powerCreep.upgrade()` failure codes match the canonical validation matrix
  for ownership, free power levels, max level, invalid power selection, and
  unmet level requirements.

### 19.2 Movement & Actions
- `POWERCREEP-MOVE-001` `behavior` `verified_vanilla`
  A successful power creep move generates no fatigue on plain, swamp, or road
  terrain.
- `POWERCREEP-MOVE-002` `behavior` `verified_vanilla`
  A successful move onto a road applies `ROAD_WEAROUT_POWER_CREEP` road wear
  in the same tick.
- `POWERCREEP-ACTION-001` `matrix` `verified_vanilla`
  While spawned, `transfer()`, `withdraw()`, `pickup()`, `drop()`, and `say()`
  use the same public semantics and return codes as the corresponding creep
  APIs.
- `POWERCREEP-ACTION-002` `behavior` `verified_vanilla`
  The resource and speech methods above return `ERR_BUSY` while the power
  creep is unspawned.
- `POWERCREEP-ACTION-003` `behavior` `verified_vanilla`
  Power creeps do not expose the standard creep body-part action methods such
  as `attack()`, `heal()`, `harvest()`, `build()`, `repair()`,
  `dismantle()`, and `claimController()` on their public API.

### 19.3 Enable Room
- `POWERCREEP-ENABLE-001` `behavior` `verified_vanilla`
  A successful `powerCreep.enableRoom(controller)` returns `OK` and sets
  `controller.isPowerEnabled` to `true` on the next tick.
- `POWERCREEP-ENABLE-002` `matrix` `verified_vanilla`
  `powerCreep.enableRoom()` failure codes match the canonical validation
  matrix for invalid target, safe-mode-blocked hostile controller, range,
  busy, and ownership.

### 19.4 Operate Powers
- `POWER-OPERATE-001` `matrix` `verified_vanilla`
  Operate power effect magnitudes match `POWER_INFO[power].effect[level]` for
  all numeric operate powers and supported power levels.
- `POWER-OPERATE-002` `matrix` `verified_vanilla`
  Operate power `cooldown`, `range`, and `ops` cost match `POWER_INFO` for each
  operate power.
- `POWER-OPERATE-003` `behavior` `verified_vanilla`
  `PWR_OPERATE_OBSERVER` allows `observeRoom()` beyond the observer's normal
  range while the effect is active.
- `POWER-OPERATE-004` `behavior` `verified_vanilla`
  `PWR_OPERATE_FACTORY` changes the target factory's effective production level
  according to the power level while the effect is active.
- `POWER-OPERATE-005` `matrix` `needs_vanilla_verification`
  For room-bound operate powers, target validity and failure in rooms without
  power enabled match the canonical power-to-target matrix.

Coverage Notes
- The production consequences of `PWR_OPERATE_FACTORY` are owned by `11.5
  Factory Commodity Chains`.

### 19.5 Disrupt Powers
- `POWER-DISRUPT-001` `matrix` `verified_vanilla`
  Disrupt power effect values and durations match `POWER_INFO` for each disrupt
  power and supported power level.
- `POWER-DISRUPT-002` `matrix` `verified_vanilla`
  Disrupt power `cooldown`, `range`, and `ops` cost match `POWER_INFO` for
  each disrupt power.
- `POWER-DISRUPT-003` `matrix` `needs_vanilla_verification`
  For disrupt powers with structure targets, target acceptance and
  invalid-target behavior match the canonical power-to-target matrix.

### 19.6 Regen Powers
- `POWER-REGEN-001` `matrix` `verified_vanilla`
  Regen power effect amount, period, and duration match `POWER_INFO` for each
  regen power and supported power level.
- `POWER-REGEN-002` `matrix` `verified_vanilla`
  Regen power `cooldown`, `range`, and `ops` cost match `POWER_INFO` for each
  regen power.

### 19.7 Combat Powers
- `POWER-COMBAT-001` `matrix` `verified_vanilla`
  `PWR_SHIELD` and `PWR_FORTIFY` effect magnitudes match `POWER_INFO` for each
  supported power level.
- `POWER-COMBAT-002` `behavior` `verified_vanilla`
  A successful `usePower(PWR_SHIELD)` returns `OK` and creates a temporary
  rampart at the power creep's position in the same tick.
- `POWER-COMBAT-003` `behavior` `verified_vanilla`
  The rampart created by `PWR_SHIELD` is removed when the shield effect
  expires.

### 19.8 Generate Ops
- `POWER-GENERATE-OPS-001` `matrix` `verified_vanilla`
  `PWR_GENERATE_OPS` amount, cooldown, and ops cost match `POWER_INFO` for
  each supported power level.
- `POWER-GENERATE-OPS-002` `behavior` `verified_vanilla`
  A successful `usePower(PWR_GENERATE_OPS)` returns `OK` and adds ops to the
  power creep's store in the same tick.
- `POWER-GENERATE-OPS-003` `behavior` `verified_vanilla`
  If generated ops would overflow the power creep's store capacity, the excess
  is dropped on the same tile in the same tick.

---

## 20. Market `capability: market`

### 20.1 Terminal Send
Coverage Notes
- Terminal `send()` behavior is owned by `13.3 Terminal`.
- `Game.market.calcTransactionCost()` is covered under `20.4 Queries`.

### 20.2 Orders
- `MARKET-ORDER-001` `matrix` `verified_vanilla`
  Successful `createOrder()` cases create an order with the requested type,
  resource type, price, amount, and room for the canonical order-creation
  matrix.
- `MARKET-ORDER-002` `matrix` `verified_vanilla`
  `createOrder()` failure codes match the canonical validation matrix for
  invalid arguments, insufficient credits, missing owned terminal, and order
  cap.
- `MARKET-ORDER-003` `behavior` `verified_vanilla`
  A successful `cancelOrder()` returns `OK` and removes the order so it no
  longer appears in market queries.
- `MARKET-ORDER-004` `behavior` `verified_vanilla`
  `cancelOrder()` returns `ERR_INVALID_ARGS` when the order is not one of the
  caller's current orders.
- `MARKET-ORDER-005` `behavior` `verified_vanilla`
  `changeOrderPrice()` updates the order price visible to later market queries.
- `MARKET-ORDER-006` `matrix` `verified_vanilla`
  `changeOrderPrice()` failure codes match the canonical validation matrix for
  missing order, invalid price, and insufficient credits for the additional
  fee.
- `MARKET-ORDER-007` `behavior` `verified_vanilla`
  `extendOrder()` increases the remaining amount on an existing order.
- `MARKET-ORDER-008` `matrix` `verified_vanilla`
  `extendOrder()` failure codes match the canonical validation matrix for
  missing order, invalid added amount, and insufficient credits for the
  extension fee.

- `MARKET-ORDER-009` `behavior` `verified_vanilla`
  An order expires and is removed after `MARKET_ORDER_LIFE_TIME` ms of
  wall-clock time with no activity. Engine check uses `Date.now()`, not
  `gameTime` (`global-intents/market.js:507`).

Notes
- Order lifetime and expiry should be specified through observable query
  behavior rather than only by restating MARKET_ORDER_LIFE_TIME.

### 20.3 Deal
- `MARKET-DEAL-001` `behavior` `verified_vanilla`
  A successful `Game.market.deal()` returns `OK` and executes a trade against
  the specified order.
- `MARKET-DEAL-002` `behavior` `verified_vanilla`
  For terminal-based deals, the energy transfer cost is paid by the caller's
  terminal, not the order owner's terminal.
- `MARKET-DEAL-003` `matrix` `verified_vanilla`
  `Game.market.deal()` failure codes match the canonical validation matrix for
  invalid arguments, missing owned terminal, insufficient terminal energy,
  terminal cooldown, insufficient traded resource, insufficient credits, and
  per-tick deal cap.

- `MARKET-DEAL-004` `behavior` `verified_vanilla`
  A partial deal reduces the target order's remaining amount by the traded
  quantity.
- `MARKET-DEAL-005` `behavior` `verified_vanilla`
  A deal that fills the order's remaining amount sets `remainingAmount` to `0`.

Notes
- `deal()` returns `ERR_FULL` when the per-tick cap is exceeded; it is not a
  silent no-op.
- Market fees are owned by order creation, price change, and extension, not by
  `deal()`.

### 20.4 Queries
- `MARKET-QUERY-001` `behavior` `verified_vanilla`
  `Game.market.calcTransactionCost(amount, roomName1, roomName2)` returns
  `ceil(amount * (1 - exp(-distance / 30)))`, where `distance` is the room
  distance between the two rooms.
- `MARKET-QUERY-002` `behavior` `verified_vanilla`
  `Game.market.getAllOrders(filter?)` returns orders matching the supplied
  filter.
- `MARKET-QUERY-003` `behavior` `verified_vanilla`
  `Game.market.getOrderById(id)` returns the specified order or `null` when it
  does not exist.
- `MARKET-QUERY-004` `behavior` `verified_vanilla`
  `Game.market.getHistory(resourceType?)` returns market history for the
  requested resource scope.
- `MARKET-QUERY-005` `behavior` `verified_vanilla`
  Exposed order prices and market credits use public credit units rather than
  the engine's internal milli-credit storage.

---

## 21. Map

### 21.1 Room Queries
- `MAP-ROOM-001` `behavior` `verified_vanilla`
  `Game.map.describeExits(roomName)` returns only exit direction keys with
  adjacent room names as values for a valid room name, or `null` for an
  invalid room name.
- `MAP-ROOM-002` `behavior` `verified_vanilla`
  `Game.map.getRoomLinearDistance(roomA, roomB)` returns the room-grid
  Manhattan distance between the two rooms.
- `MAP-ROOM-003` `behavior` `verified_vanilla`
  `Game.map.getRoomLinearDistance(roomA, roomB, true)` allows distance to wrap
  across opposite world edges before taking the shorter path.
- `MAP-ROOM-004` `matrix` `verified_vanilla`
  `Game.map.getRoomStatus(roomName)` returns the canonical status and timestamp
  mapping for normal, novice, respawn, and closed rooms.
- `MAP-ROOM-005` `behavior` `verified_vanilla`
  `Game.map.getWorldSize()` returns the inclusive count of rooms along the
  longest world-map edge — i.e. `max(maxRx - minRx + 1, maxRy - minRy + 1)`
  over the rooms that exist in the engine.

### 21.2 Route Finding
- `MAP-ROUTE-001` `behavior` `verified_vanilla`
  `Game.map.findRoute(fromRoom, toRoom)` returns an array of `{exit, room}`
  steps for a found route.
- `MAP-ROUTE-002` `behavior` `verified_vanilla`
  `Game.map.findRoute(fromRoom, toRoom)` returns `ERR_NO_PATH` for invalid room
  names or when no route exists.
- `MAP-ROUTE-003` `behavior` `verified_vanilla`
  `Game.map.findRoute(fromRoom, toRoom, {routeCallback})` excludes rooms whose
  callback cost is `Infinity` from routing.
- `MAP-ROUTE-004` `behavior` `verified_vanilla`
  `Game.map.findExit(fromRoom, toRoom)` returns the first route step's exit
  constant for a found route.
- `MAP-ROUTE-005` `behavior` `verified_vanilla`
  `Game.map.findExit(fromRoom, toRoom)` returns `ERR_NO_PATH` when no route
  exists and `ERR_INVALID_ARGS` when the rooms are the same.

### 21.3 Terrain
- `MAP-TERRAIN-001` `behavior` `verified_vanilla`
  `Game.map.getRoomTerrain(roomName)` returns terrain access for visible and
  non-visible rooms alike.
- `MAP-TERRAIN-002` `matrix` `verified_vanilla`
  `terrain.get(x, y)` returns `0`, `TERRAIN_MASK_WALL`, or
  `TERRAIN_MASK_SWAMP` matching the room's actual terrain.
- `MAP-TERRAIN-003` `behavior` `verified_vanilla`
  `terrain.getRawBuffer()` returns a 2500-element buffer whose values match
  `get(x, y)` for all coordinates.

---

## 22. RoomPosition

### 22.1 Construction & Properties
- `ROOMPOS-001` `behavior` `verified_vanilla`
  `new RoomPosition(x, y, roomName)` exposes `x`, `y`, and `roomName`, and
  coordinates are bounded to the inclusive `0..49` range.

Coverage Notes
- Old ROOMPOS-002 ("coordinates limited to 0..49") merged into ROOMPOS-001:
  both describe the constructor's public contract.

### 22.2 Spatial Queries
- `ROOMPOS-SPATIAL-001` `behavior` `verified_vanilla`
  `getRangeTo()` returns Chebyshev distance to a target in the same room.
- `ROOMPOS-SPATIAL-002` `behavior` `verified_vanilla`
  `inRangeTo()` returns `true` when the target is within the specified range.
- `ROOMPOS-SPATIAL-003` `behavior` `verified_vanilla`
  `isNearTo()` returns `true` when the target is within range `1`.
- `ROOMPOS-SPATIAL-004` `behavior` `verified_vanilla`
  `isEqualTo()` returns `true` when the target is on the same tile.
- `ROOMPOS-SPATIAL-005` `matrix` `verified_vanilla`
  `getDirectionTo()` returns the expected Screeps direction constant for the
  canonical direction-offset matrix.
- `ROOMPOS-SPATIAL-006` `behavior` `verified_vanilla`
  `getRangeTo()` returns `Infinity` for a target in another room.

### 22.3 Find Helpers
- `ROOMPOS-FIND-001` `behavior` `verified_vanilla`
  `findClosestByPath()` returns a target already on the same tile before
  considering other targets.
- `ROOMPOS-FIND-002` `behavior` `verified_vanilla`
  `findClosestByPath()` ignores unreachable targets.
- `ROOMPOS-FIND-003` `behavior` `verified_vanilla`
  `findClosestByRange()` returns the target with the smallest linear range.
- `ROOMPOS-FIND-004` `behavior` `verified_vanilla`
  `findInRange()` returns all matching objects within the given range.
- `ROOMPOS-FIND-005` `behavior` `verified_vanilla`
  `findPathTo()` returns a path from this position to the target.
- `ROOMPOS-FIND-006` `behavior` `verified_vanilla`
  `opts.filter` applies to the candidate set for the RoomPosition find helper
  methods that accept it.
- `ROOMPOS-FIND-007` `behavior` `verified_vanilla`
  `findClosestByPath()` returns `null` when no reachable target exists.
- `ROOMPOS-FIND-008` `behavior` `verified_vanilla`
  `findClosestByRange()` returns `null` when the candidate set is empty.

### 22.4 Look
- `ROOMPOS-LOOK-001` `behavior` `verified_vanilla`
  `look()` returns an array of `{type, ...}` records for the objects and
  terrain at this position.
- `ROOMPOS-LOOK-002` `behavior` `verified_vanilla`
  `lookFor(type)` returns an array of values for the requested `LOOK_*` type at
  this position.
- `ROOMPOS-LOOK-003` `behavior` `verified_vanilla`
  `lookFor(type)` returns an empty array when no entries of that type exist at
  this position.

### 22.5 Actions
- `ROOMPOS-ACTION-001` `behavior` `verified_vanilla`
  A successful `RoomPosition.createConstructionSite()` returns `OK` and creates
  the construction site at the RoomPosition's coordinates on the next tick.
- `ROOMPOS-ACTION-002` `behavior` `verified_vanilla`
  A successful `RoomPosition.createFlag()` returns the flag name and creates
  the flag at the RoomPosition's coordinates in the same tick.

---

## 23. Store API

### 23.1 Resource Access
- `STORE-ACCESS-001` `behavior` `verified_vanilla`
  `store[RESOURCE_TYPE]` returns the stored amount for that resource, or `0`
  when the store currently holds none of it.
- `STORE-ACCESS-002` `behavior` `verified_vanilla`
  `store.getCapacity(type)`, `store.getUsedCapacity(type)`, and
  `store.getFreeCapacity(type)` return `null` when the store cannot hold that
  resource type.

### 23.2 Open Stores
- `STORE-OPEN-001` `matrix` `verified_vanilla`
  For open stores, all stored resources share one total capacity pool.
- `STORE-OPEN-002` `matrix` `verified_vanilla`
  Open-store capacity constants match the canonical Screeps capacities for
  storage, terminal, container, and factory.
- `STORE-OPEN-003` `matrix` `verified_vanilla`
  For open stores, `getCapacity()`, `getUsedCapacity()`, and
  `getFreeCapacity()` without a resource argument report the shared total,
  shared used amount, and shared remaining capacity.

### 23.3 Single-Resource Stores
- `STORE-SINGLE-001` `matrix` `verified_vanilla`
  Single-resource stores accept only their configured resource type for
  canonical single-store structures, including spawn, extension, tower, and
  link.
- `STORE-SINGLE-002` `matrix` `verified_vanilla`
  Single-store capacity constants match the canonical Screeps capacities for
  spawn, extension by RCL, tower, and link.
- `STORE-SINGLE-003` `matrix` `verified_vanilla`
  For single-resource stores, `getCapacity(type)`, `getUsedCapacity(type)`,
  and `getFreeCapacity(type)` return numeric values for the configured
  resource type.
- `STORE-SINGLE-004` `matrix` `verified_vanilla`
  For single-resource stores, `getCapacity()`, `getUsedCapacity()`, and
  `getFreeCapacity()` without a resource argument return `null`.

### 23.4 Restricted Stores
- `STORE-RESTRICTED-001` `matrix` `verified_vanilla`
  For restricted stores, each allowed resource type has its own capacity
  limit.
- `STORE-RESTRICTED-002` `matrix` `verified_vanilla`
  Restricted-store capacity constants match the canonical Screeps capacities
  for lab, power spawn, and nuker.
- `STORE-RESTRICTED-003` `matrix` `verified_vanilla`
  For restricted stores, `getCapacity(type)`, `getUsedCapacity(type)`, and
  `getFreeCapacity(type)` return numeric values for allowed resource types.
- `STORE-RESTRICTED-004` `matrix` `verified_vanilla`
  For pre-bound restricted stores (nuker, power spawn), `getCapacity(type)`,
  `getUsedCapacity(type)`, and `getFreeCapacity(type)` return `null` for
  disallowed resource types. Labs are excluded from this behavior because
  their mineral slot binds dynamically — see `STORE-BIND-001`/`-002`.
- `STORE-RESTRICTED-005` `matrix` `verified_vanilla`
  For restricted stores, `getCapacity()`, `getUsedCapacity()`, and
  `getFreeCapacity()` without a resource argument return `null`.
- `STORE-BIND-001` `behavior` `verified_vanilla`
  On an unbound lab (no mineral stored), `store.getCapacity(mineralType)`
  returns `LAB_MINERAL_CAPACITY` for any non-energy resource — the mineral
  slot is open until a deposit binds it.
- `STORE-BIND-002` `matrix` `verified_vanilla`
  Once a mineral is stored in a lab, the mineral slot is bound to that type:
  `getCapacity(boundMineral)` returns `LAB_MINERAL_CAPACITY`,
  `getUsedCapacity(boundMineral)` reflects the stored amount, and
  `getCapacity(otherMineral)`, `getUsedCapacity(otherMineral)`, and
  `getFreeCapacity(otherMineral)` return `null`.

### 23.5 Timer Models
- `TIMER-COOLDOWN-001` `behavior` `verified_vanilla`
  For APIs gated by `cooldownTime`, the action becomes available in the same
  tick the exposed cooldown reaches `0`.
- `TIMER-SAFEMODE-001` `behavior` `verified_vanilla`
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
- `INTENT-CREEP-001` `matrix` `verified_vanilla`
  For each method pair listed under `INTENT-CREEP-001` in
  `docs/behavior-matrices.md`, the higher-priority blocking creep intent
  prevents the lower-priority intent from resolving in the same tick.
- `INTENT-CREEP-002` `matrix` `needs_vanilla_verification`
  For creep methods with single-intent overwrite semantics, repeated same-tick
  calls keep only the last intent for that method.
- `INTENT-CREEP-003` `matrix` `needs_vanilla_verification`
  For creep methods that support `cancelOrder(methodName)`, canceling a queued
  same-tick intent prevents that method's intent from resolving.

Coverage Notes
- `move()` and `heal()` compatibility with the blocking creep action priority
  chain should be expressed through concrete same-tick scenarios rather than as
  abstract independence claims.
- Non-blocking action combinations should be captured through concrete
  compatibility scenarios rather than as one umbrella sentence.

### 24.2 Same-Tick Resource Visibility
- `INTENT-RESOURCE-001` `behavior` `verified_vanilla`
  Resources gained by `withdraw()` are not available to other actions by that
  creep until the next tick.
- `INTENT-RESOURCE-002` `behavior` `verified_vanilla`
  `transfer()` removes resources from the sender in the same tick, but the
  recipient does not receive the resources until the next tick.
- `INTENT-RESOURCE-003` `behavior` `verified_vanilla`
  When multiple same-tick actions compete for the same stored resource, each
  action resolves against the creep's tick-start resources.
- `INTENT-RESOURCE-004` `behavior` `verified_vanilla`
  When same-tick capacity conflicts exist between these actions, `withdraw()`
  is preferred over `pickup()` and `pickup()` is preferred over `transfer()`.

### 24.3 Intent Limits
- `INTENT-LIMIT-001` `matrix` `verified_vanilla`
  Per-tick intent caps for market and power-creep management actions match the
  canonical Screeps limit table.
- `INTENT-LIMIT-002` `matrix` `verified_vanilla`
  For each capped intent family, calls beyond the per-tick cap return `OK` but
  do not take effect.

### 24.4 Simultaneous Actions
- `INTENT-SIMULT-001` `behavior` `verified_vanilla`
  `move()`, `rangedMassAttack()`, and `heal()` can all execute in the same
  tick on the same creep.
- `INTENT-SIMULT-002` `behavior` `verified_vanilla`
  `heal()` on a healthy creep returns `OK` and still blocks lower-priority
  actions in the blocking creep action chain.

Coverage Notes
- Same-pipeline exclusions already implied by `24.2 Creep Action Priority`
  should not be duplicated here.

---

## 25. Memory

### 25.1 Main Memory
- `MEMORY-001` `behavior` `verified_vanilla`
  If `RawMemory.set()` is called before the first `Memory` access in a tick,
  the first `Memory` access reflects the new raw memory string.
- `MEMORY-002` `behavior` `verified_vanilla`
  After `Memory` has been accessed in a tick, later `RawMemory.set()` calls do
  not replace the already-parsed `Memory` object for that tick.
- `MEMORY-003` `behavior` `verified_vanilla`
  If `Memory` was parsed or mutated during the tick, it is serialized back to
  `RawMemory` at tick end.
- `MEMORY-004` `behavior` `verified_vanilla`
  `RawMemory.set()` throws when the raw memory string exceeds the `2 MB`
  limit.
- `MEMORY-005` `behavior` `verified_vanilla`
  `RawMemory.set(value)` called after `Memory` was accessed earlier in the
  tick still persists `value` as the new raw memory across the tick
  boundary; on the next tick `Memory` reflects the parsed `value`.
- `MEMORY-006` `behavior` `verified_vanilla`
  `RawMemory.set(value)` followed in the same tick by a `Memory` access and
  a mutation persists the *mutated parsed* object across the tick boundary,
  not `value` verbatim. Vanilla parses `value` on first access, sets
  `RawMemory._parsed = parsed`, and end-of-tick serialization stringifies
  `_parsed` (which carries the post-access mutation), overriding `value`.

### 25.2 RawMemory
- `RAWMEMORY-001` `behavior` `verified_vanilla`
  `RawMemory.set(value)` replaces the raw memory string such that
  `RawMemory.get()` returns the new value on the same tick.
- `RAWMEMORY-002` `matrix` `verified_vanilla`
  Raw memory segment ids, per-segment size limit, and active-segment count
  limits match the canonical memory-segment limits.
- `RAWMEMORY-003` `behavior` `verified_vanilla`
  After `RawMemory.setActiveSegments(ids)`, those segment ids become the active
  `RawMemory.segments` set on the next tick.
- `RAWMEMORY-004` `behavior` `verified_vanilla`
  `RawMemory.segments[id]` exposes the content of currently active segments.
- `RAWMEMORY-005` `behavior` `verified_vanilla`
  Writing to `RawMemory.segments[id]` persists the new content for that
  segment to the next tick.

### 25.3 Foreign Segments
- `RAWMEMORY-FOREIGN-001` `behavior` `verified_vanilla`
  `RawMemory.setActiveForeignSegment(username, id?)` does not replace
  `RawMemory.foreignSegment` in the same tick.
- `RAWMEMORY-FOREIGN-002` `behavior` `verified_vanilla`
  `RawMemory.foreignSegment` exposes `{username, id, data}` when a foreign
  segment is available.
- `RAWMEMORY-FOREIGN-003` `behavior` `verified_vanilla`
  After `RawMemory.setPublicSegments(ids)`, only those segment ids are exposed
  as the player's public segments to foreign-segment readers.
- `RAWMEMORY-FOREIGN-004` `behavior` `verified_vanilla`
  After `RawMemory.setDefaultPublicSegment(id)`, foreign-segment readers
  without an explicit id receive that segment by default.
- `RAWMEMORY-FOREIGN-005` `behavior` `verified_vanilla`
  A foreign-segment request persists across ticks: after `setActiveForeignSegment`,
  subsequent ticks deliver the segment via `RawMemory.foreignSegment` without
  the caller re-invoking `setActiveForeignSegment`.
- `RAWMEMORY-FOREIGN-006` `behavior` `verified_vanilla`
  `setActiveForeignSegment(null)` clears the pending foreign-segment request;
  the next tick's `RawMemory.foreignSegment` is `undefined`.
- `RAWMEMORY-FOREIGN-007` `behavior` `verified_vanilla`
  `setActiveForeignSegment` with an unknown username results in
  `RawMemory.foreignSegment === undefined` on the next tick (no throw, no crash).
- `RAWMEMORY-FOREIGN-008` `behavior` `verified_vanilla`
  Revocation via `setPublicSegments` takes effect on the next foreign read:
  after a target removes a segment id from its public set, the foreign
  reader's `RawMemory.foreignSegment` becomes `undefined`.
- `RAWMEMORY-FOREIGN-009` `behavior` `verified_vanilla`
  `setActiveForeignSegment` with an explicit id that the target has not
  published via `setPublicSegments` yields `RawMemory.foreignSegment === undefined`
  on the next tick.

---

## 26. Object Shape Conformance

### 26.1 Creep Shape
- `SHAPE-CREEP-001` `behavior` `verified_vanilla`
  A live creep's public data-property surface matches the canonical Screeps
  API exactly — no missing and no extra properties.
- `SHAPE-CREEP-002` `behavior` `verified_vanilla`
  A creep's nested sub-objects (`body[n]`, `owner`, `pos`) each expose
  exactly the canonical property set.
- `SHAPE-CREEP-003` `behavior` `verified_vanilla`
  An unboosted body part exposes `hits` and `type`; a boosted body part
  additionally exposes `boost`.

### 26.2 Power Creep Shape
- `SHAPE-POWERCREEP-001` `behavior` `verified_vanilla`
  A spawned power creep's public data-property surface matches the
  canonical Screeps API exactly.

### 26.3 Room & Controller Shape
- `SHAPE-ROOM-001` `behavior` `verified_vanilla`
  A visible room's public data-property surface matches the canonical
  Screeps API exactly.
- `SHAPE-CTRL-001` `behavior` `verified_vanilla`
  An owned room controller's public data-property surface matches the
  canonical Screeps API exactly.
- `SHAPE-CTRL-002` `behavior` `verified_vanilla`
  A controller's `sign` sub-object (when present) exposes exactly
  `datetime`, `text`, `time`, and `username`.
- `SHAPE-CTRL-003` `behavior` `verified_vanilla`
  A controller's `reservation` sub-object (when present) exposes exactly
  `ticksToEnd` and `username`.

### 26.4 Game Globals Shape
- `SHAPE-GAME-001` `behavior` `verified_vanilla`
  The `Game` object's public data-property surface matches the canonical
  Screeps API exactly.
- `SHAPE-GAME-002` `behavior` `verified_vanilla`
  `Game.cpu` exposes exactly `bucket`, `limit`, and `tickLimit`.
- `SHAPE-GAME-003` `behavior` `verified_vanilla`
  `Game.map` exposes exactly `visual`.
- `SHAPE-GAME-004` `behavior` `verified_vanilla`
  `Game.shard` exposes exactly `name`, `ptr`, and `type`.
- `SHAPE-GAME-005` `behavior` `verified_vanilla`
  `Game.gcl` exposes exactly `level`, `progress`, and `progressTotal`.
- `SHAPE-GAME-006` `behavior` `verified_vanilla`
  `Game.gpl` exposes exactly `level`, `progress`, and `progressTotal`.
- `SHAPE-GAME-007` `behavior` `verified_vanilla`
  `Game.market` exposes exactly `credits`, `incomingTransactions`,
  `orders`, and `outgoingTransactions`.

### 26.5 Structure Shapes `matrix`
- `SHAPE-STRUCT-001` `matrix` `verified_vanilla`
  Each player-buildable structure type's public data-property surface
  matches its canonical shape exactly — no missing and no extra
  properties. Each structure type has a per-type canonical shape that
  includes the common base plus type-specific properties.
- `SHAPE-STRUCT-002` `behavior` `verified_vanilla`
  An actively spawning `StructureSpawn`'s `spawning` sub-object exposes
  exactly `directions`, `name`, `needTime`, `remainingTime`, and `spawn`.

### 26.6 NPC Structure Shapes
- `SHAPE-NPC-001` `behavior` `verified_vanilla`
  A keeper lair's public data-property surface matches the canonical
  Screeps API exactly.
- `SHAPE-NPC-002` `behavior` `verified_vanilla`
  An invader core's public data-property surface matches the canonical
  Screeps API exactly.
- `SHAPE-NPC-003` `behavior` `verified_vanilla`
  A power bank's public data-property surface matches the canonical
  Screeps API exactly.
- `SHAPE-NPC-004` `behavior` `verified_vanilla`
  A portal's public data-property surface matches the canonical Screeps
  API exactly.

### 26.7 World Object Shapes
- `SHAPE-SOURCE-001` `behavior` `verified_vanilla`
  A source's public data-property surface matches the canonical Screeps
  API exactly.
- `SHAPE-MINERAL-001` `behavior` `verified_vanilla`
  A mineral's public data-property surface matches the canonical Screeps
  API exactly.
- `SHAPE-DEPOSIT-001` `behavior` `verified_vanilla`
  A deposit's public data-property surface matches the canonical Screeps
  API exactly.
- `SHAPE-SITE-001` `behavior` `verified_vanilla`
  A construction site's public data-property surface matches the
  canonical Screeps API exactly.
- `SHAPE-FLAG-001` `behavior` `verified_vanilla`
  A flag's public data-property surface matches the canonical Screeps
  API exactly.
- `SHAPE-RESOURCE-001` `behavior` `verified_vanilla`
  A dropped resource's public data-property surface matches the
  canonical Screeps API exactly.
- `SHAPE-TOMBSTONE-001` `behavior` `verified_vanilla`
  A tombstone's public data-property surface matches the canonical
  Screeps API exactly.
- `SHAPE-RUIN-001` `behavior` `verified_vanilla`
  A ruin's public data-property surface matches the canonical Screeps
  API exactly.
- `SHAPE-NUKE-001` `behavior` `verified_vanilla`
  An in-flight nuke's public data-property surface matches the canonical
  Screeps API exactly.

### 26.8 Effects Substrate Shape `capability: powerCreeps`
- `SHAPE-EFFECT-001` `behavior` `verified_vanilla`
  Each entry of a RoomObject's `effects` array exposes exactly `effect`,
  `level`, `power`, and `ticksRemaining` — no missing and no extra
  properties. Server-side fields such as `endTime` are not present on the
  runtime view.

Coverage Notes
- "Public data-property surface" means prototype getters and non-function
  own properties, walking the full prototype chain. Methods, constructor,
  and underscore/hash-prefixed internal fields are excluded.
- Canonical shapes are pinned in `src/matrices/object-shapes.ts` and
  verified empirically against vanilla. Running on vanilla catches shape
  drift; running on alternate servers catches surface divergence.
- Store is excluded from shape testing. Its own-property keys are the
  resource types it contains (dynamic, not a fixed shape). Store API
  methods are covered in section 23.
- `controller.reservation` and `controller.sign` are only testable when
  their respective sub-objects are populated (after reserveController /
  signController intents process).
- Body part shape is state-dependent: `boost` only appears on boosted
  parts.

---

## 27. Undocumented API Surface

This section catalogs Screeps API surface that is observable, player-visible,
and depended on by real bots, but is not described on `docs.screeps.com`.
Entries are scoped to observable outcomes only — engine-internal properties
that have no effect on player code are out of scope.

Entries in this section start at `needs_vanilla_verification` by default.
An entry only graduates to `verified_vanilla` after the canonical behavior is
confirmed against vanilla in this repo.

### 27.1 Memory Deserialization Short-Circuit (memhack)

Folklore has long claimed that assigning `RawMemory._parsed` short-circuits
JSON deserialization of raw memory. Diagnostic testing against vanilla shows
the folklore is inverted: `RawMemory._parsed` is an output of first-access
deserialization (a cache), not an input. The real memhack short-circuit
operates on the `Memory` global's property descriptor.

- `UNDOC-MEMHACK-001` `behavior` `verified_vanilla`
  At tick start (before first `Memory` access), the `Memory` property on the
  global object is a configurable accessor with a getter, no setter, and
  `configurable: true`.
- `UNDOC-MEMHACK-002` `behavior` `verified_vanilla`
  A plain assignment `global.Memory = obj` (or `Memory = obj` at global
  scope in non-strict user code) before first Memory access does NOT
  replace the accessor: subsequent `Memory` reads return the JSON-parsed
  raw memory, not the assigned object. (Consequence of the getter-without-
  setter descriptor in `UNDOC-MEMHACK-001`; non-strict assignment to an
  accessor with no setter silently fails.)
- `UNDOC-MEMHACK-003` `behavior` `verified_vanilla`
  `delete global.Memory` followed by `global.Memory = obj` before first
  Memory access in a tick removes the accessor and installs `obj` as a
  plain data property. Subsequent `Memory` reads return `obj` by
  reference, and the raw memory string is not JSON-parsed during that
  tick.
- `UNDOC-MEMHACK-004` `behavior` `verified_vanilla`
  After the first `Memory` access that triggers JSON deserialization,
  `RawMemory._parsed === Memory` holds. The engine populates `_parsed` as
  a side effect of first-access parsing.
- `UNDOC-MEMHACK-005` `behavior` `verified_vanilla`
  Assigning `RawMemory._parsed = obj` before first `Memory` access does
  NOT short-circuit JSON deserialization: the first Memory read still
  returns the parsed raw memory string, not `obj`. (Negative behavior;
  disproves a common folklore claim.)
- `UNDOC-MEMHACK-006` `behavior` `verified_vanilla`
  When `Memory` has been replaced via `delete global.Memory; global.Memory = obj`
  (per `UNDOC-MEMHACK-003`) and `RawMemory._parsed = obj` is set before tick
  end, tick-end auto-serialization persists `JSON.stringify(obj)` to raw
  memory — propagating mutations made to `obj` during the tick even though
  `Memory` was never JSON-parsed from raw.
- `UNDOC-MEMHACK-007` `behavior` `verified_vanilla`
  A first access through `creep.memory` has the same self-replacing
  `Memory` side effect as a direct `Memory` access: a later same-tick
  `RawMemory.set()` does not change what `creep.memory` reads for the
  remainder of the tick, while `RawMemory.get()` reflects the string passed
  to `set()`. Across the tick boundary, that raw string is the source of
  truth: `creep.memory` reflects the parsed `set()` payload and same-tick
  mutations to the stale object do not persist.
- `UNDOC-MEMHACK-008` `behavior` `verified_vanilla`
  A first access through `flag.memory` has the same self-replacing
  `Memory` side effect as a direct `Memory` access: a later same-tick
  `RawMemory.set()` does not change what `flag.memory` reads for the
  remainder of the tick, while `RawMemory.get()` reflects the string passed
  to `set()`. Across the tick boundary, that raw string is the source of
  truth: `flag.memory` reflects the parsed `set()` payload and same-tick
  mutations to the stale object do not persist.
- `UNDOC-MEMHACK-009` `behavior` `verified_vanilla`
  A first access through `room.memory` has the same self-replacing
  `Memory` side effect as a direct `Memory` access: a later same-tick
  `RawMemory.set()` does not change what `room.memory` reads for the
  remainder of the tick, while `RawMemory.get()` reflects the string passed
  to `set()`. Across the tick boundary, that raw string is the source of
  truth: `room.memory` reflects the parsed `set()` payload and same-tick
  mutations to the stale object do not persist.
- `UNDOC-MEMHACK-010` `behavior` `verified_vanilla`
  A first access through `spawn.memory` has the same self-replacing
  `Memory` side effect as a direct `Memory` access: a later same-tick
  `RawMemory.set()` does not change what `spawn.memory` reads for the
  remainder of the tick, while `RawMemory.get()` reflects the string passed
  to `set()`. Across the tick boundary, that raw string is the source of
  truth: `spawn.memory` reflects the parsed `set()` payload and same-tick
  mutations to the stale object do not persist.
- `UNDOC-MEMHACK-011` `behavior` `verified_vanilla`
  After `Memory` has been accessed (populating `RawMemory._parsed`),
  `delete RawMemory._parsed` (or `RawMemory._parsed = undefined`) before
  tick end skips end-of-tick serialization: `RawMemory.get()` on the next
  tick still reflects the previous tick's saved value, and same-tick
  mutations to `Memory` are not persisted. (This is the legitimate
  skip-save memhack pattern; distinct from `UNDOC-MEMHACK-006` which
  *replaces* the saved value.)
- `UNDOC-MEMHACK-012` `behavior` `verified_vanilla`
  After the first `Memory` access in a tick, the `Memory` property
  descriptor is a value descriptor (`value` set, no `get`/`set`) with
  `configurable: true` and `enumerable: true`. The accessor descriptor
  from `UNDOC-MEMHACK-001` redefines itself to a value pointing at the
  parsed object — this self-replace is what pins the in-tick reference
  for `MEMORY-002` and `UNDOC-MEMHACK-007`/`008`/`009`/`010`.

Notes
- The canonical cross-tick memhack pattern is the composition of
  `UNDOC-MEMHACK-003` + `UNDOC-MEMHACK-006` + `UNDOC-GLOBAL-001` (global
  persistence of the cached `obj` across ticks). Each half is separately
  testable and cataloged; the composition is not its own entry.
- Setting `RawMemory._parsed = obj` without also performing the delete+
  assign from `UNDOC-MEMHACK-003` does not skip JSON.parse. See
  `UNDOC-MEMHACK-005`.
- Lazy-parse variants using `Object.defineProperty` getters on `Memory`
  subtrees are a user-space technique built on top of `UNDOC-MEMHACK-003`
  and are not a separate engine contract.

### 27.2 Global / VM Persistence
- `UNDOC-GLOBAL-001` `behavior` `verified_vanilla`
  Top-level assignments to `global.X` persist across ticks within the same
  VM instance and are observable on subsequent ticks as `global.X` or `X`.
- `UNDOC-GLOBAL-002` `behavior` `verified_vanilla`
  `require(name)` returns the same module-exports object reference
  across ticks within a single VM instance. (Observable consequence of the
  engine caching parsed modules so top-level code does not re-execute per
  tick.)

Notes
- VM reset *timing* (when a global reset occurs) is engine-scheduler
  behavior and is not a player-observable contract. It is deliberately out
  of scope for catalog entries.
- `Game.cpu.getHeapStatistics()` is documented API; its use as a
  reset-prediction heuristic is a user-space pattern, not an engine
  contract, and does not belong in this catalog.

### 27.3 Memory Serialization Fidelity
- `UNDOC-MEMJSON-001` `behavior` `verified_vanilla`
  A function value assigned to a `Memory` property is absent from `Memory`
  on the next tick (stripped during serialization).
- `UNDOC-MEMJSON-002` `behavior` `verified_vanilla`
  A property explicitly assigned the value `undefined` on `Memory` is absent
  from `Memory` on the next tick.
- `UNDOC-MEMJSON-003` `behavior` `verified_vanilla`
  A `NaN` value assigned to a `Memory` property reads as `null` on the next
  tick.
- `UNDOC-MEMJSON-004` `behavior` `verified_vanilla`
  An `Infinity` value assigned to a `Memory` property reads as `null` on the
  next tick.
- `UNDOC-MEMJSON-005` `behavior` `verified_vanilla`
  A circular reference introduced into `Memory` during a tick causes tick-end
  serialization to fail; the failure does not crash the player runtime but
  does not persist the unserializable subtree.

Notes
- `UNDOC-MEMJSON-005` was verified against vanilla as a *silent* subtree
  drop — the runtime stays alive and unrelated Memory keys are not
  observed to be affected. The entry asserts absence of the circular
  subtree and runtime liveness; it deliberately does not assert anything
  about "other keys in the same Memory root survive" because the vanilla
  serializer's partial-write behavior has not been fully pinned.

### 27.4 PathFinder CostMatrix Direct Access
- `UNDOC-COSTMATRIX-001` `behavior` `verified_vanilla`
  A `PathFinder.CostMatrix` instance exposes a `_bits` property that is a
  `Uint8Array` of length 2500.
- `UNDOC-COSTMATRIX-002` `behavior` `verified_vanilla`
  `matrix._bits[x * 50 + y]` and `matrix.get(x, y)` return the same value
  for every `(x, y)` in the 50x50 room grid.
- `UNDOC-COSTMATRIX-003` `behavior` `verified_vanilla`
  Writes via `matrix._bits[x * 50 + y] = v` are observable through
  `matrix.get(x, y)` and affect `PathFinder.search` costs identically to
  `matrix.set(x, y, v)`.
- `UNDOC-COSTMATRIX-004` `behavior` `verified_vanilla`
  A `CostMatrix` produced by `CostMatrix.deserialize(matrix.serialize())` has
  `_bits` contents byte-for-byte equal to the source matrix's `_bits`.
  (Distinct from `COSTMATRIX-003`, which only asserts `get(x,y)` round-trips;
  this entry pins the specific `_bits` layout that bots bulk-copy through.)

### 27.5 Creep Memory Accessor
- `UNDOC-CREEPMEM-001` `behavior` `verified_vanilla`
  `creep.memory` reads and writes are aliased to `Memory.creeps[creep.name]`:
  mutations via one path are observable via the other in the same tick.
- `UNDOC-CREEPMEM-002` `behavior` `verified_vanilla`
  Deleting `Memory.creeps[creep.name]` causes subsequent same-tick reads of
  `creep.memory` to return an empty object, and the empty object is written
  back to `Memory.creeps[creep.name]` on next access.

Notes
- Analogous aliasing for `spawn.memory`, `flag.memory`, `room.memory`, and
  `powerCreep.memory` is expected to follow the same contract and should be
  cataloged as sibling entries once `UNDOC-CREEPMEM-001/002` are verified
  against vanilla.

### 27.6 Within-Tick Object Identity

Real bots write ad-hoc underscore-prefixed fields onto game objects
(`room._creepMatrix = ...`, `creep._hasMoveIntent = true`, ...) and read them
back via a subsequent `Game.rooms[name]` / `Game.creeps[name]` / `room.find()`
lookup the same tick. This requires the engine to return reference-identical
objects for the same entity within a tick.

- `UNDOC-IDENTITY-001` `behavior` `verified_vanilla`
  Within a single tick, repeated lookups of the same creep via
  `Game.creeps[name]` return the same object by reference.
- `UNDOC-IDENTITY-002` `behavior` `verified_vanilla`
  Within a single tick, repeated lookups of the same room via
  `Game.rooms[name]` return the same object by reference.
- `UNDOC-IDENTITY-003` `behavior` `verified_vanilla`
  Within a single tick, a structure, source, mineral, or deposit surfaced
  by multiple `Room.find()` / `Game.getObjectById()` calls is returned by
  the same reference.
- `UNDOC-IDENTITY-004` `behavior` `verified_vanilla`
  A property assigned to a game object during a tick
  (`creep.fooBar = 123`) is readable via a later same-tick lookup of the
  same entity, without the engine stripping the assigned property.
- `UNDOC-IDENTITY-005` `behavior` `verified_vanilla`
  Properties assigned to a game object in one tick are NOT present on
  the object returned by a lookup in a subsequent tick (cross-tick object
  discard). (Documents the expected reset so bots know heap-only caches
  reset per tick.)

Notes
- `room.find()`'s own per-tick result caching is covered by `ROOM-FIND-*`
  (if present); this facet is about object-reference identity across lookup
  paths within a tick.

### 27.7 RoomPosition `__packedPos`

Every `RoomPosition` carries a bit-packed numeric `__packedPos` that encodes
`(roomCode, x, y)`. Bots read it for fast room-distance computations and
write it to construct positions cheaply (including from WASM bridges).
Catalog entries pin only the portable invariants — the specific `roomCode`
encoding is engine-internal.

- `UNDOC-PACKEDPOS-001` `behavior` `verified_vanilla`
  Every `RoomPosition` instance has a `__packedPos` property whose value
  is a 32-bit signed integer (may be negative when the room-code upper
  bit is set — bots use `packed >>> 16` for portable upper-half extraction).
- `UNDOC-PACKEDPOS-002` `behavior` `verified_vanilla`
  Two `RoomPosition` instances constructed with the same `(x, y, roomName)`
  have equal `__packedPos` values.
- `UNDOC-PACKEDPOS-003` `behavior` `verified_vanilla`
  `__packedPos` is writable: assigning `p.__packedPos = other.__packedPos`
  (where `other` is a valid `RoomPosition`) makes `p.x`, `p.y`, and
  `p.roomName` equal to `other.x`, `other.y`, `other.roomName`.
- `UNDOC-PACKEDPOS-004` `behavior` `verified_vanilla`
  For any valid `RoomPosition`, extracting `__packedPos >>> 16` yields the
  same value for two positions that share `roomName`, regardless of
  `(x, y)`. (Documents the room-code-in-upper-16-bits layout bots depend
  on for fast same-room / room-distance checks, without pinning the
  encoding's specific integer value.)

### 27.8 SYSTEM_USERNAME Global

- `UNDOC-SYSUSER-001` `behavior` `verified_vanilla`
  `SYSTEM_USERNAME` is defined as a non-empty string constant on the global
  scope (reachable as `SYSTEM_USERNAME` or `global.SYSTEM_USERNAME` from
  user code).
- `UNDOC-SYSUSER-002` `behavior` `needs_vanilla_verification`
  A `Controller.sign` placed by the engine (novice area, respawn area,
  system-reserved rooms) has `sign.username === SYSTEM_USERNAME`.

Coverage Notes
- `UNDOC-SYSUSER-002` is fixture-blocked: the current `RoomSpec` has no
  way to mark a room as a novice-area / respawn-area room so the engine
  auto-places a system-owned sign. Deferring until the fixture gains
  support, or until a different observable invariant (e.g. test reading a
  pre-existing system sign in a real sandbox) is available.

### 27.9 Engine-Written Memory Keys

The engine writes specific underscore-prefixed keys into `creep.memory` as
side effects of documented API calls. Bots read these directly. Presence of
the key is undocumented even though the behavior that produces it
(`moveTo(..., { reusePath: N })`) is documented.

- `UNDOC-MOVECACHE-001` `behavior` `verified_vanilla`
  After `creep.moveTo(target, { reusePath: N })` with `N > 0` produces a
  path, `creep.memory._move` holds an object with keys `path`, `dest`,
  `time`, and `room`.
- `UNDOC-MOVECACHE-002` `behavior` `verified_vanilla`
  `creep.memory._move.path` is a serialized path string accepted by
  `Room.deserializePath` and round-trips via
  `Room.serializePath(Room.deserializePath(path)) === path`.
- `UNDOC-MOVECACHE-003` `behavior` `verified_vanilla`
  Deleting `creep.memory._move` before a subsequent `moveTo` call causes
  that call to recompute the path rather than reuse; the engine writes a
  fresh `_move` object whose `time` equals the current `Game.time`.

### 27.10 Room History Action Log `capability: actionLogCapture`

The room-history action log is the per-object action marker rendered to
Screeps clients and replay/history consumers after successful actions resolve.
It is distinct from `Room.getEventLog()` and from console output: player code
does not read it through the runtime API, but players can observe it through
the room-history/client surface.

Entries in this section own only the normalized, client-visible action-log
artifact. Return codes, state changes, resource deltas, controller effects,
and `Room.getEventLog()` entries remain owned by the action's primary section.

- `ACTIONLOG-CREEP-001` `matrix` `needs_vanilla_verification`
  Successful source-side creep actions render action-log markers on the
  acting creep with the canonical action name and action-specific coordinate
  payload.
- `ACTIONLOG-TARGET-001` `matrix` `needs_vanilla_verification`
  Successful incoming damage and healing actions render target-side
  action-log markers (`attacked` / `healed`) on objects that expose target-side
  action logs, with the source object's coordinates.
- `ACTIONLOG-STRUCT-001` `matrix` `needs_vanilla_verification`
  Successful source-side structure actions render action-log markers on the
  acting structure with the canonical action name and action-specific
  coordinate payload.
- `ACTIONLOG-SAY-001` `behavior` `needs_vanilla_verification`
  A successful `say(message, isPublic)` records a `say` action-log marker on
  the speaking creep containing the message text and public visibility flag
  used by the client/history surface.
- `ACTIONLOG-TICK-001` `behavior` `needs_vanilla_verification`
  Action-log capture is tick-scoped: the room-history/client payload for a
  tick includes action-log markers generated by actions that resolved during
  that tick, and a later tick without a fresh matching action does not retain
  that marker.
- `ACTIONLOG-DEDUP-001` `behavior` `needs_vanilla_verification`
  For a single object in one tick, the rendered action log contains at most
  one marker per action-log type; if engine processing records the same type
  more than once, the later marker's payload is the one exposed.

Coverage Notes
- `Room.getEventLog()` event emission and payloads are owned by section
  `16.6 Event Log` (`ROOM-EVENTLOG-*`). Action-log entries here should not
  duplicate those event-log assertions.
- Runtime visibility of `creep.saying` is owned by section `9.9 Say`
  (`CREEP-SAY-*`). `ACTIONLOG-SAY-001` owns only the rendered action-log
  artifact that backs the client/history surface.
- Optional feature rows such as factory production, power creep powers, and
  power-creep `say()` should be added to the relevant matrices only when the
  framework can express the needed capability combination cleanly.

Framework Notes
- The current adapter contract (`src/adapter.ts`) exposes no normalized way
  to capture room-history/client action-log payloads, so this section is
  gated on `actionLogCapture` and starts at `needs_vanilla_verification`.
- Future tests should assert a normalized rendered payload, not raw engine
  storage. Vanilla stores object `actionLog` objects in room objects/history;
  xxscreeps stores `#actionLog` vectors and renders them for backend clients.
  Those storage shapes are implementation details.
- Action-log tests should remain narrow: trigger one successful action, capture
  the resulting rendered marker, and assert the action name, source/target
  object, coordinates, timing, or privacy field named by the catalog entry.

### 27.11 ID Constructors

Vanilla exposes undocumented game-object constructors that accept an object id,
for example `new Creep(id)`. Bots use this to store ids in `Memory` and
reconstitute game-object views later without routing every read through
`Game.getObjectById`.

- `UNDOC-IDCTOR-001` `matrix` `verified_vanilla`
  Calling `new Constructor(id)` for id-having `RoomObject` classes returns an
  instance of the requested constructor whose id, room, position, and
  representative public fields match the live object for that id.
- `UNDOC-IDCTOR-002` `behavior` `verified_vanilla`
  A creep id stored in `Memory` in one tick can be passed to
  `new Creep(Memory.targetId)` in a later tick, and the constructed view
  exposes live creep overlay fields such as `hits`, `fatigue`, and
  `ticksToLive` with the same values as the live creep object.
- `UNDOC-IDCTOR-003` `behavior` `verified_vanilla`
  `new Creep(structureId)` does not validate that the id belongs to a creep:
  it returns a `Creep` instance view over the structure id, exposing fields
  present on the structure such as `name`, `hits`, and `hitsMax`, while
  creep-only fields such as `fatigue` and `ticksToLive` are `undefined`.
- `UNDOC-IDCTOR-004` `behavior` `verified_vanilla`
  A constructed creep view is a distinct wrapper from the canonical live
  object: ad-hoc property writes are readable on that constructed wrapper only,
  and assignments to primitive overlay fields such as `fatigue` and `hits` are
  ignored rather than mutating the live object.

Coverage Notes
- The constructor matrix covers `Creep`, `Structure`, `ConstructionSite`,
  `Resource`, `Tombstone`, `Ruin`, `Mineral`, and `Source`. `Flag` is excluded
  because flags are id-less by design, and `ObserverSpy` is excluded because it
  is an internal implementation object rather than player API surface.
- Wrong-type id coverage is representative rather than exhaustive; the
  catalog pins vanilla's absence of type validation through `new
  Creep(structureId)`.
- Write behavior is representative for `new Creep(id)`, the motivating
  player-code pattern. Other constructor classes can be cataloged later if
  vanilla demonstrates a distinct observable write rule.

Coverage Notes
- Entries in this section interact with `§25 Memory` and `§24.2 Same-Tick
  Resource Visibility`. When a test could be written either under an
  established section or here, prefer the established section and leave a
  pointer in this section's Notes rather than duplicating.
- Multi-bot evidence for each facet is logged in the bot-corpus survey:
  27.1 (5 bots), 27.4 (2), 27.6 (4), 27.7 (2), 27.8 (2). Facets 27.2,
  27.3, and 27.5 are coverage-completeness entries not surfaced by the
  corpus; they remain in catalog because they describe observable engine
  contracts that parity tests should pin even if no surveyed bot grep'd
  for the symbol.

Framework Notes
- The `simulate()` public API is sufficient for all entries in this section;
  no adapter internals are required. Entries that would require adapter
  internals to assert are out of scope regardless of folklore support.
- Entries asserting absence (e.g. `UNDOC-MEMJSON-001` stripping a function)
  must compare against a control fixture that would have persisted a
  non-stripped value, to distinguish "stripped" from "never written."

---

## 28. Deprecation Notices

Vanilla exposes an engine-internal dedup log helper (`register.deprecated`)
that emits one `console.log` line to the calling player when deprecated APIs
or option shapes are used. The player-observable behavior is the console
emission itself: the deprecated method still returns its normal value, and
no return-code, world state, or intent is altered by the notice.

Entries in this section describe the emission as observable player output
(a line appearing in the player's `console.log` stream for that tick). They
do not assert anything about `register.deprecated` as a symbol — that
helper is an engine internal and is not a catalog target.

General contract for every entry below:
- The triggering call returns its normal gameplay result (same return
  value, same side effects, same intent). The notice is an additional
  observable, not a replacement outcome.
- The emitted log line is a plain string addressed to the calling player's
  console only. It is not broadcast to other players.

### 28.1 `Game.map` Deprecations
- `DEPRECATED-MAP-001` `behavior` `needs_vanilla_verification`
  A call to `Game.map.isRoomAvailable(roomName)` emits a deprecation log
  line to the caller's console naming `Game.map.isRoomAvailable` and
  recommending `Game.map.getRoomStatus`. The method still returns its
  normal boolean result.
- `DEPRECATED-MAP-002` `behavior` `needs_vanilla_verification`
  A call to `Game.map.getTerrainAt(x, y, roomName)` or the object-form
  overload `Game.map.getTerrainAt(pos)` emits a deprecation log line to
  the caller's console naming `Game.map.getTerrainAt` and recommending
  `Game.map.getRoomTerrain`. The method still returns its normal terrain
  string.

### 28.2 Pathfinding Deprecations
- `DEPRECATED-PATH-001` `behavior` `needs_vanilla_verification`
  A call to `PathFinder.use(false)` emits a deprecation log line to the
  caller's console naming `PathFinder.use`. A call to `PathFinder.use(true)`
  does not emit the notice. The toggle still takes effect on subsequent
  pathfinding calls in either case.
- `DEPRECATED-PATH-002` `behavior` `needs_vanilla_verification`
  When the new pathfinder is active (the default), passing a truthy
  `opts.avoid` to any pathfinder-integrated API — `Room.findPath`,
  `RoomPosition.findPathTo`, `Room.findClosestByPath`, or
  `RoomPosition.findClosestByPath` — emits a deprecation log line to the
  caller's console stating that `avoid` cannot be used when
  `PathFinder.use()` is enabled and recommending `costCallback`. The call
  still returns a path (or closest target) computed as if `avoid` had not
  been supplied.
- `DEPRECATED-PATH-003` `behavior` `needs_vanilla_verification`
  When the new pathfinder is active (the default), passing a truthy
  `opts.ignore` to any pathfinder-integrated API — `Room.findPath`,
  `RoomPosition.findPathTo`, `Room.findClosestByPath`, or
  `RoomPosition.findClosestByPath` — emits a deprecation log line to the
  caller's console stating that `ignore` cannot be used when
  `PathFinder.use()` is enabled and recommending `costCallback`. The call
  still returns a path (or closest target) computed as if `ignore` had
  not been supplied.

### 28.3 Spawn Deprecations
- `DEPRECATED-SPAWN-001` `behavior` `needs_vanilla_verification`
  A successful call to `StructureSpawn.renewCreep(target)` where the
  target creep has at least one body part with a non-falsy `boost` field
  emits a deprecation log line to the caller's console stating that
  renewing a boosted creep is deprecated and recommending
  `StructureLab.unboostCreep` before renewing. The renewal still succeeds
  (`OK`) with the boost-removal behavior cataloged in `RENEW-CREEP-004`
  through `RENEW-CREEP-006`.

### 28.4 Emission Dedup
- `DEPRECATED-DEDUP-001` `behavior` `needs_vanilla_verification`
  Within a single tick, identical deprecation messages are emitted at
  most once to the caller's console. Repeated triggering calls in the
  same tick (e.g. two `Game.map.isRoomAvailable` calls, or
  `Room.findPath({avoid})` followed by
  `Room.findClosestByPath({avoid})` which share the same avoid-message
  text) produce exactly one log line. Dedup scope is per-tick per-player:
  the same message is eligible to be logged again on a subsequent tick.

Notes
- `DEPRECATED-PATH-002` and `DEPRECATED-PATH-003` fire only when the new
  pathfinder is the active resolver. Because the new pathfinder is the
  default, the notice fires by default; disabling it via
  `PathFinder.use(false)` (itself deprecated, per `DEPRECATED-PATH-001`)
  suppresses the `avoid`/`ignore` notices.
- `Room.findPath` (called directly, not via `RoomPosition.findPathTo`)
  also mutates the caller's `opts.avoid`/`opts.ignore` to `undefined`
  alongside the notice. This mutation is not mirrored by
  `findClosestByPath`, and the routing wrappers (`findPathTo`,
  `RoomPosition.findClosestByPath`) clone opts before dispatching, so
  the mutation is invisible through those paths. This quirk is adjacent
  to the deprecation but is not a deprecation-notice behavior and is
  left to a dedicated pathfinding-options catalog entry if pinned later.
- The exact deprecation message strings emitted by vanilla are fixed in
  engine source. Catalog entries above reference the message content
  (which API, which replacement) rather than the exact string so that
  engines can match semantically without being forced to byte-match
  vanilla copy.

Coverage Notes
- Non-deprecation behavior of the named APIs is owned by their primary
  sections: `MAP-*` for `Game.map`, `LEGACY-PATH-*` and section 2 for
  pathfinding, and `RENEW-CREEP-*` for `renewCreep`. Section 28 owns
  only the deprecation-notice emission.
- None of these notices are emitted at runtime by `xxscreeps`, so every
  entry in this section is a latent parity gap. Static-surface handling
  in `xxscreeps` is uneven: `Game.map.isRoomAvailable` and
  `Game.map.getTerrainAt` carry a JSDoc `@deprecated` tag;
  `PathFinder.use` is a no-op function with no tag; `opts.avoid` and
  `opts.ignore` are simply unhandled options on `Room.findPath` /
  `findClosestByPath` (neither honored nor flagged); and
  `renewCreep` on a boosted creep hard-rejects with `ERR_NO_BODYPART`
  rather than proceeding with a notice (tracked separately as
  `renew-rejects-boosted-creep` covering `RENEW-CREEP-004`..`006`).
  None of these gaps are wired into
  `docs/xxscreeps-parity-gaps.md` as deprecation-notice entries because
  the framework has no console-capture adapter path (see Framework
  Notes).

Framework Notes
- The current adapter contract (`src/adapter.ts`) exposes no API for
  reading a player's `console.log` output. Asserting these entries
  requires either extending the adapter with a capability-gated
  log-capture method or routing console output through a known side
  channel (e.g. writing to `Memory` from a monkey-patched `console.log`).
  Until that plumbing exists, entries in this section cannot be directly
  asserted and must remain at `needs_vanilla_verification`.
- The catalog rule against console-output inspection in
  `docs/test-authoring.md` concerns using console as a stand-in for
  gameplay state. Deprecation notices are a case where the console
  emission is itself the gameplay-adjacent observable; any future
  verification path should be narrowly scoped to this section rather
  than lifted as a general pattern.
- `Game.notify()` is deliberately excluded from the catalog as a
  side-effect API (see Summary). Deprecation notices are distinct:
  emission is engine-mandated and deterministic given the triggering
  call, not a user-controlled notification.

---

## 29. Multi-Shard

The Screeps shard model has two halves. The first is single-shard observable:
shard identity (`Game.shard.*`), the local half of `InterShardMemory`, the
shape of cross-shard portal destinations, and `Game.cpu.shardLimits` /
`Game.cpu.setShardLimits`. These entries can be asserted on a single-shard
harness and gate on `interShardMemory` or `cpuShardLimits` capabilities.

The second half only manifests with two or more shards in play: cross-shard
creep traversal, `InterShardMemory.getRemote`, per-shard `Memory` and
`RawMemory.segments` isolation, and the post-traversal value of
`PowerCreep.shard`. The current adapter contract creates one isolated world
per test, so these entries are gated on a future `multiShard` capability and
remain `needs_vanilla_verification` until a multi-shard harness lands.

Cross-references:
- Same-shard portal mechanics and the shape of `portal.destination` (both
  same-shard and cross-shard forms) are owned by section 13.6 (`PORTAL-001`
  through `PORTAL-006`).
- The exact public property surface of `Game.shard` is pinned by
  `SHAPE-GAME-004` in section 26.4.

### 29.1 Shard Identity
- `SHARD-IDENT-001` `behavior` `needs_vanilla_verification`
  `Game.shard.name` is a non-empty string for every tick the player code
  runs, on every shard.
- `SHARD-IDENT-002` `behavior` `needs_vanilla_verification`
  `Game.shard.type` is one of the strings `"normal"`, `"ptr"`, `"season"`.
- `SHARD-IDENT-003` `behavior` `needs_vanilla_verification`
  `Game.shard.ptr === true` iff `Game.shard.type === "ptr"`; otherwise
  `Game.shard.ptr === false`.

### 29.2 Inter-Shard Portals `capability: portals`

Cross-reference: the *shape* of an inter-shard portal's `destination`
object (`{shard, room}`, no `x`/`y`) is `PORTAL-003` in section 13.6. The
entries below cover only the cross-shard *consequences* of stepping onto
such a portal — none of which are testable on a single-shard harness.

- `INTERSHARD-PORTAL-001` `behavior` `needs_vanilla_verification` `capability: multiShard`
  A creep standing on an inter-shard portal disappears from the source
  shard on the next tick and re-materializes at `destination.room` on
  `destination.shard`, retaining `name`, `body`, `hits`, and store
  contents.
- `INTERSHARD-PORTAL-002` `behavior` `needs_vanilla_verification` `capability: multiShard`
  A creep migrated by `INTERSHARD-PORTAL-001` retains its
  `Memory.creeps[name]` entry as visible on the destination shard's
  `Memory` (memory crosses with the creep, separate from the per-shard
  `Memory` isolation in 29.5).

### 29.3 InterShardMemory `capability: interShardMemory`
- `ISM-001` `behavior` `needs_vanilla_verification`
  `InterShardMemory.getLocal()` returns `null` on every tick before the
  first successful `setLocal` on the same shard.
- `ISM-002` `behavior` `needs_vanilla_verification`
  After `InterShardMemory.setLocal(s)` with string `s`, a subsequent
  `InterShardMemory.getLocal()` on the same tick returns exactly `s`.
- `ISM-003` `matrix` `needs_vanilla_verification`
  `InterShardMemory.setLocal` argument-type matrix: a `string` value is
  accepted; `number`, `object`, `null`, and `undefined` are rejected. The
  exact rejection mode (TypeError vs. silent no-op) is to be pinned
  during verification.
- `ISM-004` `behavior` `needs_vanilla_verification`
  `InterShardMemory.setLocal(s)` with `s.length > 102400` (100 KiB)
  rejects without updating the local segment; a subsequent `getLocal()`
  returns the prior value (or `null` if none was set).
- `ISM-005` `behavior` `needs_vanilla_verification` `capability: multiShard`
  `InterShardMemory.getRemote(shardName)` returns the string most
  recently passed to `setLocal` on shard `shardName`, or `null` if that
  shard has never set a local value.
- `ISM-006` `behavior` `needs_vanilla_verification` `capability: multiShard`
  `InterShardMemory.getRemote(otherShard)` reflects writes made on
  `otherShard` only after the cross-shard sync interval elapses; the
  exact interval is to be pinned during verification.

### 29.4 CPU Shard Limits `capability: cpuShardLimits`
- `CPU-SHARD-001` `behavior` `needs_vanilla_verification`
  `Game.cpu.shardLimits` is a plain object whose keys are shard names
  (strings) and whose values are non-negative integers.
- `CPU-SHARD-002` `behavior` `needs_vanilla_verification`
  The sum of `Object.values(Game.cpu.shardLimits)` equals the player's
  daily CPU allowance (the cap reported by `Game.cpu.limit` summed
  across all shards).
- `CPU-SHARD-003` `matrix` `needs_vanilla_verification`
  `Game.cpu.setShardLimits(map)` return-code matrix:
  - sum of values equals the daily allowance and every key is a known
    shard name → `OK`
  - sum of values does not equal the daily allowance → `ERR_INVALID_ARGS`
  - any key is not a known shard name → `ERR_INVALID_ARGS`
  - any value is negative or not an integer → `ERR_INVALID_ARGS`
- `CPU-SHARD-004` `behavior` `needs_vanilla_verification`
  A successful `Game.cpu.setShardLimits` call within 12 hours of the
  previous successful call returns `ERR_BUSY` and leaves
  `Game.cpu.shardLimits` unchanged. Wall-clock dependent; deferred until
  the harness exposes a time-skip hook.

### 29.5 Per-Shard Memory Isolation `capability: multiShard`
- `SHARD-MEMORY-001` `behavior` `needs_vanilla_verification` `capability: multiShard`
  `Memory` is per-shard: a write to `Memory.foo` on shard A is not
  visible via `Memory.foo` on shard B on the same or any later tick.
  The cross-shard channel is `InterShardMemory` only.
- `SHARD-MEMORY-002` `behavior` `needs_vanilla_verification` `capability: multiShard`
  `RawMemory.segments` and segments published via
  `RawMemory.setPublicSegments` / readable via
  `RawMemory.setActiveForeignSegment` are scoped to the shard on which
  they were written; foreign-segment reads from another shard return no
  data even when the writing user matches.

### 29.6 PowerCreep Shard Home `capability: powerCreeps`
- `SHARD-PCREEP-001` `behavior` `needs_vanilla_verification`
  An unspawned `PowerCreep` (created via `Game.gpl` allocation but not
  yet spawned at a power spawn) exposes `pc.shard === null`.
- `SHARD-PCREEP-002` `behavior` `needs_vanilla_verification` `capability: multiShard`
  A spawned `PowerCreep` exposes `pc.shard` as the string name of the
  shard where it currently resides; the value updates to the destination
  shard's name after the creep traverses an inter-shard portal.

Coverage Notes
- The shape of `Game.shard` (`{name, type, ptr}`, exact key set) is
  asserted by `SHAPE-GAME-004` in section 26.4. Section 29.1 owns only
  the *value semantics* — that the fields are populated and consistent
  with each other on every tick.
- The shape of `portal.destination` for both same-shard
  (`{room, x, y}` as `RoomPosition`) and cross-shard (`{shard, room}`)
  forms is owned by section 13.6 (`PORTAL-002`, `PORTAL-003`). Section
  29.2 owns only the cross-shard *consequences* of portal traversal.
- `InterShardMemory` operates on JSON strings. Anything richer than a
  string round-trip is the player's responsibility; entries above do not
  assert serialization fidelity beyond the byte-for-byte string contract
  in `ISM-002`.

Framework Notes
- The current adapter contract (`src/adapter.ts`) creates one isolated
  shard world per test. Entries gated on `multiShard` therefore cannot
  be self-verified today and ship as `needs_vanilla_verification` with
  the capability flag `false` on both adapters until a multi-shard
  harness lands. Tracking the harness work and the remaining deferred
  entries is out of scope here; revisit when the work is queued.
- xxscreeps has no `InterShardMemory` module, no
  `Game.cpu.shardLimits` / `setShardLimits`, and no `PowerCreep` class.
  All entries in 29.3, 29.4, and 29.6 ship gated on capabilities the
  xxscreeps adapter currently reports as `false`. See
  `docs/xxscreeps-parity-gaps.md` for the upstream tracking.
- The open-source `@screeps/engine` and `screeps-server-mockup` do not
  ship an `InterShardMemory` module or seed `Game.cpu.shardLimits`
  (the closed-source MMO server provides both). The vanilla adapter
  polyfills the local half of `InterShardMemory` in the player's
  `main` module so the sandbox global is populated before any user
  expression runs; `interShardMemory` is therefore `true` on vanilla
  and 29.3 ISM-001/002/003 run there. `cpuShardLimits` remains `false`
  on both adapters until the analogous shim for `Game.cpu.shardLimits`
  / `setShardLimits` lands.

---

## Summary

Coverage counts are temporarily omitted. The facet and behavior totals need to
be recomputed after the current normalization pass is complete.

### Deliberately excluded (per spec.md non-goals):
- CPU/heap metrics (engine-specific values)
- Seasonal/event-specific scoring
- Server administration (auth, scaling)
- Visual APIs (RoomVisual, MapVisual) — no gameplay effect
- `Game.notify()` — side effect, not gameplay
