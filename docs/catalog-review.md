# Catalog Review Tracking

Section-by-section review of `behaviors.md` for catalog quality (redundancy,
testability, classification, scoping) and test coverage.

---

## Section 1: Movement

### Quality issues
- **MOVE-FATIGUE-006** (old): "Moving onto a road generates fatigue equal to 1
  per weighted body part" — duplicate of `ROAD-FATIGUE-001` in section 1.3.
  Dropped.
- **MOVE-FATIGUE-007/008/009** (old): Three separate entries for ZO/ZHO2/XZHO2
  fatigue reduction — collapsed into one matrix entry (`MOVE-FATIGUE-006`).
  Concrete fatigue outcomes complement `BOOST-MOVE-001` (section 8.12), which
  validates magnitude constants. Verified by reading both entries side-by-side.
- **ROAD-FATIGUE-003**: "Creep movement wears road by ROAD_WEAROUT per body
  part" — duplicate of `ROAD-WEAR-001` (section 13.2), which covers both creep
  and power creep wear as a matrix. Dropped.
- **ROAD-FATIGUE-004**: "Power creep road wear at ROAD_WEAROUT_POWER_CREEP" —
  also covered by `ROAD-WEAR-001`. Dropped.
- **ROAD-FATIGUE-005**: "Swamp roads have 5x construction cost" — construction
  cost, not movement. Owned by `CONSTRUCTION-COST-001` (section 15.3). Dropped.
- **ROOM-TRANSITION-005** (old): "Room adjacency follows standard coordinate
  system" — not a testable behavior; topology is covered by `MAP-ROOM-*`
  (section 21). Dropped. Remaining entries renumbered.
- **MOVE-POWER-001/002** (old): "No fatigue" and "road wear" — identical to
  `POWERCREEP-MOVE-001` and `POWERCREEP-MOVE-002` (section 19.2). Verified by
  reading both entries. Dropped. Remaining entry renumbered to `MOVE-POWER-001`.

### Changes applied
- Dropped 7 entries, collapsed 3→1 (net -9 entries, 47→38).
- Added Coverage Notes to sections 1.3, 1.4, and 1.7 explaining ownership.
- Renumbered MOVE-FATIGUE (old 010→007), ROOM-TRANSITION (old 006→005),
  MOVE-POWER (old 003→001).

### Test coverage (after 2026-04-09 implementation pass)

| Facet | Tested | Total | Untested IDs |
|---|---|---|---|
| 1.1 Basic Movement | 12 | 12 | — |
| 1.2 Fatigue Calculation | 7 | 7 | — |
| 1.3 Roads | 2 | 2 | — |
| 1.4 Room Transitions | 3 | 4 | ROOM-TRANSITION-004 (cross-room pull) |
| 1.5 Pulling | 6 | 6 | — |
| 1.6 Collision Resolution | 5 | 5 | — |
| 1.7 Power Creep Movement | 1 | 1 | — |

**36/37 tested (97%)**

### Implementation details and findings

Catalog edits applied during implementation:

- **`ROOM-TRANSITION-003`** ("fatigue resets on exit tile") promoted from
  `needs_vanilla_verification` to `verified_vanilla`. Vanilla source
  `@screeps/engine/src/processor/intents/movement.js:242-251` has the
  exact reset rule. The new test (`tests/01-movement/1.4-room-transitions.test.ts`)
  passes on vanilla after fixing a setup bug — see findings below.
- **`ROOM-TRANSITION-004` (old, "creep.room lag")** dropped. Vanilla
  source `engine/src/game/rooms.js:1648` `RoomObject` constructor sets
  `this.room` and `this.pos` from the same data field with no lag
  mechanism. The previously written test confirmed `creep.room.name`
  matches the new room immediately after crossing. The old slot was
  reused for the cross-room pull entry.
- **`ROOM-TRANSITION-004` (new, ex-005, "cross-room pull")** retained
  but left untested with a Coverage Note. A naive setup with the puller
  on an exit tile and both creeps issuing intents in the same tick fails
  on vanilla (pulled creep stays put) because pull state lives in
  per-room `roomObjects`. The catalog rule may still be reachable via a
  different same-tick choreography we have not exhausted.

Test setup gotchas discovered (worth remembering for future sections):

- **`FIND_EXIT_LEFT[0]` returns the corner tile `(0, 0)` in vanilla
  rooms.** The fatigue-reset rule `isAtEdge(move) && !isAtEdge(object)`
  requires the source tile to be NOT at edge. A creep placed at
  `(exitX+1, exitY)` where `exitY === 0` is itself at-edge, so the
  reset never fires. Filter exits to `y > 5 && y < 44` (or pick a
  middle index) before placing the creep. This was a silent test bug:
  the original buggy ROOM-TRANSITION-003 happened not to run on
  xxscreeps (entire file is gated on `interRoomTransition` limitation),
  so only vanilla revealed it.
- **Vanilla damages body parts in body order from index 0** (per
  `engine/src/processor/intents/creeps/_recalculateBody.js`-style logic
  in xxscreeps which mirrors vanilla). 10 RANGED_ATTACK parts deal
  exactly 100 damage at range 1, which kills the front body part
  outright — useful for `MOVE-FATIGUE-007` (damaged MOVE no longer
  reduces fatigue).
- **`shard.runPlayer()` advances exactly 1 tick.** Don't add an
  intermediate `await shard.tick()` between `placeCreep` and the test
  action unless you actually need an extra tick — every tick is
  observable and changes the assertion baseline.

### Framework finding: vanilla terrain pathfinder cache (`vanillaTerrainPathfinder`)

While implementing `MOVE-BASIC-010` I uncovered a real vanilla-adapter
bug:

- `@screeps/driver/lib/runtime/make.js:18-51` (the `engine_runner`
  process, NOT `engine_processor`) lazily loads terrain into a
  module-level `staticTerrainData` variable on the first user-code
  invocation, then early-returns on every subsequent call.
