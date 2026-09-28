# Changelog

screeps-ok follows semantic versioning with the pre-1.0 convention: while the
major version is `0`, a **minor** bump marks a change a consumer must act on,
and a **patch** bump needs nothing from them. 1.0 marks a stable adapter
contract.

A consumer must act when a release:

- changes the adapter contract (`docs/adapter-spec.md`, `src/adapter.ts`), so
  adapters need code changes;
- renames, drops, or re-keys a catalog ID, so `parity.json` registrations
  that name it stop matching (a full run fails on them);
- changes how the runner or parity reporter decides pass/fail.

New catalog rows and tighter assertions ship in patch releases even though
they can surface new failures on an engine; register those in your
`parity.json`.

Add an entry under **Unreleased** in the same PR as any consumer-facing
change. Each release is a git tag (`v0.3.0-beta`); consumers clone at a tag.
The package is not published to npm. Moving your clone to a new release is
described in `docs/adapter-guide.md` under Moving to a New Release.

## Unreleased

## 0.3.0 (beta) — 2026-09-27

The first beta. In September 2026 the adapter contract, the catalog and the
runner were reviewed end to end, so that a passing test means the engine
matches vanilla and a failing one names a real difference:

- Tests assert vanilla's exact outcome, where many had accepted a range or
  either of two results.
- Every catalog row has a source: vanilla's code, the API documentation, or a
  reported server behavior. Rows with none, and rows that restated another
  row, are gone.
- Each method's failure codes belong to one validation row, whose test runs
  each failure condition alone and each ordered pair of conditions, checking
  the code vanilla returns first.
- The runner fails on what it had silently forgiven: registrations that match
  no test, test files that fail to load, a malformed `parity.json`.
- Adapters report what the engine did, with no defaults, fallbacks or clamps
  of their own.

These notes count from `fd25c92`, `master` before the review began, and the
ID tables compare its tests with this release's. Changes between
`v0.1.0-alpha` and `fd25c92` were not recorded. If you are upgrading from the
alpha, they include 17 capability flags your adapter must declare
(`actionLogCapture`, `cpuShardLimits`, `deprecationNotices`,
`interShardMemory`, `invaderRaidSpawner`, `liveWorldSize`, `marketBasics`,
`multiShard`, `powerBank`, `powerCreepAccountApi`, `powerEffects`,
`powerSpawn`, `randomInjection`, `roomStatus`, `strongholdDeploy`, `terminal`,
`terminalSend`), the `parity.json` overlay (`extends`, `expected_passes`), and
the dropped `ROOM-TRANSITION-006`; `git log v0.1.0-alpha..fd25c92` has the
rest.

### Upgrading

1. Update your adapter for each item under Adapter contract below.
   `tests/00-adapter-contract/` checks them. Delete the adapter's
   `limitations`: each flag skipped tests that now run (`pullSelfHang` →
   `MOVE-PULL-011:self`; `controllerDowngrade` → the `CTRL-DOWNGRADE` tests,
   `CTRL-SAFEMODE-009:downgradeTimer` and a contract test;
   `xxscreepsPathFinderUseMissing` → `LEGACY-PATH-003`). If your engine still
   can't run one, list it under `skips` in your `parity.json`.
2. Make your `parity.json` load; a file that breaks its schema now fails the
   run. Remove the legacy `summary` and `status` keys, give every gap
   `actual`, `expected` and a non-empty `tests`, and drop any
   `expected_passes` entry that names a gap the base no longer registers. An
   `extends` that doesn't resolve now fails the run, where it had logged an
   error and loaded no registrations: link your screeps-ok clone into your
   repository (`npm i -D file:../screeps-ok`) so
   `screeps-ok/parity/<engine>.json` resolves.
3. Run the full suite once, unfiltered and unsharded. It fails on each
   registration that matches no test, including tests your adapter skips for a
   missing capability. Look each ID up under Test IDs that moved or went below
   and register its replacement, or delete it. It also fails on each
   registered test that now passes: rows restated below can flip a gap.
4. Expect new failures from exact assertions, new rows and new validation
   conditions. Each is an adapter bug to fix or an engine gap to register.
5. If your CI shards the suite, each shard writes `reports/<name>-partial.json`
   and none checks for orphaned registrations; run an unsharded full run to
   check them.

### Adapter contract

Each item needs a change in your adapter unless it says otherwise.

- `tick(count, options)` takes `options.signal`, an `AbortSignal`. Check it
  before each of the `count` ticks and throw `signal.reason` once it is
  aborted. The test fixture aborts it when a test ends, so a timed-out test
  can no longer tick a server the next test reuses.
- `RoomSpec.powerEnabled` sets the controller's `isPowerEnabled` (default
  false). `placePowerCreep` must no longer enable power in its room; a test
  whose power creep calls `usePower` in a controlled room sets the flag.
- Every room is walled at its four corner tiles, over the default terrain,
  `RoomSpec.terrain` and `setTerrain()` alike: the map generator never leaves
  a corner passable.
- Snapshots report the player getter's value on the tick: no defaults, no
  clamps, `undefined` becomes `null`, and `storeCapacity` is
  `store.getCapacity()`. A controller snapshot's `sign`, `reservation` and
  `safeMode`, once optional, are required and `null` when absent, and
  `effects` is typed and `null` when the getter is `undefined`.
- `placePowerCreep` derives `hits`/`hitsMax` as `1000 * (level + 1)` and store
  capacity as `100 * (level + 1)`.
- Placement rejects a `cooldown` on a structure with no public cooldown.
- World size is engine-reported: the world must contain the spec rooms, and
  tests read `Game.map.getWorldSize()` under the `liveWorldSize` capability.
  Spec rooms may sit on either side of the map origin (e.g. `E1S1`).
- A player tick the engine aborts is `RunPlayerError('runtime')`.
- The `strongholdMetadata` capability is gone, and `InvaderCoreSnapshot` no
  longer carries `templateName` or `strongholdId`: no player getter exposes
  them. Drop the flag and the snapshot fields; both stay `placeObject` inputs
  for an invader core.
- `ScreepsOkAdapter.limitations` is gone, with `AdapterLimitation`,
  `AdapterLimitations` and `limitationGated`: all three limitations were
  closed, and an engine couldn't add one of its own. A test your engine can't
  run goes under `skips` in your `parity.json` (see Parity and the runner).
- `PlayerSpec.gcl` is `{ level, progress? }` (`GclSpec`), as `Game.gcl` reads
  it, where it was a number the two reference adapters read as points and as
  a level. `gclPoints()` converts it to the points your engine stores; write
  them to the user record the engine's claim check reads. The default is the
  rooms the player owns plus one, at least 2 (it was 10,000,000 points, level
  3, on vanilla). `PlayerSpec.power` states its default: 10,000,000 points,
  exported as `DEFAULT_PLAYER_POWER`.
