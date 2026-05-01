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
- the handles `'sk'` and `'srcKeeper'` are reserved for NPC owners whose engine
  user ids have length `≤ 2` (`'sk'` → Invader id `'2'`, `'srcKeeper'` →
  Source Keeper id `'3'`). Tests use `'sk'` via
  `placeCreep({ owner: 'sk', ... })` to hit the zero-deposit-rate death branch
  (e.g. CREEP-DEATH-011); adapters must resolve both handles without requiring
  them to appear in `ShardSpec.players`.
- setup crosses the boundary as typed specs
- player code crosses the boundary as a `PlayerCode` string
- inspection crosses the boundary as plain JSON snapshots
- object IDs returned from setup helpers are opaque. Tests may pass them back to
  adapter methods, but must not assume any engine-specific format or meaning.

## Required Interface

Adapters must implement `ScreepsOkAdapter` from
[`src/adapter.ts`](../src/adapter.ts).

That includes:

- `capabilities`
- `createShard`
- typed placement helpers
- `placeObject`
- `setTerrain`
- `runPlayer`
- `runPlayers`
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
- provide the canonical default room layout for rooms without extra typed
  placements:
  plain terrain unless `RoomSpec.terrain` overrides it, exactly one controller
  at `(1,1)`, and no ambient sources, minerals, structures, or other room
  objects

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
- `placeStructure(..., { cooldown: 10 })` means a structure with a public
  cooldown starts with `10` ticks remaining.
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
- a top-level `undefined` return must be normalized to `null`
- returning a live game object must throw `RunPlayerError` with
  `errorKind = 'serialization'` (see [Game Object Detection](#game-object-detection))
- syntax failures must throw `RunPlayerError` with `errorKind = 'syntax'`
- runtime failures in the player code must throw `RunPlayerError` with
  `errorKind = 'runtime'`

Gameplay return codes such as `OK` or `ERR_NOT_IN_RANGE` are normal return
values, not errors.

#### Error Kind Classification

Adapters must classify errors by the phase in which the failure occurred.
Mapping all caught errors to `'runtime'` is a spec violation.

- **`syntax`**: errors thrown during code parsing or compilation, before any
  statements execute. Most engines surface these as a distinct `SyntaxError`
  type.
- **`runtime`**: errors thrown during code execution — `ReferenceError`,
  `TypeError`, explicit `throw`, and any other error that occurs after parsing
  succeeds.
- **`serialization`**: the code executed successfully but its return value is
  not JSON-safe, or is a live game object (see below).

#### Game Object Detection

A "live game object" is any return value whose `constructor` is not `Object`
or `Array` in the engine runtime, or whose `JSON.stringify()` produces lossy
output — for example, `{}` for an object that has visible properties when
accessed through the engine's API. Typical examples: a `Creep`, `Room`,
`Structure`, `RoomPosition`, or any other value returned by
`Game.getObjectById()`, `Game.rooms`, `Game.creeps`, etc.

Adapters must detect game objects at the return boundary and throw
`RunPlayerError('serialization', ...)` rather than silently returning the
degraded serialization. Plain `JSON.stringify()` is not sufficient detection
on its own — it may produce `{}` without throwing, which is a lossy success.

Recommended detection strategies:

- Check `result.constructor !== Object && !Array.isArray(result)` before
  serialization. This catches all engine class instances.
- As a fallback, verify the `JSON.stringify` round-trip:
  `Object.keys(result).length > 0 && Object.keys(JSON.parse(JSON.stringify(result))).length === 0`
  indicates lossy serialization.

This is a top-level check. The spec does not require deep inspection of
nested values inside arrays or plain objects. A return value of
`[creepInstance]` may serialize as `[{}]` without detection. Tests should
avoid returning collections that mix game objects and plain values.

#### Execution Confirmation

`runPlayer` must confirm that the supplied player code actually executed.

If the adapter's execution mechanism cannot confirm execution — for example,
the code injection path was not consumed, the engine silently skipped the
player, or the runner did not invoke the player's code — `runPlayer` must
throw a plain `Error` rather than returning `null`.

This is an adapter infrastructure failure, not a player-code failure, so
it must not use `RunPlayerError`.

The contract distinguishes:

- code explicitly evaluates to `undefined` → normalized to `null` (success)
- code was never executed → infrastructure error (throw)

### `runPlayers`

`runPlayers(codesByUser)` executes player code for multiple test handles against
the same current game state.

Required behavior:

- every supplied player observes the same pre-execution game state
- adapters must not advance gameplay between those per-player evaluations
- return values follow the same JSON-safe and top-level `undefined -> null`
  rules as `runPlayer()`
- if any supplied player code fails, the adapter must surface that as a
  `RunPlayerError`

This method exists for behaviors whose public contract depends on same-tick
multi-player observation, such as one player's state being visible to another
player in that same tick snapshot.

### `tick`

`tick(count?)` advances gameplay processing by exactly `count` ticks (default 1).

From the test side, the expected contract is:

- `runPlayer()` executes player code and advances time by exactly 1 tick.
  Intents submitted during that code are processed during that tick.
- `runPlayers()` executes multiple players against one shared state and
  advances time by exactly 1 tick.
- `tick(count?)` advances time by exactly `count` additional ticks (default 1).
  `tick()` must never be a no-op.

This means `runPlayer() + tick()` always advances time by exactly 2 ticks,
and `runPlayer()` alone advances by exactly 1. Tests should account for this
when asserting tick-sensitive state.

## Inspection Semantics

### `getObject`

`getObject(id)` returns a plain JSON snapshot or `null` if the object no longer
exists.

Snapshots must expose only public gameplay information. They must not leak
engine-private fields.

### `findInRoom`

The current shipped contract uses supported neutral `FIND_*` constants.

Supported constants are:

- `FIND_CREEPS`
- `FIND_STRUCTURES`
- `FIND_CONSTRUCTION_SITES`
- `FIND_SOURCES`
- `FIND_MINERALS`
- `FIND_TOMBSTONES`
- `FIND_DEPOSITS`
- `FIND_RUINS`
- `FIND_DROPPED_RESOURCES`

Inspection is perspective-neutral. There is no current-player context in test
inspection, so adapters must not accept or require player-relative `FIND_*`
constants such as `FIND_MY_CREEPS` or `FIND_HOSTILE_CREEPS` through this API.

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
- `portals`
- `invaderCore`

Rules:

- report `true` only when the adapter can exercise the public behavior
  meaningfully
- report `false` when the engine or adapter does not currently support the
  feature area
- capability-gated tests should skip when the capability is `false`
- capability-gated tests should use an explicit runtime skip helper rather than
  silently `return` from the test body

Adapter-specific skips are allowed only as documented exceptions.

They must:

- be narrowly scoped
- be explained inline in the test
- be documented in the README or adapter docs
- be routed through a shared limitation helper rather than ad hoc adapter-name
  checks where practical
- not become the default way to express missing feature support

The intended long-term model is capability-based skipping, not adapter-name
branching.

Suite coverage that is not implemented yet should use `test.todo`, not
`test.skip`.

## Error Model

`RunPlayerError` means the player-code execution contract failed, not gameplay.

Required kinds and their classification rules:

- `syntax` — code failed to parse. Must not be mapped to `runtime`.
- `runtime` — code parsed but threw during execution.
- `serialization` — code executed but returned a non-serializable or lossy
  value, typically a live game object.

See [Error Kind Classification](#error-kind-classification) for the full
requirements. The contract tests in `tests/00-adapter-contract/error-model.test.ts`
verify that adapters classify all three kinds correctly.

Adapters should preserve the engine's user-facing message in
`RunPlayerError.engineMessage` where possible.

## Versioning Guidance

Changes that break existing adapters should be treated as major contract
changes.

Examples:

- changing `findInRoom` constant semantics
- changing snapshot shapes incompatibly
- changing `runPlayer` error semantics

Adding new optional capabilities or new tests gated on those capabilities is
non-breaking.