- The runner is a long-lived child process shared across tests in our
  vanilla adapter (singleton `ScreepsServer`), so terrain set by
  `RoomSpec.terrain` after the first runPlayer is invisible to player
  code that reads terrain via `Room.getTerrain()`,
  `PathFinder.search()`, `RoomPosition.findPathTo()`, or any
  `creep.moveTo()` that triggers pathfinding.
- The engine processor still respects the wall (creeps cannot
  physically step on it — that is why `MOVE-BASIC-002` accidentally
  passes), so this only affects tests that observe terrain through the
  player API.

Captured by a contract test:
`tests/00-adapter-contract/setup.test.ts → 'terrain spec is honored
end-to-end (room.getTerrain and PathFinder)'`. The test fails on
vanilla without a fix and passes on xxscreeps. It is currently gated
behind a new `vanillaTerrainPathfinder` documented limitation
(`src/limitations.ts`) so the suite stays green.

`MOVE-BASIC-010` is gated on the same limitation. The catalog claim
("`moveTo()` returns `ERR_NO_PATH` when no path exists") is
source-verified via vanilla `engine/src/game/creeps.js:294` —
`if(path.length == 0) return C.ERR_NO_PATH;` — so confidence in the
catalog rule is high even though the test currently runs only on
xxscreeps.

A real fix would need to invalidate the runner-side
`staticTerrainData` cache. There is no existing public API; options
explored and discarded:

1. `RUNTIME_RESTART` pubsub clears user VMs but not the make.js cache.
2. Killing both engine processes and calling `server.start()` worked
   for the contract test but broke every subsequent runPlayer with
   15s vitest timeouts (queue pubsub state corruption). Not viable
   without deeper synchronization.
3. Killing only the runner is theoretically more targeted but we did
   not validate it under load before stopping the dive.

Left as a follow-up.

### Section 1 cumulative result

- 16 new tests added (MOVE-BASIC-005..012, MOVE-FATIGUE-005..007 family,
  ROAD-FATIGUE-002, ROOM-TRANSITION-003, MOVE-PULL-005..006, MOVE-POWER-001,
  plus the contract test).
- 1 catalog entry dropped (ROOM-TRANSITION-004 creep.room lag).
- 1 catalog entry promoted to `verified_vanilla` (ROOM-TRANSITION-003).
- 1 catalog entry left untested with rationale (ROOM-TRANSITION-004
  cross-room pull, ex-005).
- 1 framework limitation added (`vanillaTerrainPathfinder`).
- 1 contract test added that captures the framework bug (currently
  skipped on vanilla via the limitation).
- 1 unrelated baseline fix: `src/matrices/*.ts` had import paths
  `'../../../src/index.js'` left over from a prior move out of
  `tests/support/matrices/`. They now resolve to `'../index.js'`.
  Without this fix, 31 test files failed to load and the rest of
  section 1 could not be exercised at all.

Final adapter results for `tests/01-movement/`:

- xxscreeps: 39 passed, 7 skipped (capability gates), 0 failures
- vanilla: 45 passed, 1 skipped (`MOVE-BASIC-010` via
  `vanillaTerrainPathfinder`), 0 failures

---

## Section 2: Pathfinding

### Quality issues
- **ROOMPOS-001 through ROOMPOS-006** (section 2.3): All six entries duplicate
  section 22 entries — `ROOMPOS-FIND-001` through `ROOMPOS-FIND-006` (22.3)
  and `ROOMPOS-SPATIAL-005` (22.2). Verified by reading both entries
  side-by-side: each pair describes the same observable outcome. Additionally,
  `ROOMPOS-001` collides with section 22.1's `ROOMPOS-001` (constructor).
  Dropped all six.
- **PATHFINDER-001, 002, 003 and COSTMATRIX-001, 002, 003**: Pre-existing
  entries missing `behavior` `verified_vanilla` tags. Added.
- Entries within 2.1 and 2.2 were listed out of numerical order (old entries
  interleaved with new). Reordered sequentially.

### Changes applied
- Dropped 6 entries (section 2.3 removed entirely), 24→18.
- Renumbered section 2.4 Legacy Pathfinding → 2.3.
- Added `behavior` `verified_vanilla` tags to 6 pre-existing entries.
- Added Coverage Notes explaining section 22 ownership.
- Reordered entries within 2.1 and 2.2 to be numerically sequential.

### Test coverage

| Facet | Tested | Total | Untested IDs |
|---|---|---|---|
| 2.1 PathFinder.search | 10 | 10 | — |
| 2.2 CostMatrix | 5 | 5 | — |
| 2.3 Legacy Pathfinding | 3 | 3 | — |

**18/18 tested (100%)**

### Implementation details and findings

- 12 new tests added: PATHFINDER-004 through 010, COSTMATRIX-004, 005,
  LEGACY-PATH-001, 002, 003.
- Split the facets into clean files: `2.1-pathfinder.test.ts` (PATHFINDER
  only), new `2.2-costmatrix.test.ts` (moved COSTMATRIX-001/002/003 out of
  2.1), new `2.3-legacy-path.test.ts`.

**Test setup gotchas worth remembering:**

- `plainCost` / `swampCost` apply to *terrain* costs, not `CostMatrix`
  overrides. Testing them requires the path to go through known plains or
  swamp tiles. The robust pattern: probe terrain inside player code via
  `Game.map.getRoomTerrain`, then force the path through those tiles with
  a `CostMatrix` where everything *off the test corridor* is 255 and the
  corridor tiles stay at 0 (which means "use terrain default" per
  `COSTMATRIX-004`). This avoids any dependency on custom terrain setup
  and works on both adapters that expose swamp in default rooms.
- `PathFinder.search` with an unbounded `maxRooms` will probe neighbor
  rooms when the current room is exhausted. In a test world that only
  created one room, vanilla fails hard with `Could not load terrain
  data`. Always set `maxRooms: 1` when the test is intended to exercise
  single-room behavior.