- `placeObject` takes a typed spec for `portal`, `deposit`, `keeperLair`,
  `invaderCore` and `powerBank` (`PlaceObjectSpecs`), with timers named for
  their getters. Renamed: `decayTime` → `ticksToDecay`, `cooldownTime` →
  `cooldown`, `nextSpawnTime` → `ticksToSpawn`, `deployTime` →
  `ticksToDeploy`, `collapseTime` → `ticksToCollapse`, `spawning.remainingTicks`
  → `spawning.remainingTime`; a power bank's `store.power` is `power`.
  Required now: a deposit's `depositType`, an invader core's `level`, a power
  bank's `power` (adapters had defaulted them to silicon, 0 and 1000). Gone: a
  power bank's `hitsMax` (always `POWER_BANK_HITS`), and an invader core's
  `effects`, `user`, `hits` and `hitsMax`, which no test used. A timer of 0 now
  means 0 ticks, where it had meant unset.
- `RoomSpec.controller: false` makes a room with no controller, as a keeper
  or highway room has none; create no controller for it. It takes no `rcl`,
  `owner`, safe mode, `ticksToDowngrade` or `powerEnabled`; `checkRoomSpec()`
  rejects a spec that sets one.
- `placeSource` without `energyCapacity` gives the capacity the room's state
  sets (keeper with no controller, full when owned or reserved, else neutral),
  where it was 3000 everywhere; `energy` defaults to full.
- `setTerrain()` is setup-only: before the shard's first tick it replaces the
  terrain player code reads, and after it the call throws and changes
  nothing, since an engine's player sandboxes may already hold the old
  terrain. An adapter had been allowed to accept it after a tick.
- Four setup fields. `RoomSpec.progress` sets an owned controller's
  `progress` (default 0; `checkRoomSpec()` rejects it without an owner, at
  level 8, or at `CONTROLLER_LEVELS[rcl]` and above). `PlayerSpec.credits`
  sets `Game.market.credits` (default `DEFAULT_PLAYER_CREDITS`, 10,000,000,
  the credits the vanilla adapter had hard-coded; `playerMillicredits()`
  gives your engine's thousandths). `PlayerSpec.modules` installs code modules
  beside your adapter's own `main`, so player code can `require()` them
  (`playerModules()` rejects a `main`). An invader core placed with
  `ownsController` owns its room's controller as the backend creates a
  stronghold: the Invader's, level 8, invulnerable, with its downgrade timer
  running out when the core deploys.
- Capability flags are literals, never derived from whether an import or probe
  succeeded, and an adapter never manufactures an outcome the engine didn't
  produce: no resets, fallbacks, or clamps.
- Rules the spec already stated are now pinned by contract tests, so an
  adapter that skipped one fails: an owned room without an `rcl` has a level 1
  controller (the spec had said "should"); a getter's `undefined` snapshots as
  `null`; a structure spec's `store` replaces the engine's default store;
  `runPlayers()` normalizes each result as `runPlayer()` does;
  `options.random` throws on out-of-range or non-finite values before any tick
  and restores `Math.random` afterwards, errors included; a `tick()` whose
  `options.signal` is already aborted throws its reason before any tick;
  `findInRoom` refuses player-relative constants; and the `placeObject`
  defaults and `captureConsoleLogs` behave as specified.
- `ObserverSnapshot` has no `cooldown`: an observer has no cooldown getter.
  Stop setting it.
- `expectedShape(adapter, target, canonical)` takes the adapter first and
  returns synchronously, where it was `async (target, canonical)`. It matters
  only to tests of your own that call it.
- `screeps-ok` exports `withCornerWalls` and `MarketOrderSpec`, which the
  starter adapter imports; it had not compiled against the package. Nothing
  to do.

### Parity and the runner

These change when a run passes or fails, so a CI that passed before can fail
now.

- A full run (no filter, no `--shard`) fails when a registered test ID
  matches no test that passed or failed: a typo, a renamed or dropped ID, or
  a test your adapter skips for a missing capability. Drop a base gap your
  engine can't run with `expected_passes`. A sharded run doesn't check this;
  this repository's CI merges its shards' reports and checks them with a
  script the package doesn't ship.
- A run fails on an unexpected pass even when vitest itself exited 0.
- A test file that fails to load, or an unhandled error, is a genuine failure,
  where it had been forgiven when every failed test was registered.
- A malformed `parity.json`, or an `extends` that doesn't resolve, fails the
  run instead of loading no registrations.
- `parity.json` is checked when it loads. Each gap needs `actual`, `expected`
  and a non-empty `tests` of catalog test IDs; an unknown key (the legacy
  `summary` and `status` included), a test ID under two gaps, and an
  `expected_passes` entry the base doesn't register fail the run.
- A failing vitest run is forgiven only when it has registered failures to
  forgive; one that fails for a reason the reporter doesn't see (no test file
  matched, say) stays failed.
- `behaviors.md` rows can carry their own `capability:` tag on top of their
  section's. A test of a tagged row fails when it ends without having called
  `shard.requires()` for each tag, so an ungated test can't run on an adapter
  that lacks the capability; gates a matrix passes as data count.
- A test's ID is the one catalog ID its name carries, and a test's `:key`
  wins over its describe block's bare ID. A name that runs on past an ID
  (`GPL-002a`, `POWER-GENERATE-OPS-001`) carries none.
- A `:key` is one camelCase token, a letter then letters or digits
  (`LAB-REVERSE-001:GH2O`), read whole. The reporter had cut a key at its
  first `-` or `+` (`NUKE-LAUNCH-008:not-owner` registered as
  `NUKE-LAUNCH-008:not`) and ignored a key containing a digit or `_`, so the
  test registered as its bare ID. Kebab-case keys are renamed (see Test IDs
  that moved or went); a test whose key has a digit or `_` can now be
  registered by its key.
- Registering a bare ID covers every `:key` test of it, as the adapter guide
  documented; a keyed registration wins over the bare one. Before, a bare
  registration matched only tests named with the bare ID.
- A test under `tests/NN-*/` (other than `00-*`) whose name carries no
  catalog ID, or two, fails the run: nothing could register or cover it.
- Reports are written only when `CI` is set. Then only an unfiltered run
  writes `reports/<name>.json`; a filtered or sharded run (any vitest
  argument, `--shard` included) writes `reports/<name>-partial.json`, and
  vitest run directly writes no report. A CI that shards the suite collects
  `<name>-partial.json` from each shard. `runSuite()`'s `reportName` option is
  gone; the runner names the report from the adapter.
- `parity.json` takes `skips`, for tests your engine can't run at all (one
  that hangs a tick, say): `{ "<skip id>": { "why": "…", "tests": [ids] } }`.
  The fixture skips them before they touch the adapter, the reporter lists
  them, and status shows each `why`. A skip that names no test is orphaned on
  a full run, and a test ID is skipped or registered as a gap, not both.

### Test IDs that moved or went

