# Adapter Guide

This is the first practical guide for adding a new `screeps-ok` adapter.

It is intentionally implementation-oriented, not fully normative. The goal is
to help an engine author build a working adapter without reverse-engineering
the existing `vanilla` and `xxscreeps` adapters.

For the current normative contract, see
[`docs/adapter-spec.md`](/Users/mrwise/Coding/Screeps/screeps-ok/docs/adapter-spec.md).

The canonical tests live in `screeps-ok`. Your engine repository should own its
adapter and point the `screeps-ok` runner at it.

Typical downstream invocation:

```bash
npm exec screeps-ok -- --adapter ./test/screeps-ok-adapter.ts --preflight none
```

The `--preflight none` default is appropriate for new external adapters until
the suite grows a more general capability-specific preflight contract.

This guide follows the current shipped contract, which today uses supported
neutral `FIND_*` constants for `findInRoom`.

## What an Adapter Is

An adapter is the thin translation layer between:

- the `screeps-ok` test API
- your engine's setup and execution APIs

The adapter is responsible for:

- creating a fresh shard / world for each test
- mapping player handles like `'p1'` to engine-specific user identifiers
- placing typed test objects into the world
- running player code inside the engine runtime
- advancing ticks
- converting engine objects into plain JSON snapshots
- declaring which capabilities your engine supports

The adapter is not responsible for:

- redefining test behavior
- exposing engine internals to tests
- adding engine-specific assertions to the shared suite

If a behavior belongs to the public Screeps gameplay surface, it should be
tested here and made to work through the adapter.

## Core Rule: Preserve the Serialization Boundary

This project only works if test code and engine code never share object
references.

Treat this as a hard boundary:

- setup crosses the boundary as typed specs
- player code crosses the boundary as a string
- inspection crosses the boundary as plain JSON snapshots

Never let tests:

- receive live engine objects
- mutate engine internals directly
- inspect engine-private fields
- depend on engine-specific object identity or ID formats

If your adapter takes shortcuts here, it may pass local tests while defeating
the entire purpose of a cross-engine conformance suite.

## Required Contract

The adapter must implement `ScreepsOkAdapter` from `src/adapter.ts`.

In practice that means you need:

- `createShard`
- typed setup helpers like `placeCreep`, `placeStructure`, `placeSource`, etc.
- `runPlayer`
- `tick`
- `getObject`
- `findInRoom`
- `getGameTime`
- `teardown`
- `capabilities`

Build the simplest correct version first. Keep the adapter thin.

## Thin Adapter Means

A thin adapter:

- delegates gameplay semantics to the engine
- performs only the translation needed for setup, execution, and inspection
- does not reimplement gameplay logic in adapter code

Acceptable adapter logic:

- mapping player handles to user IDs
- building engine objects from typed setup specs
- converting engine objects to snapshot JSON
- turning engine errors into `RunPlayerError`

Bad adapter logic:

- manually simulating gameplay because the engine API is inconvenient
- inventing behavior that differs from vanilla
- patching tests around engine bugs instead of exposing them

If the engine cannot express a public behavior cleanly, that is an engine or
integration problem to solve, not something the adapter should paper over.

## Implementation Checklist

### 1. Create a Fresh World Per Test

Each test expects an isolated shard.

Your adapter should ensure that:

- previous test state is gone
- users do not leak between tests
- game time starts from a predictable baseline
- room ownership and placed objects are deterministic

If your engine reuses a shared process, reset the relevant world state fully in
`createShard` or `teardown`.

### 2. Map Player Handles

Tests use stable opaque handles like `'p1'` and `'p2'`.

Your adapter must:

- map test handles to engine user IDs internally
- map those IDs back to handles in snapshots
- never expose engine-specific user IDs to test code

This applies to:

- object owners
- controller reservations
- controller signs
- any username-bearing public surface exposed in snapshots

### 3. Support Typed Setup

Typed setup helpers are the preferred path. Their semantics must stay obvious.

Examples:

- `placeCreep(..., { store: { energy: 50 } })` means initial store contents
- `placeSource(..., { energy: 0, energyCapacity: 3000 })` means a depleted
  source with known capacity
- `RoomSpec.owner` and `RoomSpec.rcl` define controller ownership and level

Do not hide semantics behind vague generic object creation when a typed helper
exists.

`placeObject()` is an escape hatch for rare or new object types. It should not
be the primary way canonical tests set up common mechanics.

### 4. Execute Player Code in the Engine Runtime

`runPlayer` must execute a `PlayerCode` string in the real game runtime.

The code should have access to:

- `Game`
- Screeps globals and constants
- `RoomPosition`
- `PathFinder`

It must not get privileged access beyond what normal bot code has.

The last expression becomes the return value.

Allowed return values:

- number
- string
- boolean
- null
- plain JSON objects/arrays composed of those values

If the last expression evaluates to top-level `undefined`, normalize it to
`null` at the adapter boundary so tests do not depend on engine-specific
serialization artifacts.

If player code returns a live game object, `runPlayer` must reject it with
`RunPlayerError` rather than silently serializing engine objects.

If a behavior needs same-tick observation from multiple players, provide that
through `runPlayers(...)` rather than by calling `runPlayer(...)` sequentially
and accidentally observing different ticks.

### 5. Separate Intent Collection From Tick Processing

The expected model is:

