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
change. The first versioned release is the beta, cut with the first npm
publish; until then consumers track `master` and this section.

## Unreleased

Consumer-facing changes from the September 2026 framework review. Earlier
changes since `v0.1.0-alpha` are not itemized.

### Adapter contract

- `tick(count, options)` takes `options.signal`, an `AbortSignal`. Check it
  before each of the `count` ticks and throw `signal.reason` once it is
  aborted. The test fixture aborts it when a test ends, so a timed-out test
  can no longer tick a server the next test reuses.
- `RoomSpec.powerEnabled` sets the controller's `isPowerEnabled` (default
  false). `placePowerCreep` must no longer enable power in its room; a test
  whose power creep calls `usePower` in a controlled room sets the flag.
- Every room is walled at its four corners, over the default terrain,
  `RoomSpec.terrain` and `setTerrain()` alike.
- Snapshots report the player getter's value on the tick: no defaults, no
  clamps, `undefined` becomes `null`, and `storeCapacity` is
  `store.getCapacity()`.
- `placePowerCreep` derives `hits`/`hitsMax` as `1000 * (level + 1)` and store
  capacity as `100 * (level + 1)`.
- Placement rejects a `cooldown` on a structure with no public cooldown.
- World size is engine-reported: the world must contain the spec rooms, and
  tests read `Game.map.getWorldSize()` under the `liveWorldSize` capability.
  Spec rooms may sit on either side of the map origin (e.g. `E1S1`).
- A player tick the engine aborts is `RunPlayerError('runtime')`.
- `screeps-ok` exports `withCornerWalls` and `MarketOrderSpec`, which the
  starter adapter imports; it had not compiled against the package.
- The `strongholdMetadata` capability is gone, and `InvaderCoreSnapshot` no
  longer carries `templateName` or `strongholdId`: no player getter exposes
  them. Drop the flag and the snapshot fields; both stay `placeObject` inputs
  for an invader core.
- `ScreepsOkAdapter.limitations` is gone, with `AdapterLimitation`,
  `AdapterLimitations` and `limitationGated`: all three limitations were
  closed, and an engine couldn't add one of its own. Drop the field; a test
  your engine can't run goes under `skips` in your `parity.json`.
- `PlayerSpec.gcl` is `{ level, progress? }` (`GclSpec`), as `Game.gcl` reads
  it, where it was a number the two reference adapters read as points and as
  a level. `gclPoints()` converts it to the points your engine stores; write
  them to the user record the engine's claim check reads. The default is the
  rooms the player owns plus one, at least 2 (it was 10,000,000 points, level
  3, on vanilla). `PlayerSpec.power` states its default: 10,000,000 points.
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
- Capability flags are literals, never derived from whether an import or probe
  succeeded, and an adapter never manufactures an outcome the engine didn't
  produce: no resets, fallbacks, or clamps.
- `setTerrain()` is setup-only: before the shard's first tick it replaces the
  terrain player code reads, and after it the call throws and changes
  nothing. An adapter had been allowed to accept it after a tick.

### Parity and the runner

- A full run (no filter, no `--shard`; CI checks the merged shards) fails when
  a registered test ID matched no test that passed or failed: a typo, a
  renamed or dropped ID, or a test your adapter skips for a missing
  capability. Drop a base gap your engine can't run with `expected_passes`.
- A run fails on an unexpected pass even when vitest itself exited 0.
- A test file that fails to collect, or an unhandled error, is a genuine
  failure rather than being forgiven when every failed test is registered.
- A malformed `parity.json` or an `extends` that doesn't resolve fails the
  run instead of loading no registrations.
- `parity.json` is checked when it loads. Each gap needs `actual`,
  `expected` and a non-empty `tests` of catalog test IDs; an unknown key (the
  legacy `summary` and `status` included), a test ID under two gaps, and an
  `expected_passes` entry the base doesn't register fail the run.
- A failing vitest run is forgiven only when it has registered failures to
  forgive; one that fails for a reason the reporter doesn't see (no test file
  matched, say) stays failed.
