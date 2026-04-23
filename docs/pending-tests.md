# Pending Test Authoring — New Behavior Entries

123 behavior entries added to `behaviors.md` during the catalog review still need
tests. 14 entries from sections 17–25 were written and verified this session;
the remainder are listed below grouped by section.

See `docs/test-authoring.md` for rules. Key reminders:
- Assert exact outcomes, not qualitative checks
- One behavior, one reason to fail
- Use checked-in constants from `src/constants.ts`, not engine runtime lookups
- Verify `undefined` inside player code (`=== undefined`), since JSON transport normalizes to `null`
- Run tests on both adapters: `node scripts/test.js vanilla <file>` and `node scripts/test.js xxscreeps <file>`
- Register xxscreeps parity gaps in `adapters/xxscreeps/parity.json`
- Update `behaviors.md` status from `needs_vanilla_verification` → `verified_vanilla` when a test passes on vanilla

---

## ~~1. Movement~~ — DONE

21 new tests written, verified on both adapters. Existing tests relabeled to match
behaviors.md catalog IDs (8 MOVE-BASIC were shifted, 3 fatigue tests lacked IDs).

**Written:**
MOVE-BASIC-005, 006, 007, 009, 010, 013, 014, 017, 019, 022, 023, 024, 025, 026,
MOVE-COLLISION-006, MOVE-FATIGUE-007, 008 (2 sub-cases),
MOVE-PULL-007 (3 sub-cases), 008, 009, 010, ROOM-TRANSITION-005

**Relabeled** (existing tests had wrong catalog IDs):
MOVE-BASIC test 005→008, 006→011, 007→012, 008→015, 009→016, 010→018, 011→020, 012→021;
MOVE-FATIGUE-007 and 008 sub-tests given catalog IDs in test names

**xxscreeps parity gaps found:**
- MOVE-BASIC-019: `moveTo({noPathFinding: true})` returns OK instead of ERR_NOT_FOUND
- MOVE-PULL-007 (self): `pull(self)` hangs — infinite loop in recursive circular-pull check (limitation skip)
- MOVE-PULL-007 (spawning): `pull(spawning)` returns OK instead of ERR_INVALID_TARGET

## ~~2. Pathfinding~~ — DONE

20 new tests written, verified on both adapters. Existing tests relabeled to match
behaviors.md catalog IDs (10 PathFinder + 2 CostMatrix were shifted). MAP-ROOM-006
folded into MAP-ROOM-001 (same behavior entry in catalog).

**Written:**
PATHFINDER-001, 005, 013, 014, 015, 016, 017, 018, 019, 020,
COSTMATRIX-004, 005, 008,
LEGACY-PATH-004, 005 (cross-room destination returns intra-room steps),
006, 007, 008, 009

**Relabeled** (existing tests had wrong catalog IDs):
PATHFINDER test 001→002, 002→003, 003→004, 004→006, 005→007, 006→008,
007→009, 008→010, 009→011, 010→012; COSTMATRIX test 004→006, 005→007

**Infrastructure:** Walled terrain fixture pair borders to prevent PathFinder from exploring undefined neighbor rooms.

**xxscreeps parity gaps found:**
- LEGACY-PATH-006: `findPath(pos, pos)` returns 1-step path instead of empty array

## ~~3. Harvesting~~ — DONE

17 new tests written (4 source, 8 mineral, 5 deposit-harvest), 2 existing tests
relabeled (HARVEST-005→009, HARVEST-001→014), 1 rewritten (HARVEST-006 overflow).
5 deposit lifecycle tests relabeled from DEPOSIT-HARVEST-* to their correct
DEPOSIT-* catalog IDs (section 17.5).

**Written (source):**
HARVEST-010, 011, 012, 013

**Relabeled (source):**
HARVEST-005→009, HARVEST-001→014

**Rewritten (source):**
HARVEST-006 (overflow: now asserts pile + decay-adjusted amount)

**Written (mineral):**
HARVEST-MINERAL-006, 007, 008, 009, 010, 011, 012, 013