- Player code is `eval()`ed inside the engine loop, so a top-level
  `return` statement is a syntax error. Wrap any early-exit logic in an
  `(() => { ... })()` IIFE so `return` is legal.
- xxscreeps does not expose the `Room` class as a global constructor to
  user code the way vanilla does. Use `room.constructor.serializePath`
  and `room.constructor.deserializePath` to access the static helpers
  portably across both adapters.

**Framework findings + new limitations:**

- `vanillaTerrainPathfinder` (pre-existing limitation) also blocks
  two additional scenarios beyond stale custom terrain:
  1. **Swamp tiles are not present in the vanilla runner's cached
     default terrain** — every default room in
     `screeps-server-mockup` is generated as all plains, so the probe
     for a swamp corridor used by PATHFINDER-006 finds nothing on
     vanilla. Gated.
  2. **Cross-room PathFinder.search** — the runner terrain cache only
     has entries for rooms loaded on the first `runPlayer` call.
     Adjacent rooms added to the shard after that are invisible to
     the pathfinder, which fails with `Could not load terrain data`
     when the search expands into them. Gated.
- New limitation `xxscreepsPathFinderUseMissing` added for
  LEGACY-PATH-003: xxscreeps itself exposes `PathFinder.use` as a
  no-op (`xxscreeps/dist/game/path-finder/index.js:78`), but the
  screeps-ok xxscreeps adapter's synthetic
  `PathFinder = { search, CostMatrix }` wrapper at
  `adapters/xxscreeps/index.ts:19` omits the `use` property. Adding
  `use: () => {}` to that synthetic wrapper would make LEGACY-PATH-003
  runnable on xxscreeps — flagged for follow-up.

**xxscreeps parity gap updates:**

- Added PATHFINDER-004 to the existing `pathfinder-suboptimal` parity
  gap. xxscreeps's native pathfinder picks the far goal in a multi-goal
  query even when the near goal is reachable and closer — same family
  as the existing single-goal suboptimality bug.

### Section 2 cumulative result

- 12 new tests added, 3 pre-existing tests moved from 2.1 into 2.2.
- 1 new limitation added (`xxscreepsPathFinderUseMissing`).
- 1 xxscreeps parity gap extended (`pathfinder-suboptimal` now covers
  PATHFINDER-004 as well).

Final adapter results for `tests/02-pathfinding/` (excluding the
out-of-scope `Game.map` block still colocated in 2.1-pathfinder.test.ts):

- vanilla: PATHFINDER-001..010, COSTMATRIX-001..005, LEGACY-PATH-001..003
  — 16 passed, 2 skipped (PATHFINDER-006 and 008 via
  `vanillaTerrainPathfinder`).
- xxscreeps: PATHFINDER-002..010, COSTMATRIX-001..005, LEGACY-PATH-001
  and 002 — 15 passed, 1 skipped (LEGACY-PATH-003 via
  `xxscreepsPathFinderUseMissing`), 2 expected-failure
  (PATHFINDER-001, 004 via `pathfinder-suboptimal`).

---

## Section 3: Harvesting

### Quality issues
- **HARVEST-009**: "Harvest boost (UO) increases yield by +200% per boosted
  WORK part" — one row of `BOOST-HARVEST-001` matrix (section 8.8), which
  validates all three harvest boost compounds (UO/UHO2/XUHO2). Read both
  entries side-by-side: the concrete magnitude is a subset of the matrix.
  Dropped.
- **HARVEST-010**: "Source energy capacity is 3000 in owned/reserved rooms,
  1500 in neutral, 4000 in keeper rooms" — same observable outcome as
  `SOURCE-REGEN-001` matrix (section 17.1), which validates source capacity
  against the canonical room-state mapping. Dropped.
- **HARVEST-MINERAL-006**: "Mineral depletion (mineralAmount reaches 0)
  triggers a regeneration timer" — same observable outcome as
  `MINERAL-REGEN-004` (section 17.3), which tests that a depleted mineral
  exposes `ticksToRegeneration`. Dropped.
- **HARVEST-001 through 006**: Pre-existing entries missing `behavior`
  `verified_vanilla` tags. Added.

### Changes applied
- Dropped 3 entries (HARVEST-009, HARVEST-010, HARVEST-MINERAL-006), 21→18.
- Added `behavior` `verified_vanilla` tags to 6 pre-existing entries.
- Reordered entries within 3.1 to be numerically sequential.
- Added Coverage Notes to 3.1 and 3.2 explaining ownership.

### Test coverage

| Facet | Tested | Total | Untested IDs |
|---|---|---|---|
| 3.1 Source Harvest | 8 | 8 | — |
| 3.2 Mineral Harvest | 5 | 5 | — |
| 3.3 Deposit Harvest | 5 | 5 | — (all capability-gated) |

**18/18 tested (100%)**

Section 3.3 is written against the vanilla engine spec (formulas in
`node_modules/@screeps/engine/src/game/deposits.js`), capability-gated on
`deposit`, and currently skipped on both built-in adapters (`vanilla` and
`xxscreeps` both report `deposit: false`). Tests activate as soon as any
adapter lights up the `deposit` capability.

Implementation notes:
- `HARVEST-007` adds the adjacency boundary (diagonal OK, orthogonal
  distance 2 fails) — complements `HARVEST-002`'s far-distance case.
- `HARVEST-008` isolates the OK return-code contract from the yield-amount
  assertions in `HARVEST-001`.
- `HARVEST-MINERAL-005` uses two rooms (one mineral per room), because both
  adapters enforce the real-game rule that a room holds exactly one mineral;
  placing two in one room silently keeps only one.
- The `extractor-cooldown-off-by-one` parity gap
  (`HARVEST-MINERAL-003` / `EXTRACTOR-001`) is a pre-existing registered
  xxscreeps divergence, unaffected by this section's additions.

---

## Section 4: Resource Transfer