- `behaviors.md` rows can carry their own `capability:` tag on top of their
  section's. A test of a tagged row fails when it ends without having called
  `shard.requires()` for each tag, so an ungated test can't run on an adapter
  that lacks the capability; gates a matrix passes as data count.
- A test's ID is the one catalog ID its name carries, and a test's `:row`
  wins over a describe's bare ID. A name that runs on past an ID
  (`GPL-002a`, `POWER-GENERATE-OPS-001`) carries none.
- Registering a bare ID gates every `:row` test of it, as the adapter guide
  documented; a row's own registration wins. Before, a bare registration
  matched only tests named with the bare ID.
- A test under `tests/NN-*/` (other than `00-*`) whose name carries no
  catalog ID, or two, fails the run: nothing could register or cover it.
- Only an unfiltered run writes `reports/<name>.json`. A filtered or sharded
  run (any vitest argument, `--shard` included) writes
  `reports/<name>-partial.json`, and vitest run directly writes no report. A
  CI that shards the suite collects `<name>-partial.json` from each shard.
- `parity.json` takes `skips`, for tests your engine can't run at all (one
  that hangs a tick, say): `{ "<skip id>": { "why": "…", "tests": [ids] } }`.
  The fixture skips them before they touch the adapter, the reporter lists
  them, and status shows each `why`. A skip that names no test is orphaned on
  a full run, and a test ID is skipped or registered as a gap, not both.

### Catalog IDs your `parity.json` may name

- Renamed: `POWER-GENERATE-OPS-001`..`-003` → `POWER-GENERATE-001`..`-003`.
  Three-segment IDs never matched the reporter.
- Now keyed by row: `UNDOC-JSONOBJ-001:<objectKey>`,
  `POWER-GENERATE-001:level<One…Five>`, `GPL-002` by level edge
  (`:belowLevelOne`, `:levelOne`, …; was `GPL-002a`..`e`, which no
  registration could match), `SOURCE-POWER-001` and `MINERAL-POWER-001` by
  level, `POWER-OPERATE-005` and `POWER-DISRUPT-003`
  by power and case (`…Valid`, `…Invalid`).
- A `:row` key is one camelCase token, a letter then letters or digits
  (`LAB-REVERSE-001:GH2O`). The reporter used to cut a key at its first
  digit, `-` or `_`, so these rows only now register as written:
  `LAB-REVERSE-001` and `NUKE-IMPACT-014` unchanged; `NUKE-LAUNCH-008`,
  `NUKER-PROPS-001`, `NUKE-FLIGHT-004`, `ROOM-EVENTLOG-026` and
  `ACTIONLOG-CREEP/TARGET/STRUCT-001` re-keyed from kebab-case
  (`:not-owner` → `:notOwner`); `FACTORY-PRODUCE-001` and
  `FACTORY-COMMODITY-001` from the resource name (`:ghodium_melt` →
  `:ghodiumMelt`).