- `runPlayer` submits intents and returns a value from the player runtime
- `runPlayers` evaluates multiple players against one shared current game state
- `tick()` processes pending intents and advances the world

Tests will rely on this separation.

Do not collapse both phases together unless your engine forces it, and if it
does, keep the observable contract consistent from the test side.

If your engine consumes a tick while running player code, document that inside
the adapter and normalize `tick(count)` so tests still observe the expected
time advancement semantics.

### 6. Return Plain JSON Snapshots

Inspection is perspective-neutral and must return plain JSON only.

Snapshots should include:

- public Screeps API properties
- stable discriminants like `kind`
- owner values mapped back to player handles

Snapshots should not include:

- private engine fields
- internal IDs or pointers
- test-irrelevant implementation detail

When in doubt, ask: "Could a player know this through the public gameplay API?"
If not, it should not be in the snapshot.

### 7. Declare Capabilities Honestly

Use `capabilities` to describe what the engine currently supports.

If a mechanic is missing or not wired through the adapter yet:

- report `false`
- let capability-gated tests skip explicitly

Do not report support just to get more tests running. False positives are worse
than honest skips because they turn missing features into misleading failures.

In this repository, capability-gated tests should use the shared helper in
`tests/support/policy.ts` rather than silently returning from the test body.

Adapter-specific skips should be rare. In this repository, narrow built-in
exceptions are centralized in `tests/support/limitations.ts` rather than
scattered as raw adapter-name checks throughout the suite.

If a test represents planned coverage that the suite cannot exercise yet, use
`test.todo` instead of `test.skip`.

## Error Handling

Map player execution failures to `RunPlayerError`.

At minimum distinguish:

- `syntax`: code does not parse
- `runtime`: code threw while running
- `serialization`: return value crossed the allowed JSON boundary

Use the engine's original error message where possible.

If your engine throws wrapper errors, preserve the most useful user-facing
message rather than a generic adapter-level exception.

## Snapshot Design Advice

Snapshots are the real public contract of the test framework.

A good snapshot shape:

- exposes public gameplay state clearly
- is stable across engines
- avoids engine-private naming
- narrows cleanly by `kind` and `structureType`

Keep IDs opaque.

Tests may store and round-trip IDs through `Game.getObjectById`, but should not
assert anything about their format. Your adapter should preserve this.

## Common Pitfalls

### Using engine internals in test-facing code

You may need internals to create objects or query state. That is fine inside
the adapter. It is not fine to let those internals leak into tests or snapshot
shapes.

### Running player code outside the engine VM

Do not emulate `Game` in Node just because it is convenient. The whole point is
to exercise the real runtime.

### Treating `runPlayer` as arbitrary RPC

`runPlayer` is for in-game player code. It is not an admin hook for mutating
state or bypassing access rules.

### Reimplementing public behavior in the adapter

If the engine cannot currently report or exercise a behavior through its normal
execution path, fix that path. Do not create a special adapter-only simulation
of the mechanic.

### Returning too much in snapshots

If snapshots become dumps of engine state, tests will start depending on the
wrong things.

### Hiding unsupported features instead of capability-gating them

If market, power creeps, terrain editing, or some structure class is not ready,
report that cleanly via capabilities.

## Validation Workflow

Before claiming adapter support, run through this sequence:

1. The adapter compiles against `src/adapter.ts`.
2. The adapter contract tests pass.
3. A small representative set of action/movement tests pass.
4. Snapshot owner mapping is correct.
5. `runPlayer` rejects non-serializable returns correctly.
6. Capability-gated tests skip where appropriate rather than failing obscurely.

Recommended starting point:

- `tests/adapter-contract/*.test.ts`
- `tests/movement/directions.test.ts`
- `tests/actions/harvest.test.ts`
- `tests/room/game-api.test.ts`

Only expand to the larger suite once those are stable.

## Suggested Adapter Development Order

Build in this order:

1. `createShard`
2. player handle mapping
3. `runPlayer`
4. `tick`
5. `getGameTime`
6. `placeCreep`, `placeStructure`, `placeSource`, `placeSite`
7. `getObject`
8. `findInRoom`
9. remaining typed setup helpers
10. capability flags for feature areas you do not support yet

This gets the contract tests working early and keeps debugging manageable.

## Downstream Repository Model

If you are adding support from another engine repository, that repo should own:

- the adapter file(s)
- any engine-specific setup/build logic
- CI invocation of `screeps-ok`

It should not permanently fork the canonical behavior tests.

The intended workflow is:

1. Pin a `screeps-ok` version.
2. Implement the adapter locally.
3. Run the canonical suite in your CI.
4. Upstream new engine-neutral regression tests back to `screeps-ok`.

Temporary local regression tests are fine while developing a fix, but the
steady-state goal is one canonical suite.

## What To Document in Your Adapter

At minimum, add a short README or comment block explaining:

- how player handles map to engine users
- how player code is executed
- whether `runPlayer` consumes a tick internally
- what capability flags are currently false
- any engine limitations that affect parity interpretation

If someone cannot understand those points quickly, the adapter is not yet ready
for outside consumption.

## Current Status of This Guide

This document is the first practical pass. It captures the assumptions visible
from the initial `vanilla` and `xxscreeps` adapters.

It is expected to evolve into a stricter versioned adapter spec once:

- the runner / CLI contract is finalized
- capability policy is stable
- snapshot semantics are less fluid
- external adopters can implement against the contract without asking for
  design clarification