A `parity.json` registration that names one of these IDs matches no test, and
a full run fails on it. Find the ID here and register what replaced it, or
delete the registration. Rows that only gained keys need nothing (see Catalog
changes that need no action).

**Folded into a validation row.** Each creep and structure method's failure
codes now belong to one validation row. Its test runs each failure condition
alone (`HARVEST-015:range`) and each ordered pair (`:rangeBeforeHostileRoom`,
where vanilla checks range first), so rows that each tested one code went.
Register the validation row's condition in place of the old row: for
`HARVEST-002`, register `HARVEST-015:range`. Where an old row covered several
failure forms it maps to several conditions; the bare validation row covers
every condition and pair.

| Validation row | Old row → its condition |
| --- | --- |
| `BOOST-CREEP-010` | `BOOST-CREEP-004` → `:range`; `BOOST-CREEP-005` → `:notEnoughEnergy`, `:notEnoughMineral`; `BOOST-CREEP-006` → `:notFound` |
| `BUILD-011` | `BUILD-003` → `:range`; `BUILD-007` → `:noBodypart`; `BUILD-008` → `:notEnough` |
| `COMBAT-HEAL-007` | `COMBAT-HEAL-005` → `:range`; `COMBAT-HEAL-006` → `:noBodypart` |
| `COMBAT-MELEE-009` | `COMBAT-MELEE-002` → `:range`; `COMBAT-MELEE-003` → `:noBodypart` |
| `COMBAT-RANGED-007` | `COMBAT-RANGED-002` → `:range`; `COMBAT-RANGED-004` → `:noBodypart` |
| `COMBAT-RANGEDHEAL-006` | `COMBAT-RANGEDHEAL-004` → `:range`; `COMBAT-RANGEDHEAL-005` → `:noBodypart` |
| `CONSTRUCTION-SITE-011` | `CONSTRUCTION-SITE-002` → `:siteCapFull`; `CONSTRUCTION-SITE-003` → `:rclOrStructureCap`; `CONSTRUCTION-SITE-007` → `:invalidTarget`; `CONSTRUCTION-SITE-014` → `:hostileReservation` |
| `CTRL-ATTACK-007` | `CTRL-ATTACK-002` → `:noBodypart`; `CTRL-ATTACK-004` → `:range`; `CTRL-ATTACK-006` → `:invalidControllerState` |
| `CTRL-CLAIM-008` | `CTRL-CLAIM-002` → `:noBodypart`; `CTRL-CLAIM-003` → `:invalidControllerState`, `:hostileReservation`; `CTRL-CLAIM-004` → `:range`; `CTRL-CLAIM-005` → `:gclNotEnough`; `CTRL-CLAIM-006` → `:invalidControllerState` |
| `CTRL-GENSAFE-005` | `CTRL-GENSAFE-002` → `:range`; `CTRL-GENSAFE-004` → `:notEnough` |
| `CTRL-RESERVE-008` | `CTRL-RESERVE-002` → `:noBodypart`; `CTRL-RESERVE-003` → `:invalidControllerState`; `CTRL-RESERVE-004` → `:range` |
| `CTRL-SAFEMODE-009` | `CTRL-SAFEMODE-003` → `:notEnough`; `CTRL-SAFEMODE-004` → `:cooldown`; `CTRL-SAFEMODE-005` → `:downgradeTimer`; `CTRL-SAFEMODE-007` → `:busy` |
| `CTRL-SIGN-004` | `CTRL-SIGN-002` → `:range` |
| `CTRL-UPGRADE-013` | `CTRL-UPGRADE-003` → `:range`; `CTRL-UPGRADE-004` → `:notEnough`; `CTRL-UPGRADE-009` → `:upgradeBlocked`; `CTRL-UPGRADE-014` → `:notEnough` |
| `DEPOSIT-HARVEST-006` | `DEPOSIT-HARVEST-002` → `:range`; `DEPOSIT-HARVEST-003` → `:cooldown` |
| `DISMANTLE-009` | `DISMANTLE-003` → `:range`; `DISMANTLE-005` → `:noBodypart` |
| `DROP-011` | `DROP-004` → `:notEnough`; `DROP-005` → `:notOwner`; `DROP-006` → `:busy`; `DROP-007` → `:invalidArgs` |
| `FACTORY-PRODUCE-011` | `FACTORY-PRODUCE-003` → `:notEnough`; `FACTORY-PRODUCE-004` → `:full`; `FACTORY-PRODUCE-005` → `:powerEffect`; `FACTORY-PRODUCE-006` → `:cooldown`; `FACTORY-PRODUCE-007` → `:rcl`; `FACTORY-PRODUCE-008` → `:invalidArgs`; `FACTORY-PRODUCE-009` → `:levelMismatch`; `FACTORY-PRODUCE-010` → `:notOwner` |
| `FLAG-009` | `FLAG-007` → `:nameCreated`; `FLAG-008` → `:flagCapFull` |
| `HARVEST-015` | `HARVEST-002` → `:range`; `HARVEST-003` → `:noBodypart`; `HARVEST-004` → `:depleted`; `HARVEST-010` → `:hostileRoom`, `:hostileReservation`; `HARVEST-011` → `:notOwner`; `HARVEST-012` → `:busy`; `HARVEST-013` → `:noTarget`, `:nullTarget`, `:invalidTarget`, `:plainObjectTarget` |
| `HARVEST-MINERAL-014` | `HARVEST-MINERAL-004` → `:depleted`; `HARVEST-MINERAL-006` → `:noExtractor`; `HARVEST-MINERAL-007` → `:extractorNotOwner`; `HARVEST-MINERAL-008` → `:inactiveExtractor`; `HARVEST-MINERAL-009` → `:cooldown`; `HARVEST-MINERAL-010` → `:range` |
| `LAB-REVERSE-013` | `LAB-REVERSE-005` → `:range`, `:rangeLab2`; `LAB-REVERSE-006` → `:notEnough`; `LAB-REVERSE-007` → `:full`, `:fullLab2`; `LAB-REVERSE-008` → `:invalidReversePair`, `:sameLab`; `LAB-REVERSE-009` → `:invalidTarget`, `:invalidLab1`, `:notALab`, `:selfTarget`; `LAB-REVERSE-010` → `:cooldown`; `LAB-REVERSE-011` → `:rcl`; `LAB-REVERSE-012` → `:notOwner` |
| `LAB-RUN-013` | `LAB-RUN-005` → `:range`, `:rangeLab1`; `LAB-RUN-006` → `:notEnough`, `:notEnoughLab1`; `LAB-RUN-007` → `:full`; `LAB-RUN-008` → `:invalidArgs`, `:noProduct`; `LAB-RUN-009` → `:invalidTarget`, `:invalidLab1`, `:notALab`, `:selfTarget`; `LAB-RUN-010` → `:cooldown`; `LAB-RUN-011` → `:rcl`; `LAB-RUN-012` → `:notOwner` |
| `LINK-014` | `LINK-004` → `:selfTarget`; `LINK-005` → `:invalidTarget`; `LINK-006` → `:targetNotOwner`; `LINK-007` → `:invalidArgs`; `LINK-008` → `:cooldown`; `LINK-009` → `:rcl`; `LINK-010` → `:notEnoughAmount`; `LINK-011` → `:full`; `LINK-012` → `:range` |
| `MOVE-BASIC-027` | `MOVE-BASIC-003` → `:fatigue`; `MOVE-BASIC-004` → `:noBodypart`; `MOVE-BASIC-005` → `:invalidArgs`; `MOVE-BASIC-007` → `:range`; `MOVE-BASIC-023` → `:notOwner`; `MOVE-BASIC-024` → `:busy` |
| `MOVE-PULL-011` | `MOVE-PULL-004` → `:range`; `MOVE-PULL-007:self` → `:self`; `MOVE-PULL-007:nonCreep` → `:invalidTarget`; `MOVE-PULL-007:spawning` → `:spawningTarget` |
| `NUKE-LAUNCH-008` | `NUKE-LAUNCH-005` → `:missingEnergy`, `:missingGhodium`; `NUKE-LAUNCH-006` → `:cooldown`; `NUKE-LAUNCH-007` → `:outOfRange`; `NUKE-LAUNCH-014` → `:noviceSource`; `NUKE-LAUNCH-015` → `:respawnSource`; `NUKE-LAUNCH-016` → `:noviceTarget`; `NUKE-LAUNCH-017` → `:respawnTarget` |
| `OBSERVER-007` | `OBSERVER-002` → `:range`; `OBSERVER-004` → `:invalidArgs`; `OBSERVER-005` → `:rcl`; `OBSERVER-006` → `:notOwner` |
| `PICKUP-010` | `PICKUP-003` → `:range`; `PICKUP-004` → `:full`; `PICKUP-005` → `:notOwner`; `PICKUP-006` → `:busy`; `PICKUP-007` → `:invalidTarget` |
| `RECYCLE-CREEP-005` | `RECYCLE-CREEP-004` → `:range` |
| `RENEW-CREEP-011` | `RENEW-CREEP-001` → `:range`; `RENEW-CREEP-007` → `:claimPart`; `RENEW-CREEP-008` → `:notEnough`; `RENEW-CREEP-009` → `:busy`; `RENEW-CREEP-010` → `:full` |
| `REPAIR-010` | `REPAIR-003` → `:range`; `REPAIR-004` → `:notEnough`; `REPAIR-007` → `:noBodypart` |
| `SPAWN-CREATE-014` | `SPAWN-CREATE-001` → `:invalidBody`; `SPAWN-CREATE-002` → `:oversizedBody`; `SPAWN-CREATE-003` → `:nameExists`, `:nameSpawning`; `SPAWN-CREATE-007` → `:notEnoughSelected`; `SPAWN-CREATE-008` → `:nameExists`, `:nameSpawning`; `SPAWN-CREATE-009` → `:busy`; `SPAWN-CREATE-012` → `:invalidPart` |
| `STRUCTURE-API-007` | `STRUCTURE-API-001` → `:notOwner`, `:noController`; `STRUCTURE-API-002` → `:busy`, `:busyPowerCreep` |
| `TERMINAL-SEND-013` | `TERMINAL-SEND-005` → `:invalidRoom`, `:invalidResource`, `:invalidDescription`; `TERMINAL-SEND-006` → `:notEnoughAmount`, `:notEnoughEnergyCost`; `TERMINAL-SEND-007` → `:cooldown`; `TERMINAL-SEND-008` → `:rcl`; `TERMINAL-SEND-009` → `:notOwner` |
| `TOWER-ATTACK-005` | `TOWER-ATTACK-004` → `:notEnough` |
| `TOWER-HEAL-005` | `TOWER-HEAL-004` → `:notEnough` |
| `TOWER-REPAIR-005` | `TOWER-REPAIR-004` → `:notEnough` |
| `TRANSFER-015` | `TRANSFER-003` → `:range`; `TRANSFER-004` → `:notEnough`; `TRANSFER-005` → `:invalidArgs`, `:invalidResource`, `:noResource`; `TRANSFER-006` → `:full`; `TRANSFER-007` → `:invalidTarget`, `:invalidCapacity`; `TRANSFER-008` → `:labMineral`; `TRANSFER-009` → `:notOwner`; `TRANSFER-010` → `:busy`; `TRANSFER-013` → `:fullAmount` |
| `UNBOOST-006` | `UNBOOST-002` → `:notFound`; `UNBOOST-003` → `:range` |
| `WITHDRAW-017` | `WITHDRAW-003` → `:range`; `WITHDRAW-004` → `:notEnough`; `WITHDRAW-005` → `:targetNotOwner`; `WITHDRAW-007` → `:full`; `WITHDRAW-008` → `:disruptedTerminal`; `WITHDRAW-009` → `:notOwner`; `WITHDRAW-010` → `:busy`; `WITHDRAW-011` → `:invalidArgs`, `:invalidResource`; `WITHDRAW-012` → `:safemodeNotOwner`; `WITHDRAW-013` → `:invalidNuker`, `:invalidPowerBank`; `WITHDRAW-014` → `:invalidCapacity`; `WITHDRAW-016` → `:fullAmount` |