- Dropped: `LEGACY-PATH-010`, `RENEW-CREEP-012`..`-014`,
  `ATTACK-NOTIFY-001`..`-004`, `CONSTRUCTION-SITE-015`, `POWER-BANK-003`,
  `STRUCTURE-API-008`, `RAMPART-DECAY-005`, `ISM-001`, `ISM-003`, `ISM-004`,
  `ISM-006`: the API documentation states no value before the first
  `setLocal`, no rejection mode, no over-limit behavior and no cross-shard
  delay, and no open-source engine implements `InterShardMemory`.
  `ISM-005` no longer claims `null` for a shard that never wrote.
  `INTERSHARD-PORTAL-002` (a creep's `Memory` crossing shards: the docs say
  each shard's `Memory` is isolated), `CPU-SHARD-002` and `SHARD-MEMORY-002`
  (no documented source). `MOVE-FATIGUE-006`, merged into `BOOST-MOVE-001`,
  which owns the boosted MOVE part's fatigue reduction. `ROOM-TERRAIN-003`,
  `MAP-TERRAIN-002` and `MAP-TERRAIN-003`, which restated each other:
  section 16.5 owns `Room.Terrain` (`ROOM-TERRAIN-002` now pins every
  buffer element, and the new `ROOM-TERRAIN-004` owns
  `getRawBuffer(destinationArray)`), and 21.3's `MAP-TERRAIN-001` owns
  `Game.map.getRoomTerrain`. `STRUCTURE-ACTIVE-005`, which pinned the tie
  between equally distant structures to vanilla's storage scan order, an
  order nothing specifies.
- Dropped as restatements of another row, which now carries any test the
  dropped row had that it lacked (survivor in parentheses): `CTRL-RESERVE-005`
  (`-010`), `CTRL-DOWNGRADE-003` (`-012`), `CTRL-DOWNGRADE-004` (`-013`),
  `COMBAT-SIMULT-002`/`-004`/`-005` (`-001`), `TOWER-INTENT-001` (`-003`),
  `NUKE-LAUNCH-002` (`-012`), `NUKE-LAUNCH-004` and `NUKE-FLIGHT-003`
  (`NUKE-FLIGHT-001`), `NUKE-IMPACT-002`/`-003` (`-014`), `NUKE-FLIGHT-005`
  (`NUKE-IMPACT-013`), `BOOST-CREEP-007`/`-008` (`BOOST-ATTACK-001`,
  `BOOST-HEAL-001`), `SPAWN-CREATE-003` (`-008`), `CREEP-SPAWNING-001`
  (`SPAWN-TIMING-002`), `CREEP-SPAWNING-003` (`-007`), `RAMPART-PROTECT-001`
  (the new `TOWER-ATTACK-006`), `RAMPART-PROTECT-002` (`COMBAT-MELEE-005`),
  `PORTAL-005` (`-001`), `FLAG-003` (`-008`), `DEPOSIT-005` (`-002`),
  `EXTENSION-001`/`-002` (`ROOM-ENERGY-001`/`-002`), `STRUCTURE-ACTIVE-001`
  (`CTRL-STRUCTLIMIT-001:closestFirst`), `STRUCTURE-ACTIVE-003`
  (`CTRL-STRUCTLIMIT-002`), `STRUCTURE-HITS-004`/`-005` (`RUIN-004`/`-005`),
  `CONSTRUCTION-COST-002` (`-001`), `TOMBSTONE-002` (`CREEP-DEATH-006`),
  `CREEP-DEATH-002` (`TOMBSTONE-001`), `POWERCREEP-MOVE-002`
  (`ROAD-WEAR-001:powerCreep`), `POWER-OPERATE-003` (`OBSERVER-003`),
  `POWER-OPERATE-004` (`FACTORY-COMMODITY-003`), `UNDOC-CTOR-001`..`-008`
  (`UNDOC-IDCTOR-001`), `DROP-DECAY-004` (`HARVEST-006`),
  `STORE-RESTRICTED-001` (`-002`).
- A validation matrix owns its method's failure codes: its row lists each
  condition and code in check order, and a row that restated one of its
  cases is dropped (the case that owns it now in parentheses; a row's extra
  forms became new conditions, keyed and paired like the rest).
  `MOVE-BASIC-003` (`MOVE-BASIC-027:fatigue`), `-004` (`:noBodypart`),
  `-005` (`:invalidArgs`), `-007` (`:range`, new), `-023` (`:notOwner`),
  `-024` (`:busy`); `MOVE-PULL-004` (`MOVE-PULL-011:range`),
  `MOVE-PULL-007:self` (`:self`, new), `:nonCreep` (`:invalidTarget`),
  `:spawning` (`:spawningTarget`, new). `HARVEST-002` (`HARVEST-015:range`),
  `-003` (`:noBodypart`), `-004` (`:depleted`), `-010` (`:hostileRoom`, and
  `:hostileReservation`, new), `-011` (`:notOwner`), `-012` (`:busy`),
  `-013` (`:noTarget`, `:nullTarget` and `:plainObjectTarget`, new, and
  `:invalidTarget`); `HARVEST-MINERAL-004` (`HARVEST-MINERAL-014:depleted`),
  `-006` (`:noExtractor`), `-007` (`:extractorNotOwner`), `-008`
  (`:inactiveExtractor`), `-009` (`:cooldown`), `-010` (`:range`);
  `DEPOSIT-HARVEST-002` (`DEPOSIT-HARVEST-006:range`), `-003`
  (`:cooldown`). `TRANSFER-003` (`TRANSFER-015:range`), `-004`
  (`:notEnough`), `-005` (`:invalidArgs`, now a negative amount alone, and
  `:invalidResource` and `:noResource`, new), `-006` (`:full`), `-007`
  (`:invalidTarget`, `:invalidCapacity`), `-008` (`:labMineral`, new),
  `-009` (`:notOwner`), `-010` (`:busy`), `-013` (`:fullAmount`);
  `WITHDRAW-003` (`WITHDRAW-017:range`), `-004` (`:notEnough`), `-005`
  (`:targetNotOwner`), `-007` (`:full`), `-008` (`:disruptedTerminal`, new),
  `-009` (`:notOwner`), `-010` (`:busy`), `-011` (`:invalidArgs`, now a
  negative amount alone, and `:invalidResource`, new), `-012`
  (`:safemodeNotOwner`), `-013` (`:invalidNuker`, and `:invalidPowerBank`,
  new), `-014` (`:invalidCapacity`), `-016` (`:fullAmount`, which now
  leaves the creep some free capacity); `PICKUP-003` (`PICKUP-010:range`),
  `-004` (`:full`), `-005` (`:notOwner`), `-006` (`:busy`), `-007`
  (`:invalidTarget`); `DROP-004` (`DROP-011:notEnough`), `-005`
  (`:notOwner`), `-006` (`:busy`), `-007` (`:invalidArgs`), and the new
  `:notEnoughAmount`. `BUILD-003` (`BUILD-011:range`), `-007`
  (`:noBodypart`), `-008` (`:notEnough`); `REPAIR-003` (`REPAIR-010:range`),
  `-004` (`:notEnough`), `-007` (`:noBodypart`); `DISMANTLE-003`
  (`DISMANTLE-009:range`), `-005` (`:noBodypart`); `CONSTRUCTION-SITE-002`
  (`CONSTRUCTION-SITE-011:siteCapFull`), `-003` (`:rclOrStructureCap`),
  `-007` (`:invalidTarget`), `-014` (`:hostileReservation`, new), with new
  `:invalidCoords`, `:invalidType` and `:wallTerrain`.
  `CONSTRUCTION-SITE-008` keeps only that a road may be placed on a wall,
  and `CONSTRUCTION-SITE-010` only `RoomPosition.createConstructionSite()`'s
  delegation. `CTRL-CLAIM-002` (`CTRL-CLAIM-008:noBodypart`), `-003`
  (`:invalidControllerState`, and `:hostileReservation`, new), `-004`
  (`:range`), `-005` (`:gclNotEnough`), `-006` (`:invalidControllerState`);
  `CTRL-RESERVE-002` (`CTRL-RESERVE-008:noBodypart`), `-003`
  (`:invalidControllerState`), `-004` (`:range`), with the new
  `:hostileReservation`; `CTRL-ATTACK-002` (`CTRL-ATTACK-007:noBodypart`),
  `-004` (`:range`), `-006` (`:invalidControllerState`); `CTRL-SIGN-002`
  (`CTRL-SIGN-004:range`); `CTRL-UPGRADE-003` (`CTRL-UPGRADE-013:range`),
  `-004` and `-014` (`:notEnough`), `-009` (`:upgradeBlocked`);
  `CTRL-GENSAFE-002` (`CTRL-GENSAFE-005:range`), `-004` (`:notEnough`);
  `CTRL-SAFEMODE-003` (`CTRL-SAFEMODE-009:notEnough`), `-004` (`:cooldown`),
  `-005` (`:downgradeTimer`, new), `-007` (`:busy`), with the new
  `:upgradeBlocked`. `COMBAT-MELEE-002` (`COMBAT-MELEE-009:range`), `-003`
  (`:noBodypart`); `COMBAT-RANGED-002` (`COMBAT-RANGED-007:range`), `-004`
  (`:noBodypart`); `COMBAT-HEAL-005` (`COMBAT-HEAL-007:range`), `-006`
  (`:noBodypart`); `COMBAT-RANGEDHEAL-004` (`COMBAT-RANGEDHEAL-006:range`),
  `-005` (`:noBodypart`); `TOWER-ATTACK-004`, `TOWER-HEAL-004` and
  `TOWER-REPAIR-004` (each matrix's `:notEnough`); `NUKE-LAUNCH-005`
  (`NUKE-LAUNCH-008:missingEnergy`, `:missingGhodium`), `-006`
  (`:cooldown`), `-007` (`:outOfRange`), `-014` to `-017` (`:noviceSource`,
  `:respawnSource`, `:noviceTarget`, `:respawnTarget`, new, with
  `:noviceSourceBeforeCooldown`). `COMBAT-MELEE-007` and `COMBAT-RANGED-005`
  keep only the targets their method accepts. `BOOST-CREEP-004`
  (`BOOST-CREEP-010:range`), `-005` (`:notEnoughEnergy`,
  `:notEnoughMineral`), `-006` (`:notFound`); `UNBOOST-002`
  (`UNBOOST-006:notFound`), `-003` (`:range`). `SPAWN-CREATE-001`
  (`SPAWN-CREATE-014:invalidBody`), `-002` (`:oversizedBody`, new), `-007`
  (`:notEnoughSelected`, new), `-008` (`:nameExists`, and `:nameSpawning`,
  new), `-009` (`:busy`), `-012` (`:invalidPart`, new); `RENEW-CREEP-001`
  (`RENEW-CREEP-011:range`), `-007` (`:claimPart`, new), `-008`
  (`:notEnough`), `-009` (`:busy`), `-010` (`:full`); `RECYCLE-CREEP-004`
  (`RECYCLE-CREEP-005:range`). The three spawn matrices also gain `:rcl`, an
  inactive spawn. `LINK-004` (`LINK-014:selfTarget`, new), `-005`
  (`:invalidTarget`), `-006` (`:targetNotOwner`), `-007` (`:invalidArgs`),
  `-008` (`:cooldown`), `-009` (`:rcl`), `-010` (`:notEnoughAmount`, new),
  `-011` (`:full`), `-012` (`:range`). `LAB-RUN-005` (`LAB-RUN-013:range`,
  and `:rangeLab1`, new), `-006` (`:notEnough`, and `:notEnoughLab1`, new),
  `-007` (`:full`), `-008` (`:invalidArgs`, and `:noProduct`, new), `-009`
  (`:invalidTarget`, and `:invalidLab1`, `:notALab`, `:selfTarget`, new),
  `-010` (`:cooldown`), `-011` (`:rcl`), `-012` (`:notOwner`);
  `LAB-REVERSE-005` (`LAB-REVERSE-013:range`, now `lab1` alone, and
  `:rangeLab2`, new), `-006` (`:notEnough`), `-007` (`:full`, and
  `:fullLab2`, new), `-008` (`:invalidReversePair`, `:sameLab`), `-009`
  (`:invalidTarget`, and `:invalidLab1`, `:notALab`, `:selfTarget`, new),
  `-010` (`:cooldown`), `-011` (`:rcl`), `-012` (`:notOwner`);
  `FACTORY-PRODUCE-003` (`FACTORY-PRODUCE-011:notEnough`), `-004`
  (`:full`), `-005` (`:powerEffect`), `-006` (`:cooldown`), `-007`
  (`:rcl`), `-008` (`:invalidArgs`), `-009` (`:levelMismatch`), `-010`
  (`:notOwner`).
- New: `TOWER-ATTACK-006` (a tower's attack on an object under a rampart hits
  the rampart), whose test had run as `RAMPART-PROTECT-001`.
- New, from vanilla behavior nothing cataloged: `CTRL-UPGRADE-017` (a level-up
  adds a safe-mode charge), `SPAWN-CREATE-015` (the default spawn energy drain
  order), and `MEMORY-007`, keyed `:room`, `:spawn`, `:flag`, `:powerCreep`
  (each object's `memory` is its `Memory` collection entry).
  `CTRL-DOWNGRADE-009`/`-010` now cover the step to level 0 too and are keyed
  by landing level (`:levelOne`, `:levelZero`).
- New, promised by the API docs and failing on vanilla (registered in its
  `parity.json`): `ROOM-EVENTLOG-028` (a deposit harvest logs
  `EVENT_HARVEST`; needs `deposit`) and `ROOM-TERRAIN-005`
  (`getRawBuffer(destinationArray)` returns `ERR_INVALID_ARGS` for a
  non-typed array; xxscreeps fails it too).
- New: `GCL-001`, keyed by level edge (`:belowLevelTwo`, `:levelTwo`,
  `:levelThree`), pins `Game.gcl`'s values, where only its keys were pinned.
- Re-scoped to what the API documentation states: `CPU-SHARD-001` (this
  shard's entry equals `Game.cpu.limit`), `CPU-SHARD-003` (a changed total
  is `ERR_INVALID_ARGS`; now `behavior`), `CPU-SHARD-004` (`OK`, then
  `ERR_BUSY`), and `SHARD-PCREEP-002`, which now runs on one shard (a
  spawned power creep's `shard` is `Game.shard.name`) and no longer needs
  `multiShard`.
- `SOURCE-REGEN-001` is keyed by room state: `:owned`, `:reserved`,
  `:neutral`, `:keeper`.
- Keyed by row as their tests now run their case lists: `RAWMEMORY-002`
  (`:activeCount`, `:segmentId`, `:segmentSize`), `NPC-OWNERSHIP-001`
  (`:keeperLair`, `:powerBank`, `:invaderCore`), `ROAD-WEAR-001`
  (`:creepBody1`, `:creepBody5`, `:creepBody50`, `:powerCreep`).
- `CTRL-STRUCTLIMIT-001` covers the types `isActive()` counts (spawn,
  extension, link, tower, lab) and is keyed by type and level
  (`:extensionRcl2`); roads, walls, containers, ramparts and the one-per-room
  types were never counted.
- `UNDOC-STALEARG-001` pins vanilla's rejection for each case:
  `ERR_INVALID_TARGET`, and a runtime error for `:creepWithdrawStructure`. It
  had accepted either.
- Re-scoped: `MAP-ROOM-005` covers worlds that straddle the map origin, and
  `SPAWN-TIMING-005`'s test now exercises its row (directions ignored on a
  one-tick `PWR_OPERATE_SPAWN` spawn).
- Enumerated from vanilla's source, where each claimed a family no list
  spanned: `TIMER-COOLDOWN-001` (eleven cooldown-gated actions, now
  `matrix`), `TIMER-SAFEMODE-001` (ten safe-mode-refused actions, now
  `matrix`), `TOWER-ATTACK-003`/`-HEAL-003`/`-REPAIR-003` (six target
  classes; the controller and other hitless structures are accepted),
  `INTENT-CREEP-002`/`-003` (the creep methods and intent names), and
  `ROOM-EVENTLOG-002`, which named "the canonical event mapping" and now
  covers the five event sources no single-event row owns. Their tests still
  run the cases they did; they'll be keyed by case when they run the rest.
- Split: `POWER-OPERATE-005` keeps operate-power target validity (under
  `powerEffects`); `usePower()` returning `ERR_INVALID_ARGS` in a room
  without power enabled is the new `POWERCREEP-ENABLE-003`, keyed by power
  (`:operateSpawn`, …), which needs only `powerCreeps`.
- The starter adapter (`starter/xxscreeps/`) and the shipped
  `parity/xxscreeps.json` base are regenerated for this contract.