### Quality issues
- No duplicates or cross-section overlaps found initially. Checked WITHDRAW-008
  (PWR_DISRUPT_TERMINAL) against section 19, TRANSFER-008 (lab resource
  validation) against section 11.
- **DROP-DECAY-003** ("Dropped resources are created when a creep dies with
  store contents") — **duplicate of `CREEP-DEATH-007`** (section 9.7), which
  owns the canonical behavior "when a tombstone decays, remaining stored
  resources become dropped resources on the same tile". Engine `_die.js`
  does not create dropped resources on death; it creates a tombstone whose
  decay path (`tombstones/tick.js`) emits the drops via `_create-energy`.
  Dropped during section-4 implementation.
- **TRANSFER-001 through 004, WITHDRAW-001 through 004, PICKUP-001,
  DROP-001, DROP-002**: Pre-existing entries missing `behavior`
  `verified_vanilla` tags. Added.

### Changes applied
- Dropped 1 entry (DROP-DECAY-003), 29 → 28.
- Added `behavior` `verified_vanilla` tags to 11 pre-existing entries.
- Reordered entries within 4.1, 4.2 to be numerically sequential.

### Test coverage

| Facet | Tested | Total | Untested IDs |
|---|---|---|---|
| 4.1 Transfer | 8 | 8 | — |
| 4.2 Withdraw | 8 | 8 | — |
| 4.3 Pickup | 4 | 4 | — |
| 4.4 Drop | 4 | 4 | — |
| 4.5 Dropped Resources | 4 | 4 | — |

**28/28 tested (100%)**

Implementation notes:
- New xxscreeps parity gaps registered:
  - `transfer-wrong-resource-err-full` — `TRANSFER-007`/`TRANSFER-008`:
    xxscreeps `checkTransfer` returns `ERR_FULL` via `checkHasCapacity`
    before reaching the vanilla-engine `capacityForResource` dispatch that
    would return `ERR_INVALID_TARGET`.
  - `withdraw-enemy-rampart-no-protection` — `WITHDRAW-005`: xxscreeps
    `checkWithdraw` does not enforce `ERR_NOT_OWNER` for hostile structures
    under a non-public enemy rampart (no rampart check in the chain).
- `WITHDRAW-005` and `DROP-DECAY-005` require multi-player; both run on
  vanilla and xxscreeps (WITHDRAW-005 hits a parity gap on xxscreeps,
  DROP-DECAY-005 passes everywhere).
- `WITHDRAW-008` gated on `powerCreeps` capability; both adapters currently
  support power creeps so the test runs when the capability check passes.
  The test drives a real `PWR_DISRUPT_TERMINAL` cast via a placed power
  creep rather than stubbing the effect.
- Vanilla adapter bug fix: `placeDroppedResource` was storing a redundant
  `amount` field that never got updated by the engine (the engine's
  `.amount` getter reads from `obj[resourceType]`). `snapshotDroppedResource`
  was reading the stale `amount` first. Both fixed to read the canonical
  `obj[resourceType]` path.

---

## Section 5: Construction & Repair

### Quality issues
- **BUILD-009** (old): "Build boost (LH/LH2O/XLH2O) increases effectiveness
  without extra energy cost" — covered by `BOOST-BUILD-001` (magnitudes) and
  `BOOST-BUILD-003` (no extra cost) in section 8.9. Read both entries
  side-by-side. Dropped.
- **REPAIR-008** (old): "Repair boost (LH/LH2O/XLH2O) increases effectiveness
  without extra energy cost" — same compounds and section 8.9 entries cover
  repair explicitly ("Build and repair boost"). Dropped.
- **DISMANTLE-005** (old): "Dismantle boost (ZH/ZH2O/XZH2O) increases
  effectiveness" — covered by `BOOST-DISMANTLE-001` (section 8.10). Dropped.
- **DISMANTLE-006** (old): "dismantle() is blocked in safe mode rooms against
  hostile structures" — same observable outcome as `SAFEMODE-COMBAT-003`
  (section 7.16): "Hostile creeps cannot dismantle() in a safe mode room."
  Dropped.
- **BUILD-001 through 004, REPAIR-001 through 003, DISMANTLE-001 through 003,
  CONSTRUCTION-SITE-001**: Pre-existing entries missing tags. Added.

### Changes applied
- Dropped 4 entries (BUILD-009, REPAIR-008, DISMANTLE-005, DISMANTLE-006),
  34→30.
- Renumbered: BUILD-010→009, REPAIR-009→008, DISMANTLE-007→005.
- Added `behavior` `verified_vanilla` tags to 11 pre-existing entries.
- Reordered entries within each facet to be numerically sequential.
- Added Coverage Notes to 5.1, 5.2, 5.3 explaining ownership.

### Test coverage

| Facet | Tested | Total | Untested IDs |
|---|---|---|---|
| 5.1 Build | 9 | 9 | — |
| 5.2 Repair | 8 | 8 | — |
| 5.3 Dismantle | 5 | 5 | — |
| 5.4 Construction Sites | 8 | 8 | — |

**30/30 tested (100%)**

Notes:
- DISMANTLE-004: catalog wording corrected. Original claim was "dismantle()
  bypasses rampart protection — it damages the target structure directly",
  which contradicts engine `dismantle.js:33-36` (the same rampart redirect
  attack uses). Rewrote to: "damage is redirected to a rampart on the
  target tile". xxscreeps fails this and is grouped under the existing
  `rampart-no-protection` parity gap.
- CONSTRUCTION-SITE-008: test exists but is doubly-gated. Vanilla caches
  `staticTerrainData` at runner startup (driver/runtime/make.js:18-51) so
  the player-side wall check ignores custom DB terrain. xxscreeps has
  terrain capability false. The test will become runnable on vanilla once
  the driver cache exposes an invalidation API.

---

## Section 6: Controller

### Quality issues
- **CTRL-UPGRADE-007** (old): "Upgrade boost (GH/GH2O/XGH2O) increases
  effectiveness without extra energy cost" — covered by
  `BOOST-UPGRADE-001` (magnitudes) and `BOOST-UPGRADE-003` (no extra cost)
  in section 8.11. Read both entries side-by-side. Dropped.
- **CTRL-DOWNGRADE-007** (old): "Structures above the new RCL limit become
  inactive (isActive() returns false)" — same observable outcome as
  `CTRL-STRUCTLIMIT-002` (section 6.10): "Owned structures above the room's
  current controller-level limit remain present but inactive." Dropped.
- **CTRL-UPGRADE-008** (old, now 007): Reclassified `behavior`→`matrix` — it
  is a table of 7 level-to-progress-threshold mappings.
- **CTRL-SAFEMODE-006 vs SAFEMODE-COMBAT-001/002/003**: Overlap noted.
  CTRL-SAFEMODE-006 is tested; SAFEMODE-COMBAT entries are untested. Will
  resolve from section 7 review.
- **CTRL-CLAIM-001, CTRL-RESERVE-001, CTRL-ATTACK-001, CTRL-UPGRADE-001
  through 004, CTRL-SIGN-001**: Pre-existing entries missing tags. Added.

### Changes applied
- Dropped 2 entries (CTRL-UPGRADE-007, CTRL-DOWNGRADE-007), 54→52.
- Renumbered: CTRL-UPGRADE 008→007, 009→008, 010→009, 011→010;
  CTRL-DOWNGRADE 008→007.
- Reclassified CTRL-UPGRADE-007 (new) from `behavior` to `matrix`.
- Added `behavior` `verified_vanilla` tags to 8 pre-existing entries.
- Reordered entries within each facet to be numerically sequential.
- Added Coverage Notes to 6.4 and 6.7 explaining ownership.
- **Section 6 coverage sweep:** rewrote CTRL-ATTACK-005 to match engine
  reality (attack on own controller is permitted and applies the same
  downgrade + upgradeBlocked effects — original "cannot attack own
  controller" claim contradicted both client and processor). Rewrote
  CTRL-UPGRADE-009 to the correct `ERR_INVALID_TARGET` return code (catalog
  had `ERR_BUSY`). Rewrote CTRL-DOWNGRADE-006 to capture the engine's
  actual progress behavior on non-terminal downgrades (adds
  `round(CONTROLLER_LEVELS[N-1] * 0.9)` instead of resetting to 0; the
  reset-to-0 outcome only applies at level 1 → 0). Dropped former
  CTRL-UNCLAIM-002 and CTRL-UNCLAIM-003 ("structures destroyed" /
  "ruins created") — both contradicted the engine's `unclaim` processor,
  which only rewrites controller fields and leaves room objects intact.
  Added a Coverage Note pointing CTRL-UNCLAIM-001 at CTRL-STRUCTLIMIT-002
  for the inactive-above-RCL-limit outcome.
- **New limitation:** `playerGclControl` — both built-in adapters hardcode
  a high GCL at user creation, so CTRL-CLAIM-005 (GCL cap exceeded) cannot
  be produced honestly; gated on this limitation.

### Test coverage

| Facet | Tested | Total | Untested IDs |
|---|---|---|---|
| 6.1 Claim Controller | 5 | 6 | CTRL-CLAIM-005 (limitation: `playerGclControl`) |
| 6.2 Reserve Controller | 5 | 5 | — |
| 6.3 Attack Controller | 5 | 5 | — |
| 6.4 Upgrade Controller | 10 | 10 | — |
| 6.5 Sign Controller | 3 | 3 | — |
| 6.6 Generate Safe Mode | 4 | 4 | — |
| 6.7 Downgrade & Level Loss | 7 | 7 | — |
| 6.8 Safe Mode Mechanics | 7 | 7 | — |
| 6.9 Unclaim | 1 | 1 | — (6.9 collapsed to a single entry) |
| 6.10 Structure Limits per RCL | 2 | 2 | — |

**49/50 tested (98%)** — only CTRL-CLAIM-005 remains, and it is blocked
by the `playerGclControl` limitation (no adapter exposes a GCL override).

---

## Section 7: Combat

### Quality issues
- **COMBAT-MELEE-008**: "Attack boost (UH/UH2O/XUH2O) increases damage" —
  covered by `BOOST-ATTACK-001` (section 8.4). Dropped.
- **COMBAT-RANGED-006**: "Ranged attack boost (KO/KHO2/XKHO2) increases
  damage" — covered by `BOOST-RANGED-001` (section 8.5). Dropped.
- **COMBAT-HEAL-004** (old): "Heal boost (LO/LHO2/XLHO2) increases healing" —
  covered by `BOOST-HEAL-001` (section 8.6). Dropped; 005 renumbered to 004.
- **COMBAT-RANGEDHEAL-003** (old): "Same boost multipliers apply as melee
  heal" — covered by `BOOST-HEAL-001` (section 8.6), which covers all HEAL
  part boosts regardless of action. Dropped; 004 renumbered to 003.
- **COMBAT-TOUGH-001 through 005** (section 7.7): All five entries are
  subsumed by `BOOST-TOUGH-001` (magnitudes matrix, section 8.7) and
  `BOOST-TOUGH-002` (self-only scope, section 8.7). COMBAT-TOUGH-005
  (effective HP ~333) is a derived calculation, not an independent observable.
  Entire section dropped; subsequent facets renumbered 7.8→7.7 through
  7.16→7.15.
- **SAFEMODE-COMBAT-001/002/003** (old): Hostile creep action blocking
  (attack, rangedAttack/rangedMassAttack, dismantle) — same observable
  outcomes as `CTRL-SAFEMODE-006` (section 6.8), which is tested. Dropped;
  004/005 renumbered to 001/002.
- **COMBAT-MELEE-001 through 003, COMBAT-RANGED-001/002, COMBAT-HEAL-001,
  COMBAT-RANGEDHEAL-001**: Pre-existing entries missing tags. Added.

### Changes applied
- Dropped 12 entries, 73→61. Section 7.7 removed entirely.
- Renumbered facets 7.8→7.7 through 7.16→7.15.
- Renumbered: COMBAT-HEAL-005→004, COMBAT-RANGEDHEAL-004→003,
  SAFEMODE-COMBAT-004/005→001/002.
- Added `behavior` `verified_vanilla` tags to 7 pre-existing entries.
- Reordered entries within each facet to be numerically sequential.
- Added Coverage Notes to 7.1, 7.2, 7.4, 7.5, 7.6 (existing), and 7.15.

### Test coverage (after 2026-04-11 implementation pass)

| Facet | Tested | Total | Untested IDs |
|---|---|---|---|
| 7.1 Melee Attack | 7 | 7 | — |
| 7.2 Ranged Attack | 5 | 5 | — |
| 7.3 Ranged Mass Attack | 3 | 3 | — |
| 7.4 Heal | 4 | 4 | — |
| 7.5 Ranged Heal | 3 | 3 | — |
| 7.6 Body Part Damage Model | 3 | 3 | — |
| 7.7 Simultaneous Damage & Healing | 5 | 5 | — |
| 7.8 Tower Attack | 4 | 4 | — |
| 7.9 Tower Heal | 3 | 3 | — |
| 7.10 Tower Repair | 3 | 3 | — |
| 7.11 Tower Action Priority | 3 | 3 | — |
| 7.12 Tower Power Effects | 2 | 2 | — |
| 7.13 Nukes — Launch | 7 | 7 | — |
| 7.14 Nukes — Impact | 6 | 6 | — (NUKE-IMPACT-004 dropped) |
| 7.15 Safe Mode — Combat Effects | 2 | 2 | — |

**60/60 tested (100%)** — sections 7.13/7.14 are gated on the `nuke` capability
and skip on the xxscreeps adapter.

### Section 7 coverage sweep (2026-04-11)

Catalog edits applied during implementation:

- **`COMBAT-HEAL-003`** rewrite: catalog claimed "Can target own and allied
  creeps and power creeps". Engine
  `@screeps/engine/src/game/creeps.js:689-693` does a type-only check (Creep
  or PowerCreep) with no ownership restriction. Updated to "accepts any creep
  or power creep regardless of ownership" and verified by healing both a
  friendly and a hostile creep in the same test.
- **`COMBAT-RANGEDHEAL-003`** rewrite: catalog claimed "A creep can rangedHeal
  and rangedAttack in the same tick". Engine
  `@screeps/engine/dist/processor/intents/creeps/intents.js` priorities table
  lists `rangedAttack: ['rangedMassAttack', 'build', 'repair', 'rangedHeal']`,
  meaning rangedHeal suppresses rangedAttack. Updated to document the priority
  rule; the test now asserts the friendly is healed and the enemy is unchanged.
- **`NUKE-LAUNCH-007`** rewrite: catalog claimed `ERR_INVALID_TARGET` for
  out-of-range targets. Engine
  `@screeps/engine/src/game/structures.js:1379-1381` returns
  `ERR_NOT_IN_RANGE`. Catalog and test updated.
- **`NUKE-IMPACT-002`** clarified: ground zero is the centre tile (range 0)
  taking `NUKE_DAMAGE[0]` (10,000,000), not "all of the blast area".
- **`NUKE-IMPACT-003`** clarified: damage in radius 1–2 is `NUKE_DAMAGE[2]`
  (5,000,000); the previous "radius 0–2 is 5,000,000" wording contradicted 002.
- **`NUKE-IMPACT-006`** clarified: the nuke processor's cleanup loop removes
  every dropped resource, construction site, tombstone, and ruin in the entire
  room (not just the blast area). Test asserts cleanup at the room edge with
  the nuke landing at the opposite corner.
- **`NUKE-IMPACT-004` dropped**: "Ramparts absorb nuke damage for structures
  underneath" is the same observable as `RAMPART-PROTECT-008` in section 12.1
  (already covered). Drop with a coverage note in 7.14.

xxscreeps parity gaps registered:

- **`rampart-no-protection`** extended with `COMBAT-MELEE-005` — xxscreeps does
  not redirect creep/structure damage to a same-tile rampart, matching the
  existing gap for `RAMPART-PROTECT-001/002` and `DISMANTLE-004`.

The 7.13/7.14 nuke tests are skipped on xxscreeps via `shard.requires('nuke')`
because xxscreeps has no nuker mod (`adapters/xxscreeps/index.ts:74`).

---

## Section 8: Boosts

### Quality issues
- `BOOST-HARVEST-003`, `BOOST-BUILD-003`, `BOOST-UPGRADE-003`, `BOOST-CARRY-003`:
  Renumbered to `-002` to fill gaps left by prior drops. Test file updated to match.
- No duplicates, no entries to drop or relocate.

### Changes applied
- Renumbered `BOOST-HARVEST-003` → `BOOST-HARVEST-002`
- Renumbered `BOOST-BUILD-003` → `BOOST-BUILD-002`
- Renumbered `BOOST-UPGRADE-003` → `BOOST-UPGRADE-002`
- Renumbered `BOOST-CARRY-003` → `BOOST-CARRY-002`
- Updated test references in `tests/08-boosts/8.4-8.13-boost-magnitudes.test.ts`

### Test coverage
| Facet | Tested | Total | Untested IDs |
|---|---|---|---|
| 8.1 Boost Application | 8 | 8 | — |
| 8.2 Unboost | 3 | 6 | UNBOOST-004, UNBOOST-005, UNBOOST-006 |
| 8.3 Per-Part Boost Aggregation | 1 | 1 | — |
| 8.4 Attack Boosts | 1 | 1 | — |
| 8.5 Ranged Boosts | 1 | 1 | — |
| 8.6 Heal Boosts | 1 | 1 | — |
| 8.7 Tough Boosts | 2 | 2 | — |
| 8.8 Harvest Boosts | 2 | 2 | — |
| 8.9 Build/Repair Boosts | 2 | 2 | — |
| 8.10 Dismantle Boosts | 1 | 1 | — |
| 8.11 Upgrade Boosts | 2 | 2 | — |
| 8.12 Move Boosts | 1 | 1 | — |
| 8.13 Carry Boosts | 2 | 2 | — |

**27/30 tested (90%)**

All untested entries are in 8.2 Unboost (compound return, cooldown, and
ERR_FULL behaviors). All boost magnitude and application facets have full
coverage.

---

## Section 9: Spawning & Creep Lifecycle

### Quality issues
- `CREEP-SUICIDE-003` ("suicide() returns OK on success"): Dropped — redundant
  with `CREEP-SUICIDE-001` which already states "returns OK and removes the
  creep." The test was a strict subset (only checked `rc === OK`).
- Renumbered `CREEP-SUICIDE-004` → `003`, `CREEP-SUICIDE-005` → `004`.

### Changes applied
- Dropped `CREEP-SUICIDE-003` from behaviors.md (within-section redundancy)
- Renumbered remaining suicide entries to fill gap
- Removed redundant test and updated IDs in
  `tests/09-spawning-lifecycle/9.6-9.8-creep-spawning.test.ts`

### Test coverage
| Facet | Tested | Total | Untested IDs |
|---|---|---|---|
| 9.1 spawnCreep | 11 | 11 | — |
| 9.2 Spawning Duration & Direction | 5 | 6 | SPAWN-TIMING-005 (PWR_OPERATE_SPAWN 1-tick override; `needs_vanilla_verification`) |
| 9.3 Spawn Stomping | 6 | 6 | — |
| 9.4 Renew Creep | 7 | 7 | — |
| 9.5 Recycle Creep | 3 | 3 | — |
| 9.6 Creep Spawning State | 4 | 4 | — |
| 9.7 Aging & Death | 11 | 12 | CREEP-DEATH-008 (matrix; implicitly covered by DEATH/SUICIDE union but no dedicated test) |
| 9.8 Suicide | 4 | 4 | — |
| 9.9 Say | 3 | 3 | — |

**54/56 tested (96%)** — both gaps are low-priority: SPAWN-TIMING-005 requires
`PWR_OPERATE_SPAWN` scripting on a power creep, CREEP-DEATH-008 is a cross-cut
matrix claim that the existing behavior tests together validate.

Section 9.10 (cancelOrder) has no entries — it contains only a coverage note
deferring to section 24.2.

**Vanilla:** 0 skipped, 0 expected-failures — all 60 tests run and pass on the
vanilla adapter (source verification: only gate is `shard.requires('terrain')`,
which vanilla declares `true`).

---

## Section 10: Structures — Energy & Storage

### Quality issues
- No issues found.

### Changes applied
- None.

### Test coverage
| Facet | Tested | Total | Untested IDs |
|---|---|---|---|
| 10.1 Extension | 2 | 2 | — |
| 10.2 Storage | 0 | 0 | — (coverage notes only) |
| 10.3 Container | 3 | 3 | — |
| 10.4 Link | 12 | 12 | — |

**17/17 tested (100%)**

Full coverage across all facets. Section 10.2 (Storage) has no entries — all
storage behaviors are owned by other sections (15.1, 6.10, 23).

---

## Section 11: Structures — Production

### Quality issues
- No issues found.

### Changes applied
- None.

### Test coverage
| Facet | Tested | Total | Untested IDs |
|---|---|---|---|
| 11.1 Lab Reactions | 12 | 12 | — |
| 11.2 Lab Reverse Reaction | 12 | 12 | — |
| 11.3 Reaction Chain | 0 | 0 | — (coverage notes only) |
| 11.4 Factory Production | 10 | 10 | — |
| 11.5 Factory Commodity Chains | 3 | 3 | — |
| 11.6 Power Spawn | 5 | 5 | — |

**42/42 tested (100%)**

Full coverage across all facets. Section 11.3 (Reaction Chain) has no entries —
chain conformance is covered by `LAB-RUN-001`.

---

## Section 12: Structures — Military

### Quality issues
- No issues found.

### Changes applied
- None.

### Test coverage
| Facet | Tested | Total | Untested IDs |
|---|---|---|---|
| 12.1 Rampart — Protection | 8 | 8 | — |
| 12.2 Rampart — Decay & Limits | 5 | 5 | — |
| 12.3 Wall | 2 | 2 | — |
| 12.4 Tower | 0 | 0 | — (coverage notes only) |

**15/15 tested (100%)**

---

## Section 13: Structures — Infrastructure

### Quality issues
- No issues found.

### Changes applied
- None.

### Test coverage
| Facet | Tested | Total | Untested IDs |
|---|---|---|---|
| 13.1 Road — Decay | 4 | 4 | — |
| 13.2 Road — Wear | 2 | 2 | — |
| 13.3 Terminal | 9 | 9 | — |
| 13.4 Observer | 6 | 6 | — |
| 13.5 Extractor | 5 | 5 | — |
| 13.6 Portal | 4 | 4 | — |

**30/30 tested (100%)**

---

## Section 14: Structures — NPC

### Quality issues
- No issues found.

### Changes applied
- None.

### Test coverage
| Facet | Tested | Total | Untested IDs |
|---|---|---|---|
| 14.1 Keeper Lair | 3 | 3 | — |
| 14.2 Invader Core | 4 | 4 | — |
| 14.3 Power Bank | 3 | 3 | — |
| 14.4 NPC Ownership Query Surface | 1 | 1 | — |

**11/11 tested (100%)**

---

## Section 15: Structure Common

### Quality issues
- No issues found.

### Changes applied
- None.

### Test coverage
| Facet | Tested | Total | Untested IDs |
|---|---|---|---|
| 15.1 Hits & Destruction | 4 | 4 | — |
| 15.2 isActive & RCL | 5 | 5 | — |
| 15.3 Construction Costs | 2 | 2 | — |
| 15.4 Structure APIs | 6 | 6 | — |

**17/17 tested (100%)**

---

## Section 16: Room Mechanics

### Quality issues
- No issues found.

### Changes applied
- None.

### Test coverage
| Facet | Tested | Total | Untested IDs |
|---|---|---|---|
| 16.1 Visibility | 2 | 2 | — |
| 16.2 Energy Tracking | 2 | 2 | — |
| 16.3 Find | 6 | 6 | — |
| 16.4 Look | 5 | 5 | — |
| 16.5 Terrain | 3 | 3 | — |
| 16.6 Event Log | 4 | 4 | — |
| 16.7 Flags | 6 | 6 | — |

**28/28 tested (100%)**

---

## Section 17: Source, Mineral & Deposit Lifecycle

### Quality issues
- No issues found.

### Changes applied
- None.

### Test coverage
| Facet | Tested | Total | Untested IDs |
|---|---|---|---|
| 17.1 Source Regeneration | 4 | 4 | — |
| 17.2 Source Power Effects | 2 | 2 | — |
| 17.3 Mineral Regeneration | 5 | 5 | — |
| 17.4 Mineral Power Effects | 1 | 1 | — |
| 17.5 Deposit Lifecycle | 5 | 5 | — |

**17/17 tested (100%)**

---

## Section 18: Game Objects

### Quality issues
- No issues found.

### Changes applied
- None.

### Test coverage
| Facet | Tested | Total | Untested IDs |
|---|---|---|---|
| 18.1 Tombstone | 2 | 2 | — |
| 18.2 Ruin | 3 | 3 | — |
| 18.3 Nuke (In-Flight) | 3 | 3 | — |

**8/8 tested (100%)**

---

## Section 19: Power Creeps

### Quality issues
- No issues found.

### Changes applied
- None.

### Test coverage
| Facet | Tested | Total | Untested IDs |
|---|---|---|---|
| 19.1 Lifecycle | 13 | 13 | — |
| 19.2 Movement & Actions | 5 | 5 | — |
| 19.3 Enable Room | 2 | 2 | — |
| 19.4 Operate Powers | 5 | 5 | — |
| 19.5 Disrupt Powers | 3 | 3 | — |
| 19.6 Regen Powers | 2 | 2 | — |
| 19.7 Combat Powers | 3 | 3 | — |
| 19.8 Generate Ops | 0 | 3 | POWER-GENERATE-OPS-001, -002, -003 |

**33/36 tested (92%)**

All untested entries are in 19.8 Generate Ops.

---

## Section 20: Market

### Quality issues
- No issues found.

### Changes applied
- None.

### Test coverage
| Facet | Tested | Total | Untested IDs |
|---|---|---|---|
| 20.1 Terminal Send | 0 | 0 | — (coverage notes only) |
| 20.2 Orders | 8 | 8 | — |
| 20.3 Deal | 3 | 3 | — |
| 20.4 Queries | 5 | 5 | — |

**16/16 tested (100%)**

---

## Section 21: Map

### Quality issues
- No issues found.

### Changes applied
- None.

### Test coverage
| Facet | Tested | Total | Untested IDs |
|---|---|---|---|
| 21.1 Room Queries | 5 | 5 | — |
| 21.2 Route Finding | 5 | 5 | — |
| 21.3 Terrain | 1 | 1 | — |

**11/11 tested (100%)**

---

## Section 22: RoomPosition

### Quality issues
- No issues found.

### Changes applied
- None.

### Test coverage
| Facet | Tested | Total | Untested IDs |
|---|---|---|---|
| 22.1 Construction & Properties | 1 | 1 | — |
| 22.2 Spatial Queries | 6 | 6 | — |
| 22.3 Find Helpers | 6 | 6 | — |
| 22.4 Look | 3 | 3 | — |
| 22.5 Actions | 2 | 2 | — |

**18/18 tested (100%)**

---

## Section 23: Store API

### Quality issues
- No issues found.

### Changes applied
- None.

### Test coverage
| Facet | Tested | Total | Untested IDs |
|---|---|---|---|
| 23.1 Resource Access | 2 | 2 | — |
| 23.2 Open Stores | 3 | 3 | — |
| 23.3 Single-Resource Stores | 4 | 4 | — |
| 23.4 Restricted Stores | 5 | 5 | — |
| 23.5 Timer Models | 2 | 2 | — |

**16/16 tested (100%)**

---

## Section 24: Intent Resolution

### Quality issues
- `INTENT-CREEP-005`, `INTENT-CREEP-006`: Renumbered to `-002`, `-003` to fill
  gaps left by prior drops.
- `INTENT-SIMULT-004`: Renumbered to `-002` to fill gaps left by prior drops.

### Changes applied
- Renumbered `INTENT-CREEP-005` → `INTENT-CREEP-002`
- Renumbered `INTENT-CREEP-006` → `INTENT-CREEP-003`
- Renumbered `INTENT-SIMULT-004` → `INTENT-SIMULT-002`
- Updated test references in
  `tests/24-intent-resolution/24.1b-intent-overwrite.test.ts` and
  `tests/24-intent-resolution/24.4-simultaneous-actions.test.ts`

### Test coverage
| Facet | Tested | Total | Untested IDs |
|---|---|---|---|
| 24.1 Creep Action Priority | 3 | 3 | — |
| 24.2 Same-Tick Resource Visibility | 4 | 4 | — |
| 24.3 Intent Limits | 2 | 2 | — |
| 24.4 Simultaneous Actions | 2 | 2 | — |

**11/11 tested (100%)**

---

## Section 25: Memory

### Quality issues
- No issues found.

### Changes applied
- None.

### Test coverage
| Facet | Tested | Total | Untested IDs |
|---|---|---|---|
| 25.1 Main Memory | 4 | 4 | — |
| 25.2 RawMemory | 4 | 4 | — |
| 25.3 Foreign Segments | 4 | 4 | — |

**12/12 tested (100%)**