**Another player's safe mode** had one row, `CTRL-SAFEMODE-006`, keyed by
method. It is now a condition of each method's validation row, at vanilla's
place in its check order. `TIMER-SAFEMODE-001` also runs every
safe-mode-refused action, keyed by action.

| Was | Register now |
| --- | --- |
| `CTRL-SAFEMODE-006:attack` | `COMBAT-MELEE-009:safeMode` |
| `CTRL-SAFEMODE-006:rangedAttack` | `COMBAT-RANGED-007:safeMode` |
| `CTRL-SAFEMODE-006:rangedMassAttack` | `COMBAT-RMA-005:safeMode` |
| `CTRL-SAFEMODE-006:heal` | `COMBAT-HEAL-007:safeMode` |
| `CTRL-SAFEMODE-006:rangedHeal` | `COMBAT-RANGEDHEAL-006:safeMode` |
| `CTRL-SAFEMODE-006:dismantle` | `DISMANTLE-009:safeMode` |
| `CTRL-SAFEMODE-006:attackController` | `CTRL-ATTACK-007:safeMode` |
| `CTRL-SAFEMODE-006:withdraw` | `WITHDRAW-017:safemodeNotOwner` |

**Merged into another row.** The dropped row restated the row on the right, or
its test now runs there (`RAMPART-PROTECT-001`'s test attacked with a tower,
which the new `TOWER-ATTACK-006` owns):

