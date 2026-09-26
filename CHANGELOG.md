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
- `behaviors.md` rows can carry their own `capability:` tag on top of their
  section's; `npm run validate:capabilities` checks both.
- A test's ID is the one catalog ID its name carries, and a test's `:row`
  wins over a describe's bare ID: `CTRL-STRUCTLIMIT-002`'s tests are now
  `CTRL-STRUCTLIMIT-002:<structureType>`, not the bare ID. A name that runs on
  past an ID (`GPL-002a`, `POWER-GENERATE-OPS-001`) carries none.

### Catalog IDs your `parity.json` may name

- Renamed: `POWER-GENERATE-OPS-001`..`-003` → `POWER-GENERATE-001`..`-003`.
  Three-segment IDs never matched the reporter.
- Now keyed by row: `UNDOC-JSONOBJ-001:<objectKey>`,
  `POWER-GENERATE-001:level<One…Five>`, `GPL-002` by level edge
  (`:belowLevelOne`, `:levelOne`, …; was `GPL-002a`..`e`, which no
  registration could match), `SOURCE-POWER-001` and `MINERAL-POWER-001` by
  level, `POWER-OPERATE-005` and `POWER-DISRUPT-003`
  by power and case (`…Valid`, `…Invalid`, `…Disabled`).
- Dropped: `LEGACY-PATH-010`, `RENEW-CREEP-012`..`-014`,
  `ATTACK-NOTIFY-001`..`-004`, `CONSTRUCTION-SITE-015`, `POWER-BANK-003`,
  `STRUCTURE-API-008`, `RAMPART-DECAY-005`.
- Re-scoped: `MAP-ROOM-005` covers worlds that straddle the map origin, and
  `SPAWN-TIMING-005`'s test now exercises its row (directions ignored on a
  one-tick `PWR_OPERATE_SPAWN` spawn).
- The starter adapter (`starter/xxscreeps/`) and the shipped
  `parity/xxscreeps.json` base are regenerated for this contract.
