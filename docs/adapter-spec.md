# Adapter Spec

This document is the normative contract for adapters consumed by the current
`screeps-ok` package.

Where this document and the practical guide differ, this document wins.

## Scope

An adapter is the boundary between:

- the canonical `screeps-ok` test API
- an engine's setup, execution, and inspection APIs

The adapter must stay thin. It translates setup specs, executes player code in
the real game runtime, and serializes public game state back to plain JSON.

The adapter must not:

- expose engine-private objects or references to tests
- reimplement gameplay semantics that belong in the engine
- patch around engine bugs in ways that hide parity differences

## Core Invariants

- `createShard()` creates an isolated fresh world for each test.
- player handles such as `'p1'` and `'p2'` are opaque test-side identities;
  adapters map them to engine-specific user IDs internally and map them back in
  snapshots.
- setup crosses the boundary as typed specs
- player code crosses the boundary as a `PlayerCode` string
- inspection crosses the boundary as plain JSON snapshots
- object IDs returned from setup helpers are opaque. Tests may pass them back to
  adapter methods, but must not assume any engine-specific format or meaning.

## Required Interface

Adapters must implement `ScreepsOkAdapter` from
[`src/adapter.ts`](/Users/mrwise/Coding/Screeps/screeps-ok/src/adapter.ts).

That includes:

- `capabilities`
- `createShard`
- typed placement helpers
- `placeObject`
- `setTerrain`
- `runPlayer`
- `tick`
- `getObject`
- `findInRoom`
- `getGameTime`
- `getControllerPos`
- `teardown`

## Setup Semantics

### `createShard`

`createShard(spec)` must:

- reset prior test state completely
- declare the available player handles for the test
- create the requested rooms
- apply room ownership and controller level from `RoomSpec.owner` and
  `RoomSpec.rcl`

If a room has an owner and no explicit `rcl`, adapters should treat it as
controller level `1`.

### Typed placement helpers

Typed helpers are the primary setup path. Their semantics are exact, not
incremental.

Examples:

- `placeCreep(..., { store: { energy: 30 } })` means the creep starts with
  exactly `30` energy.
- `placeStructure(..., { store: { energy: 50 } })` means the structure starts
  with exactly `50` energy. Adapters must not add this on top of engine
  defaults.
- `placeSource(..., { energy: 0, energyCapacity: 3000 })` means a depleted
  source with known capacity.

`placeObject()` is an escape hatch for rare or newly added public objects. It
must not become the primary path for common gameplay setup.

### Terrain

`setTerrain()` is part of the contract, but adapters may reject it when the
engine cannot mutate terrain after shard creation. If so, the failure must be
explicit and actionable.

## Execution Semantics

### `runPlayer`

`runPlayer(userId, playerCode)` executes real player code for the given test
player handle.

Required behavior:

- code runs with normal Screeps globals such as `Game`, constants,
  `RoomPosition`, and `PathFinder`
- the last expression becomes the return value
- return values must be JSON-safe:
  - `number`
  - `string`
  - `boolean`
  - `null`
  - plain objects/arrays recursively composed of those types
- returning a live game object must throw `RunPlayerError` with
  `errorKind = 'serialization'`
- syntax failures must throw `RunPlayerError` with `errorKind = 'syntax'`
- runtime failures in the player code must throw `RunPlayerError` with
  `errorKind = 'runtime'`

Gameplay return codes such as `OK` or `ERR_NOT_IN_RANGE` are normal return
values, not errors.

### `tick`

`tick(count)` advances gameplay processing.

From the test side, the expected contract is:

- `runPlayer()` collects intents and returns a value
- `tick()` processes those intents and advances time

If an engine internally consumes time during player execution, the adapter must
normalize the observable behavior so tests still see the expected progression.

## Inspection Semantics

### `getObject`

`getObject(id)` returns a plain JSON snapshot or `null` if the object no longer
exists.

Snapshots must expose only public gameplay information. They must not leak
engine-private fields.

### `findInRoom`

The current shipped contract uses string selectors, not `FIND_*` constants.

Supported selectors are:

- `'creeps'`
- `'structures'`
- `'constructionSites'`
- `'sources'`
- `'minerals'`
- `'tombstones'`
- `'ruins'`
- `'droppedResources'`

Inspection is perspective-neutral. There is no current-player context in test
inspection, so adapters must not accept or require player-relative selectors
such as "my creeps" or "hostile creeps" through this API.

Tests should query the neutral collection and filter by `snapshot.owner` when
needed.

### Snapshot ownership and IDs

- `owner` values in snapshots must be mapped back to test handles such as
  `'p1'`, not raw engine user IDs
- snapshot IDs are opaque
- snapshots must be stable enough for assertions, but tests must not infer
  engine internals from ID shape

## Capabilities And Skip Policy

`capabilities` declares whether an adapter supports a public feature area.

Current capability flags are:

- `chemistry`
- `powerCreeps`
- `factory`
- `market`
- `observer`
- `nuke`
- `terrain`

Rules:

- report `true` only when the adapter can exercise the public behavior
  meaningfully
- report `false` when the engine or adapter does not currently support the
  feature area
- capability-gated tests should skip when the capability is `false`

Adapter-specific skips are allowed only as documented exceptions.

They must:

- be narrowly scoped
- be explained inline in the test
- be documented in the README or adapter docs
- not become the default way to express missing feature support

The intended long-term model is capability-based skipping, not adapter-name
branching.

## Error Model

`RunPlayerError` means the player-code execution contract failed, not gameplay.

Current kinds are:

- `syntax`
- `runtime`
- `serialization`

Adapters should preserve the engine's user-facing message in
`RunPlayerError.engineMessage` where possible.

## Versioning Guidance

Changes that break existing adapters should be treated as major contract
changes.

Examples:

- changing `findInRoom` selector semantics
- changing snapshot shapes incompatibly
- changing `runPlayer` error semantics

Adding new optional capabilities or new tests gated on those capabilities is
non-breaking.