| Was | Register now |
| --- | --- |
| `BOOST-CREEP-007` | `BOOST-ATTACK-001` |
| `BOOST-CREEP-008` | `BOOST-HEAL-001` |
| `COMBAT-SIMULT-002` | `COMBAT-SIMULT-001:healMatchesDamage` |
| `COMBAT-SIMULT-004` | `COMBAT-SIMULT-001:lethal` |
| `COMBAT-SIMULT-005` | `COMBAT-SIMULT-001:summedSources` |
| `CONSTRUCTION-COST-002` | `CONSTRUCTION-COST-001` |
| `CREEP-DEATH-002` | `TOMBSTONE-001` |
| `CREEP-SPAWNING-001` | `SPAWN-TIMING-002` |
| `CREEP-SPAWNING-003` | `CREEP-SPAWNING-007` |
| `CTRL-DOWNGRADE-003` | `CTRL-DOWNGRADE-012` |
| `CTRL-DOWNGRADE-004` | `CTRL-DOWNGRADE-013` |
| `CTRL-RESERVE-005` | `CTRL-RESERVE-010` |
| `DEPOSIT-005` | `DEPOSIT-002` |
| `DROP-DECAY-004` | `HARVEST-006` |
| `EXTENSION-001` | `ROOM-ENERGY-001` |
| `EXTENSION-002` | `ROOM-ENERGY-002` |
| `FLAG-003` | `FLAG-009:flagCapFull` |
| `GPL-003` | `POWERCREEP-CREATE-002:noFreeLevels` |
| `MAP-TERRAIN-002` | `ROOM-TERRAIN-001` |
| `MAP-TERRAIN-003` | `ROOM-TERRAIN-002` |
| `MOVE-FATIGUE-006` | `BOOST-MOVE-001` |
| `NUKE-FLIGHT-003` | `NUKE-FLIGHT-001` |
| `NUKE-FLIGHT-005` | `NUKE-IMPACT-013` |
| `NUKE-IMPACT-002` | `NUKE-IMPACT-014` |
| `NUKE-IMPACT-003` | `NUKE-IMPACT-014` |
| `NUKE-LAUNCH-002` | `NUKE-LAUNCH-012` |
| `NUKE-LAUNCH-004` | `NUKE-FLIGHT-001` |
| `PORTAL-005` | `PORTAL-001` |
| `POWER-OPERATE-003` | `OBSERVER-003` |
| `POWER-OPERATE-004` | `FACTORY-COMMODITY-003` |
| `POWER-REGEN-001` | `SOURCE-POWER-001`, `MINERAL-POWER-001` |
| `POWERCREEP-MOVE-002` | `ROAD-WEAR-001:powerCreep` |
| `RAMPART-DECAY-005` | `POWER-COMBAT-002`, `POWER-COMBAT-003` |
| `RAMPART-PROTECT-001` | `TOWER-ATTACK-006` |
| `RAMPART-PROTECT-002` | `COMBAT-MELEE-005` |
| `ROOM-TERRAIN-003` | `MAP-TERRAIN-001` |
| `STORE-RESTRICTED-001` | `STORE-RESTRICTED-002` |
| `STRUCTURE-ACTIVE-001` | `CTRL-STRUCTLIMIT-001` |
| `STRUCTURE-ACTIVE-003` | `CTRL-STRUCTLIMIT-002` |
| `STRUCTURE-API-008` | `ATTACK-NOTIFY-006` |
| `STRUCTURE-HITS-004` | `RUIN-004` |
| `STRUCTURE-HITS-005` | `RUIN-005` |
| `TOMBSTONE-002` | `CREEP-DEATH-006` |
| `TOWER-INTENT-001` | `TOWER-INTENT-003` |
| `UNDOC-CTOR-001` | `UNDOC-IDCTOR-001:Creep` |
| `UNDOC-CTOR-002` | `UNDOC-IDCTOR-001:Source` |
| `UNDOC-CTOR-003` | `UNDOC-IDCTOR-001:Structure` |
| `UNDOC-CTOR-004` | `UNDOC-IDCTOR-001:Resource` |
| `UNDOC-CTOR-005` | `UNDOC-IDCTOR-001:ConstructionSite` |
| `UNDOC-CTOR-006` | `UNDOC-IDCTOR-001:Mineral` |
| `UNDOC-CTOR-007` | `UNDOC-IDCTOR-001:Tombstone` |
| `UNDOC-CTOR-008` | `UNDOC-IDCTOR-001:Ruin` |

**Dropped, with nothing to register instead:**

| Was | Why it went |
| --- | --- |
| `ACTIONLOG-DEDUP-001` | Its test could not fail: a second intent of the same type replaces the first before any action-log marker is written. |
| `ATTACK-NOTIFY-001`, `ATTACK-NOTIFY-002`, `ATTACK-NOTIFY-003`, `ATTACK-NOTIFY-004`, `CONSTRUCTION-SITE-015`, `LEGACY-PATH-010`, `RENEW-CREEP-012`, `RENEW-CREEP-013`, `RENEW-CREEP-014` | Their only source was an unmerged engine pull request, not shipped vanilla. |
| `CPU-SHARD-002`, `SHARD-MEMORY-002` | They cite no source; `CPU-SHARD-002`'s limits summing to `Game.cpu.limit` holds only on one shard. |
| `INTERSHARD-PORTAL-002` | It had a creep's `Memory` cross shards, which the API docs contradict: each shard's `Memory` is isolated. |
| `ISM-001`, `ISM-003`, `ISM-004`, `ISM-006` | The API docs state no value before the first `setLocal`, no rejection mode, no over-limit behavior and no cross-shard delay, and no open-source engine implements `InterShardMemory`. |
| `POWER-BANK-003` | It pinned a generated power bank's power range, but generation is a backend job no harness drives, so the test read back a seeded value. The object-shape rows still cover `power`. |
| `STRUCTURE-ACTIVE-005` | It pinned the tie between equally distant structures to vanilla's storage scan order, which nothing specifies. |
| `UNDOC-MEMHACK-012` | It pinned the `Memory` property descriptor after first access, which a bot observes only through `MEMORY-002` and `UNDOC-MEMHACK-007` to `UNDOC-MEMHACK-010`. xxscreeps's intentional gap `rawmemory-set-invalidates-parsed-memhack` went with it. |

**Rows that kept their ID but changed keys:**