**Written (deposit):**
DEPOSIT-HARVEST-001, 002, 003, 004, 005

**Relabeled (deposit lifecycle → section 17.5 IDs):**
DEPOSIT-HARVEST-001→DEPOSIT-005, 002→DEPOSIT-001, 003→DEPOSIT-004,
004→DEPOSIT-003, 005→DEPOSIT-006

**Adapter extension:** vanilla placeObject for deposits now supports `cooldownTime`
and `harvested` spec fields.

**xxscreeps parity gaps found:**
- HARVEST-MINERAL-012: overflow drop not created (silently discards overflow)

## ~~4. Resource Transfer~~ — DONE

26 new tests written. All sections 4.1–4.5 verified on vanilla. No catalog ID
drift found.

**Written (transfer):** TRANSFER-009, 010, 011, 012, 013, 014

**Written (withdraw):** WITHDRAW-009, 010, 011, 012, 013, 014, 015, 016

**Written (pickup):** PICKUP-005, 006, 007, 008, 009

**Written (drop):** DROP-005, 006, 007, 008, 009, 010

**Written (drop decay):** DROP-DECAY-006

**Adapter fix:** vanilla adapter's lab `buildStructure` was missing `storeCapacity`
(LAB_ENERGY_CAPACITY + LAB_MINERAL_CAPACITY), breaking mineral transfers to empty
labs. Added for consistency with spawn/tower/container defaults.

**xxscreeps parity gaps found:**
- TRANSFER-011: controller redirect not implemented (returns ERR_NOT_IN_RANGE)
- WITHDRAW-014: wrong resource returns ERR_NOT_ENOUGH_ENERGY instead of ERR_INVALID_TARGET

**Capability-gated:** WITHDRAW-013 skipped on xxscreeps via `shard.requires('nuke')`.

## ~~5. Construction & Repair~~ — DONE

5 new tests written, verified on both adapters. No catalog ID drift found.

**Written:** BUILD-010, REPAIR-009, DISMANTLE-006, DISMANTLE-007, DISMANTLE-008

**Constants added:** `REPAIR_COST` exported from `src/constants.ts` / `src/index.ts`.

**xxscreeps parity gaps found:**
- DISMANTLE-007: structure persists with hits=0 instead of being destroyed
  (`dismantle-no-destroy-at-zero-hits`)

## ~~6. Controller~~ — DONE

5 new tests written, verified on both adapters. One catalog correction.

**Written:**
CTRL-ATTACK-006, CTRL-RESERVE-006, CTRL-RESERVE-007, CTRL-UPGRADE-011,
CTRL-UPGRADE-012

**Catalog correction:**
CTRL-RESERVE-007 originally described `reserveController()` reducing a
hostile reservation, but engine `game/creeps.js:976-978` returns
`ERR_INVALID_TARGET` for a hostile-reserved controller. The actual reduction
mechanism is `attackController()` (processor path at
`attackController.js:33-40`). Entry rewritten; a note preserves the history.

**xxscreeps parity gaps (added to existing category):**
- `creep-owner-undefined` now covers CTRL-RESERVE-006, CTRL-RESERVE-007
  (same root: Creep.owner undefined breaks `reserveController` /
  `attackController` internal owner lookups).

## ~~7. Combat~~ — DONE

10 new tests written, verified on both adapters. No catalog ID drift.

**Written (7.1 melee/ranged/heal):**
COMBAT-MELEE-008, COMBAT-RANGED-006, COMBAT-HEAL-005, COMBAT-HEAL-006,
COMBAT-RANGEDHEAL-004, COMBAT-RANGEDHEAL-005

**Written (7.3 ranged mass attack):** COMBAT-RMA-004

**Written (7.6 body-part damage model, in tests/09):** COMBAT-BODYPART-004

**Written (7.9/7.10 tower):** TOWER-HEAL-004, TOWER-REPAIR-004