| Was | Register now | Why |
| --- | --- | --- |
| `GPL-002a`, `GPL-002b`, `GPL-002c`, `GPL-002d`, `GPL-002e` | `GPL-002:belowLevelOne`, `:levelOne`, … | A letter suffix carries no ID, so nothing could register them. |
| `INTENT-CREEP-001:attack`, `INTENT-CREEP-001:build`, `INTENT-CREEP-001:dismantle`, `INTENT-CREEP-001:heal`, `INTENT-CREEP-001:rangedHeal`, `INTENT-CREEP-001:rangedMassAttack`, `INTENT-CREEP-001:repair` | One key per pair, `:<blocker>Blocks<blocked>` (`:healBlocksRangedHeal`) | The key was the blocking method, which named several pairs. |
| `LAB-RUN-001:H`, `LAB-RUN-001:L`, `LAB-RUN-001:O`, `LAB-RUN-001:X`, `LAB-RUN-001:Z` | Each reaction's product (`:OH` for H + O, `:UH2O`) | Keys were reagent pairs (`H+O`) that the old reporter cut at `+`, so one key covered every reaction with that first reagent. |
| `LAB-RUN-001:OH`, `LAB-RUN-001:ZK` | The same keys, now naming other reactions: check what they gate | They still match, but now name the H + O and Z + K reactions, where they named the ten reactions with OH as first reagent and ZK + UL. |
| `MOVE-COLLISION-003b` | `MOVE-COLLISION-003:hostile` (and `:sameOwner`) | A letter suffix carries no ID. |
| `POWER-GENERATE-OPS-001`, `POWER-GENERATE-OPS-002`, `POWER-GENERATE-OPS-003` (registered as `GENERATE-OPS-001`, `GENERATE-OPS-002`, `GENERATE-OPS-003`) | `POWER-GENERATE-001` (keyed by level), `POWER-GENERATE-002`, `POWER-GENERATE-003` | The old reporter read a three-segment ID from its second segment. |
| `STORE-SINGLE-001:extension` | `:extensionRcl0` … `:extensionRcl8` | An extension's capacity depends on the room level. |
| `ACTIONLOG-CREEP-001`, kebab-case keys | `ACTIONLOG-CREEP-001:attack` → `:attackTargetCoordinates`; `ACTIONLOG-CREEP-001:build` → `:buildSiteCoordinates`; `ACTIONLOG-CREEP-001:harvest` → `:harvestSourceCoordinates`; `ACTIONLOG-CREEP-001:heal` → `:healTargetCoordinates`; `ACTIONLOG-CREEP-001:ranged` → `:rangedHealTargetCoordinates`; `ACTIONLOG-CREEP-001:repair` → `:repairStructureCoordinates`; `ACTIONLOG-CREEP-001:reserve` → `:reserveControllerCoordinates`; `ACTIONLOG-CREEP-001:upgrade` → `:upgradeControllerCoordinates` | Keys were kebab-case (`:not-owner`), which the old reporter cut at the first `-`. |
| `ACTIONLOG-STRUCT-001`, kebab-case keys | `ACTIONLOG-STRUCT-001:lab` → `:labRunReactionReagentCoordinates`, `:labReverseReactionOutputCoordinates`; `ACTIONLOG-STRUCT-001:link` → `:linkTransferTargetCoordinates`; `ACTIONLOG-STRUCT-001:tower` → `:towerAttackTargetCoordinates`, `:towerHealTargetCoordinates`, `:towerRepairTargetCoordinates` | Keys were kebab-case (`:not-owner`), which the old reporter cut at the first `-`. |
| `ACTIONLOG-TARGET-001`, kebab-case keys | `ACTIONLOG-TARGET-001:creep` → `:creepDamagedByCreep`, `:creepHealedByCreep`, `:creepDamagedByTower`, `:creepHealedByTower` | Keys were kebab-case (`:not-owner`), which the old reporter cut at the first `-`. |
| `NUKE-FLIGHT-004`, kebab-case keys | `NUKE-FLIGHT-004:launch` → `:launchRoomDoesNotListTargetNuke`; `NUKE-FLIGHT-004:target` → `:targetRoomVisibleToTargetOwner`, `:targetRoomHiddenFromLauncherWithoutVisibility` | Keys were kebab-case (`:not-owner`), which the old reporter cut at the first `-`. |
| `NUKE-LAUNCH-008`, kebab-case keys | `NUKE-LAUNCH-008:not` → `:notOwner`; `NUKE-LAUNCH-008:invalid` → `:invalidArgumentShape`; `NUKE-LAUNCH-008:inactive` → `:inactiveRcl`, `:inactiveRclBeforeOutOfRange`, `:inactiveRclBeforeMissingEnergy`, `:inactiveRclBeforeMissingGhodium`; `NUKE-LAUNCH-008:out` → `:outOfRange`; `NUKE-LAUNCH-008:missing` → `:missingEnergy`, `:missingGhodium`; `NUKE-LAUNCH-008:range` → `:outOfRangeBeforeMissingEnergy`, `:outOfRangeBeforeMissingGhodium`; `NUKE-LAUNCH-008:cooldown` → `:cooldown` still matches, the condition alone; its pairs are now `:cooldownBeforeInactiveRcl`, `:cooldownBeforeOutOfRange`, `:cooldownBeforeMissingEnergy`, `:cooldownBeforeMissingGhodium` | Keys were kebab-case (`:not-owner`), which the old reporter cut at the first `-`. |
| `NUKER-PROPS-001`, kebab-case keys | `NUKER-PROPS-001:energy` → `:energyAlias`, `:energyCapacityAlias`; `NUKER-PROPS-001:ghodium` → `:ghodiumAlias`, `:ghodiumCapacityAlias` | Keys were kebab-case (`:not-owner`), which the old reporter cut at the first `-`. |
| `ROOM-EVENTLOG-026`, kebab-case keys | `ROOM-EVENTLOG-026:attack` → `:attackObjectIsNukeTargetIsStructure`; `ROOM-EVENTLOG-026:rampart` → `:rampartAttackEntryPrecedesCoveredStructure`; `ROOM-EVENTLOG-026:roomwide` → `:roomwideCreepKillEmitsNoAttackEvent` | Keys were kebab-case (`:not-owner`), which the old reporter cut at the first `-`. |

**Validation pairs that went.** Each pair's second condition can't hold
alongside its first: the first replaces the object the second needs (a
source standing in for a controller, a container for a mineral), or a
spawning creep holds nothing, so busy already implies not-enough. Their tests
had set up only the first condition; the fixture now fails a pair that doesn't
establish both. `BOOST-CREEP-010:invalidTargetBeforeNotFound` went because
its invalid target is now a source, which has no body parts for `:notFound`
to search. Register the pair's first condition instead:

`BOOST-CREEP-010:invalidTargetBeforeNotFound`, `BUILD-011:busyBeforeNotEnough`, `BUILD-011:invalidTargetBeforeBlockedTarget`, `CTRL-ATTACK-007:invalidTargetBeforeCooldown`, `CTRL-ATTACK-007:invalidTargetBeforeInvalidControllerState`, `CTRL-CLAIM-008:busyBeforeInvalidControllerState`, `CTRL-CLAIM-008:invalidTargetBeforeInvalidControllerState`, `CTRL-GENSAFE-005:busyBeforeNotEnough`, `CTRL-RESERVE-008:busyBeforeInvalidControllerState`, `CTRL-RESERVE-008:invalidTargetBeforeInvalidControllerState`, `CTRL-UPGRADE-013:busyBeforeNotEnough`, `CTRL-UPGRADE-013:invalidTargetBeforeNotOwnerController`, `CTRL-UPGRADE-013:invalidTargetBeforeUpgradeBlocked`, `DEPOSIT-HARVEST-006:invalidTargetBeforeCooldown`, `DROP-011:busyBeforeNotEnough`, `FACTORY-PRODUCE-011:invalidArgsBeforeFull`, `FACTORY-PRODUCE-011:invalidArgsBeforeLevelMismatch`, `FACTORY-PRODUCE-011:invalidArgsBeforeNotEnough`, `FACTORY-PRODUCE-011:invalidArgsBeforePowerEffect`, `HARVEST-015:invalidTargetBeforeDepleted`, `HARVEST-MINERAL-014:invalidTargetBeforeCooldown`, `HARVEST-MINERAL-014:invalidTargetBeforeDepleted`, `HARVEST-MINERAL-014:invalidTargetBeforeExtractorNotOwner`, `HARVEST-MINERAL-014:invalidTargetBeforeInactiveExtractor`, `HARVEST-MINERAL-014:invalidTargetBeforeNoExtractor`, `HARVEST-MINERAL-014:noExtractorBeforeCooldown`, `HARVEST-MINERAL-014:noExtractorBeforeExtractorNotOwner`, `HARVEST-MINERAL-014:noExtractorBeforeInactiveExtractor`, `LAB-REVERSE-013:invalidTargetBeforeSameLab`, `LAB-RUN-013:invalidTargetBeforeInvalidArgs`, `LAB-RUN-013:invalidTargetBeforeNotEnough`, `LAB-RUN-013:invalidTargetBeforeRange`, `OBSERVER-007:invalidArgsBeforeRange`, `RECYCLE-CREEP-005:invalidTargetBeforeNotOwnerCreep`, `RENEW-CREEP-011:invalidTargetBeforeFull`, `REPAIR-010:busyBeforeNotEnough`, `SPAWN-CREATE-014:invalidBodyBeforeNotEnough`, `TERMINAL-SEND-013:invalidRoomBeforeNotEnoughEnergyCost`, `TRANSFER-015:busyBeforeNotEnough`, `TRANSFER-015:invalidArgsBeforeFullAmount`, `TRANSFER-015:invalidArgsBeforeNotEnoughAmount`, `TRANSFER-015:invalidCapacityBeforeFull`, `TRANSFER-015:invalidCapacityBeforeFullAmount`, `TRANSFER-015:invalidTargetBeforeFull`, `TRANSFER-015:invalidTargetBeforeFullAmount`, `TRANSFER-015:invalidTargetBeforeInvalidCapacity`, `WITHDRAW-017:busyBeforeFullAmount`, `WITHDRAW-017:invalidArgsBeforeFullAmount`, `WITHDRAW-017:invalidArgsBeforeNotEnough`, `WITHDRAW-017:invalidCapacityBeforeNotEnough`, `WITHDRAW-017:invalidTargetBeforeInvalidCapacity`, `WITHDRAW-017:invalidTargetBeforeInvalidNuker`.

### Catalog changes that need no action

None of these stops a registration matching. Each can surface a new failure
on your engine, which the row's text explains, and a restated row can also
turn a registered gap into an unexpected pass, which fails the run.

- **Keyed by case.** These rows' tests were one test, or several the old
  reporter read as one bare ID, and now run one test per case, keyed
  `ID:case`. A bare
  registration still covers every case; register one case to narrow a gap:
  `BOOST-AGGREGATION-001`, `BOOST-ATTACK-001`, `BOOST-BUILD-001`, `BOOST-BUILD-002`, `BOOST-CARRY-001`, `BOOST-DISMANTLE-001`, `BOOST-HARVEST-001`, `BOOST-HARVEST-002`, `BOOST-HEAL-001`, `BOOST-MOVE-001`, `BOOST-RANGED-001`, `BOOST-TOUGH-001`, `BOOST-UPGRADE-001`, `COMBAT-HEAL-003`, `COMBAT-MELEE-005`, `COMBAT-MELEE-006`, `COMBAT-MELEE-007`, `COMBAT-RANGED-005`, `COMBAT-RMA-002`, `COMBAT-SIMULT-001`, `CONSTRUCTION-SITE-009`, `CONSTRUCTION-SITE-017`, `CREEP-DEATH-008`, `CTRL-DOWNGRADE-009`, `CTRL-DOWNGRADE-010`, `CTRL-STRUCTLIMIT-001`, `CTRL-STRUCTLIMIT-002`, `CTRL-UPGRADE-007`, `CTRL-UPGRADE-012`, `DEPOSIT-001`, `DEPRECATED-PATH-002`, `DEPRECATED-PATH-003`, `EFFECT-HOST-001`, `INTENT-CREEP-002`, `INTENT-CREEP-003`, `INTENT-CREEP-004`, `INTENT-LIMIT-001`, `INTENT-LIMIT-002`, `INVADER-CORE-004`, `INVADER-RAID-009`, `KEEPER-LAIR-002`, `MARKET-DEAL-003`, `MARKET-ORDER-002`, `MARKET-ORDER-006`, `MARKET-ORDER-008`, `MINERAL-POWER-001`, `MOVE-BASIC-001`, `MOVE-COLLISION-003`, `MOVE-COLLISION-005`, `NPC-OWNERSHIP-001`, `NUKE-IMPACT-014`, `PORTAL-001`, `PORTAL-004`, `POWER-COMBAT-001`, `POWER-DISRUPT-001`, `POWER-DISRUPT-002`, `POWER-DISRUPT-003`, `POWER-OPERATE-001`, `POWER-OPERATE-002`, `POWER-OPERATE-005`, `POWER-REGEN-002`, `POWER-SPAWN-002`, `POWERCREEP-CREATE-002`, `POWERCREEP-ENABLE-002`, `POWERCREEP-RENEW-002`, `POWERCREEP-SPAWN-002`, `POWERCREEP-UPGRADE-002`, `RAMPART-DECAY-003`, `RAWMEMORY-002`, `ROAD-WEAR-001`, `ROOM-ENERGY-001`, `ROOM-ENERGY-002`, `ROOM-EVENTLOG-002`, `ROOM-TERRAIN-001`, `ROOMPOS-SPATIAL-005`, `RUIN-002`, `SHARD-PCREEP-001`, `SOURCE-POWER-001`, `SOURCE-REGEN-001`, `STORE-ACCESS-001`, `STORE-OPEN-003`, `STORE-RESTRICTED-002`, `STORE-RESTRICTED-003`, `STORE-RESTRICTED-005`, `STORE-SINGLE-002`, `STORE-SINGLE-003`, `STORE-SINGLE-004`, `STRONGHOLD-LAYOUT-001`, `TIMER-COOLDOWN-001`, `TIMER-SAFEMODE-001`, `TOWER-ATTACK-002`, `TOWER-ATTACK-003`, `TOWER-HEAL-002`, `TOWER-HEAL-003`, `TOWER-INTENT-002`, `TOWER-POWER-001`, `TOWER-REPAIR-002`, `TOWER-REPAIR-003`, `TRANSFER-002`, `UNDOC-IDCTOR-001`, `UNDOC-JSONOBJ-001`, `UNDOC-MEMHACK-011`, `UNDOC-STALERECV-002`, `WALL-002`, `WITHDRAW-002`, `WITHDRAW-006`.