**xxscreeps parity (added to existing category):**
- `rampart-no-protection` now covers COMBAT-RANGED-006 and COMBAT-RMA-004
  (same root: no rampart-redirect in rangedAttack/rangedMassAttack processors).

## ~~8. Boosts~~ — DONE

1 new test written, verified on both adapters (xxscreeps supports chemistry;
capability gate no-ops).

**Written:** BOOST-CREEP-009

**Notes:** Lab loaded with LH (boosts WORK). Creep body [WORK, ATTACK, MOVE].
Only the WORK part receives `boost === 'LH'`; ATTACK/MOVE remain unboosted,
and exactly one mineral/energy unit is consumed.

## ~~9. Spawning & Creep Lifecycle~~ — DONE

1 new test written, 5 pre-existing tests relabeled to their correct catalog
IDs. Vanilla 62/62; xxscreeps 5 expected parity failures (all classified).

**Written:** SPAWN-CREATE-013

**Relabeled** (tests existed under wrong catalog IDs):
- SPAWN-CREATE-003 → SPAWN-CREATE-012 (invalid body part type)
- RENEW-CREEP-003 → RENEW-CREEP-008 (ERR_NOT_ENOUGH_ENERGY)
- RENEW-CREEP-004 → RENEW-CREEP-001 (ERR_NOT_IN_RANGE — adjacency)
- RENEW-CREEP-005 → RENEW-CREEP-010 (ERR_FULL at CREEP_LIFE_TIME)
- RENEW-CREEP-006 → RENEW-CREEP-009 (ERR_BUSY while spawning)
- RECYCLE-CREEP-002 → RECYCLE-CREEP-004 (ERR_NOT_IN_RANGE)

**Parity update:** existing `renew-while-spawning` entry updated
RENEW-CREEP-006 → RENEW-CREEP-009 to follow the relabel.

**Notes on SPAWN-CREATE-013:** engine's `spawn tick` processor regens +1
energy/tick into the spawn (whenever `room.energyAvailable < SPAWN_ENERGY_CAPACITY`,
`@screeps/engine/src/processor/intents/spawns/tick.js:47`). After the spawnCreep
intent drains the full 100-energy body cost, the same end-of-tick handler
adds 1 back. Test asserts spawn=1, extension=0 one tick after the call.