- **New rows:** `CTRL-UPGRADE-017` (a level-up adds a safe-mode charge),
  `GCL-001` (`Game.gcl`'s values, keyed by level edge), `INVADER-CORE-006`
  (an invader core's fresh reservation), `MEMORY-007` (each object's `memory`
  is its `Memory` collection entry), `POWERCREEP-ENABLE-003` (`usePower()` in
  a room without power enabled returns `ERR_INVALID_ARGS`; split from
  `POWER-OPERATE-005`), `ROOM-EVENTLOG-028` (a deposit harvest logs
  `EVENT_HARVEST`; fails on vanilla, registered there), `ROOM-TERRAIN-004`
  (`getRawBuffer(destinationArray)` fills and returns the array),
  `ROOM-TERRAIN-005` (`getRawBuffer` with a non-typed array returns
  `ERR_INVALID_ARGS`; fails on vanilla and xxscreeps), `SPAWN-CREATE-015`
  (the default order a spawn draws energy from), `TERMINAL-SEND-015` (a
  send's energy cost wraps across opposite world edges) and
  `TOWER-ATTACK-006` (a tower attack on an object under a rampart hits the
  rampart). `POWER-GENERATE-001` to `-003` are renamed rows; see the key
  table above.
- **New validation conditions,** each run alone and in pairs: vanilla
  branches no row had covered. `BOOST-CREEP-010` `:spawning` and
  `:tooManyParts`; `:fortified` (a target under `PWR_FORTIFY`) in
  `COMBAT-MELEE-009`, `COMBAT-RANGED-007` and `DISMANTLE-009`;
  `CONSTRUCTION-SITE-011` `:invalidCoords`, `:invalidType`, `:wallTerrain`,
  `:nameCreatedThisTick` and `:nameTaken`; `CTRL-ATTACK-007:invulnerable` (a
  stronghold's controller); `CTRL-CLAIM-008` `:novice` and `:notController`;
  `CTRL-RESERVE-008` `:notController` and `:hostileReservation`;
  `CTRL-SAFEMODE-009:upgradeBlocked`; `DROP-011:notEnoughAmount`;
  `FLAG-009:invalidSecondaryColor`; `LAB-RUN-013` and `LAB-REVERSE-013`
  `:missingLab1` and `:selfLab1`; `LINK-014:noController`;
  `POWERCREEP-UPGRADE-002:powerMaxLevel`; `:rcl`, an inactive spawn, in
  `SPAWN-CREATE-014`, `RENEW-CREEP-011` and `RECYCLE-CREEP-005`;
  `SPAWN-CREATE-014` `:missingName`, `:invalidOptions` and `:nameTaken`;
  `RENEW-CREEP-011` `:spawningTarget` and `:notOwnerCreep`;
  `RECYCLE-CREEP-005:spawningTarget`; and
  `STRUCTURE-API-007:neutralController`.
- **Restated rows,** whose claim changed to match vanilla or the docs:
  `DISMANTLE-002` (energy is `floor(hits × DISMANTLE_COST)`),
  `RECYCLE-CREEP-002` (recycling returns the body at the full rate, not
  `CREEP_CORPSE_RATE`), `RENEW-CREEP-003` (the cost is
  `ceil(SPAWN_RENEW_RATIO × bodyCost / CREEP_SPAWN_TIME / body.length)`),
  `CTRL-RESERVE-010` (no `EVENT_RESERVE_CONTROLLER`), `ROOMPOS-001`
  (out-of-range coordinates throw), `COMBAT-MELEE-006` (any rampart on the
  attacker's tile stops the hit-back), `COMBAT-SIMULT-003` (lethal damage a
  same-tick heal outweighs leaves the net hits), `MOVE-COLLISION-005` (any
  stationary creep blocks), `ROOM-EVENTLOG-002` (a mineral harvest logs the
  WORK parts' harvest power), `SOURCE-REGEN-006` (the next regeneration
  refills to the new capacity), `STRUCTURE-HITS-001` (a built structure's
  starting hits), `INTENT-RESOURCE-002` to `-004`, `STORE-SINGLE-001`/`-002`,
  `STORE-RESTRICTED-005`, `POWER-COMBAT-003`, `CTRL-DOWNGRADE-006`/`-007`,
  `CTRL-DOWNGRADE-009`/`-010` (the step to level 0 too), `ROOM-TERRAIN-002`
  (every buffer element), `PATHFINDER-016`, `-021`, `-022` and `-023` (a
  weighted search's cost, complete paths within `maxOps: 2000`, the neighbour
  a directed search never loads), `CTRL-GENSAFE-001`, `CTRL-STRUCTLIMIT-001`
  (the types `isActive()` counts;
  the farthest structure is the inactive one), `FACTORY-COMMODITY-001`,
  `UNDOC-GLOBAL-004`, `UNDOC-SYSUSER-001` (`'Screeps'`), `SHARD-PCREEP-001`
  and `-002` (`-002` now runs on one shard), `CPU-SHARD-001`, `-003` and
  `-004` (what the API docs state), `DEPRECATED-PATH-001` (`PathFinder.use`'s toggle
  reaches `Room.findPath` only on a global's first tick), `MAP-ROOM-005`
  (worlds straddling the map origin), `SPAWN-TIMING-005`,
  `POWER-OPERATE-001` and `POWER-DISRUPT-001` (the magnitudes and durations
  no target row owns), and `CONSTRUCTION-SITE-008`, `-010`,
  `COMBAT-MELEE-007` and `COMBAT-RANGED-005`, each narrowed to what the
  validation rows don't own.
- **Exact values.** Tests pin vanilla's exact outcome where they had accepted
  a range or either of two results; `UNDOC-STALEARG-001`, which had accepted
  either a return code or an error for each case, is one.

### Package

- `'screeps-ok'` resolves to compiled JavaScript and declarations in `dist/`,
  so your `tsc` reads declarations under `skipLibCheck` instead of checking
  the framework's source under your compiler flags. `npm install` builds
  `dist/`, in a clone and for a git dependency alike (`npm run build` rebuilds
  it); a repository that links the clone (`npm i -D file:../screeps-ok`)
  reads it there. Inside the suite, vitest resolves `'screeps-ok'` to `src/`, the copy
  the tests import.
- The starter adapter (`starter/xxscreeps/`) and the shipped
  `parity/xxscreeps.json` base are regenerated for this contract.