**Pre-existing drift not addressed** (outside this section's pending scope):
RENEW-CREEP-001/002/RECYCLE-CREEP-002 tests partially match their catalog
entries (no exact formula assertions). Flagged for later cleanup.

## ~~10. Structures — Energy~~ — DONE

1 new test written, verified on both adapters. No new parity gaps.

**Written:** LINK-013

Full 400 energy transferred; target receives `400 - ceil(400 * LINK_LOSS_RATIO)`,
source drains to 0.

## ~~12. Structures — Military~~ — DONE

1 new test written, verified on both adapters. No new parity gaps.

**Written:** RAMPART-PROTECT-009

Owner creep moves TOP onto own non-public rampart tile — asserts the creep
ends at the rampart position (blocking rule only applies to hostiles).

## ~~13. Structures — Infrastructure~~ — DONE

4 new tests written, verified on vanilla. Capability-gated on xxscreeps
(`market` + `portals`).

**Written:** TERMINAL-SEND-010, TERMINAL-SEND-011, TERMINAL-SEND-012, PORTAL-005

**Constants added:** `TERMINAL_COOLDOWN` exported from `src/constants.ts`/`src/index.ts`.

**Notes on TERMINAL-SEND-010:** engine sets `cooldownTime = gameTime + TERMINAL_COOLDOWN`;
player-facing `cooldown` reports `TERMINAL_COOLDOWN - 1` on the tick immediately after
the send resolves. Assertion uses that exact value.

**Notes on PORTAL-005:** creep steps onto portal via a `move()` intent on tick N,
then tick N+1 has no player code — proves passive transport.

## ~~14. Structures — NPC~~ — DONE

1 new test written, verified on vanilla; capability-gated on xxscreeps
(`powerCreeps`).

**Written:** POWER-BANK-004

**Mechanic:** destroyed power bank becomes a ruin with `store.power`;
`RUIN_DECAY_STRUCTURES.powerBank = 10` ticks later `ruins/tick.js` calls
`_create-energy`, which spills the store as a ground pile. The pile then
decays by `ceil(amount / ENERGY_DECAY)` each subsequent tick, so the test
reads it on the spill tick itself (9 ticks post-kill: `gameTime >= decayTime - 1`).

## ~~15. Structure Common~~ — DONE

1 new test written, verified on vanilla; 1 new xxscreeps parity gap.

**Written:** STRUCTURE-HITS-005

**Shape:** before — ruin with 50 energy, no drop on tile. Advance 5 ticks.
After — ruin null; energy pile at the tile with exact amount 50.

**xxscreeps parity gap:** `ruin-spill-decay-on-spill-tick` — xxscreeps
applies energy/tick decay to the freshly-spilled pile in the same tick
(observed amount 48 vs 50). Vanilla's processor model iterates over
pre-existing objects only, so newly inserted piles skip decay until the
next tick.

## ~~16. Room Mechanics~~ — DONE

2 new tests written, verified on both adapters.

**Written:** FLAG-007, FLAG-008

**Notes on FLAG-008:** engine checks `_.size(Game.flags) >= FLAGS_LIMIT`
(rooms.js:984). Test seeds FLAGS_LIMIT stub entries into the in-tick
`Game.flags` map, then asserts the next `createFlag` returns `ERR_FULL` —
exercises the exact boundary without paying for 10 000 real creations.

## ~~20. Market~~ — DONE

1 new test written, verified on vanilla; capability-gated on xxscreeps.

**Written:** MARKET-ORDER-009

**Infra:** added `placeMarketOrder` adapter helper (vanilla implemented,
xxscreeps stubs throw). `MarketOrderSpec` added to `src/adapter.ts`.
`MARKET_ORDER_LIFE_TIME` exported from `src/constants.ts`/`src/index.ts`.

**Approach:** the engine expiry check uses wall-clock `Date.now()`, not
`gameTime` (`global-intents/market.js:507`). Test shape:
1. Create a fresh order via `Game.market.createOrder` — verify
   `createdTimestamp` lies within the `[beforeCreate, afterCreate]`
   `Date.now()` window.
2. Tick once — order persists.
3. Seed a second order via `placeMarketOrder` with
   `createdTimestamp = Date.now() - MARKET_ORDER_LIFE_TIME + 2000` (2 s of
   remaining life). Verify it's present and `remainingAmount` intact.
4. Sleep 2 500 ms (past the wall-clock threshold), tick, verify the order
   is removed from `Game.market.orders`.

---

## ~~9. Spawning & Lifecycle — CREEP-DEATH-011~~ — DONE

CREEP-DEATH-011 (rate=0 death leaves an empty tombstone) is written and verified
on both adapters. Adapter unblock: `placeCreep` now resolves a reserved `'sk'`
handle to engine user id `'2'` on both vanilla and xxscreeps, and the xxscreeps
adapter additionally calls `activateNPC(room, '2')` so the built-in Invader loop
(`mods/invader/loop/find-attack.ts:60`) auto-suicides the creep in a player-owned
room with no hostiles and no spawns.

## Notes

- **Capability-gated entries** (deposit, market, chemistry) skip on xxscreeps; verify on vanilla only.
- **Flag entries** (FLAG-007, FLAG-008) run on both adapters since `flagSupport` closed.
- **MARKET-ORDER-009** is likely untestable — would require advancing 30 days of ticks. Consider marking as infeasible or testing with a shorter-than-production timer if the engine exposes one.
- **STRUCTURE-HITS-005** overlaps with RUIN-005 (already tested); verify whether this entry adds anything beyond what RUIN-005 covers (it adds the store-spill assertion).
- When writing tests, check the engine source at `node_modules/@screeps/engine/src/` to determine exact formulas — don't guess. Example: TOMBSTONE-003 required reading `_die.js` to get the corpse energy formula.
