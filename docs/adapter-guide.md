# Adapter Guide

This is the first practical guide for adding a new `screeps-ok` adapter.

It is intentionally implementation-oriented, not fully normative. The goal is
to help an engine author build a working adapter without reverse-engineering
the existing `vanilla` and `xxscreeps` adapters.

For the current normative contract, see
[`adapter-spec.md`](adapter-spec.md).

The canonical tests live in `screeps-ok`. Your engine repository should own its
adapter and point the `screeps-ok` runner at it.

During the alpha, `screeps-ok` is consumed by cloning this repository and
invoking the runner in-place. A published `npm i -D screeps-ok` flow is
tracked as a release gate — see the README "Downstream Consumption" note.
From a repo clone, the packaged runner already accepts an external adapter
module path:

```bash
./bin/run.js --adapter ./path/to/screeps-ok-adapter.ts --preflight none
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

Canonical expectations are owned by `screeps-ok`, not by the engine under test.
Adapters should assume tests will use the repo's checked-in constants and
matrix definitions as the oracle. An adapter must not rely on "the engine
agrees with itself" as a validation strategy.

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

- `capabilities`
- `createShard`
- typed setup helpers like `placeCreep`, `placeStructure`, `placeSource`, etc.
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

### 5. runPlayer Consumes Exactly One Tick

The expected model is:

- `runPlayer` executes player code, processes submitted intents, and advances
  time by exactly 1 tick. After `runPlayer` returns, the intent has already
  been resolved and the world has advanced.
- `runPlayers` does the same for multiple players against one shared state,
  advancing by exactly 1 tick total.
- `tick(count)` advances the world by exactly `count` additional ticks.
  `tick()` must never be a no-op.

This means `runPlayer() + tick()` always advances by exactly 2 ticks.
Tests that need to observe the immediate result of an intent should use
`getObject` or `findInRoom` after `runPlayer` (without calling `tick()`),
since those adapter-level reads do not consume additional ticks.

If your engine does not naturally tick during player code execution, your
adapter must call the engine's tick after running the code to match this
contract.

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

In this repository, capability-gated tests use `shard.requires('capability')`
rather than silently returning from the test body.

Adapter-specific skips should be rare. In this repository, narrow built-in
exceptions are centralized in `src/limitations.ts` rather than
scattered as raw adapter-name checks throughout the suite.

If a test represents planned coverage that the suite cannot exercise yet, use
`test.todo` instead of `test.skip`.

## Error Handling

Map player execution failures to `RunPlayerError`.

Required error kinds (classification is mandatory, not advisory):

- `syntax`: code does not parse. Most engines throw a distinct `SyntaxError`
  type — check `instanceof` or `error.constructor.name`.
- `runtime`: code parsed but threw during execution (`ReferenceError`,
  `TypeError`, explicit `throw`, etc.).
- `serialization`: code executed but returned a value that is not JSON-safe,
  typically a live game object.

Mapping all errors to `'runtime'` is a spec violation. The contract tests in
`tests/00-adapter-contract/error-model.test.ts` verify that adapters classify
each kind correctly.

Use the engine's original error message where possible.

If your engine throws wrapper errors, preserve the most useful user-facing
message rather than a generic adapter-level exception.

### Execution Confirmation

`runPlayer` must confirm that the supplied code actually executed. If the
adapter's execution mechanism cannot confirm this — the injection path was
not consumed, the engine skipped the player, or the runner was not invoked —
throw a plain `Error` (not `RunPlayerError`). Do not silently return `null`,
as this is indistinguishable from code that evaluated to `undefined`.

### Game Object Detection

Plain `JSON.stringify()` is not sufficient to detect game objects. It may
produce `{}` for a Creep or Room without throwing, silently degrading the
return value. Before serialization, check that the value is a plain object
or array — `result.constructor !== Object && !Array.isArray(result)` catches
all engine class instances. See the spec's
[Game Object Detection](adapter-spec.md#game-object-detection) section for
the full requirement.

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

### Wrapping all errors as runtime

If your adapter catches all exceptions from player code and maps them
uniformly to `RunPlayerError('runtime', ...)`, syntax errors will be
misclassified. Most JavaScript engines throw a distinct `SyntaxError` type
that can be checked with `instanceof` or `error.constructor.name`.

## Validation Workflow

Before claiming adapter support, run through this sequence:

1. The adapter compiles against `src/adapter.ts`.
2. The adapter contract tests pass.
3. A small representative set of action/movement tests pass.
4. Snapshot owner mapping is correct.
5. The `runPlayer` error model is correct:
   - syntax errors produce `RunPlayerError('syntax')`
   - runtime errors produce `RunPlayerError('runtime')`
   - non-serializable returns produce `RunPlayerError('serialization')`
   - `undefined` returns are normalized to `null`
   - code that was never executed throws (not silently returns `null`)
   The contract tests in `tests/00-adapter-contract/error-model.test.ts` verify
   all of these.
6. Capability-gated tests skip where appropriate rather than failing obscurely.

Recommended starting point:

- `tests/00-adapter-contract/*.test.ts`
- `tests/01-movement/1.1-basic-movement.test.ts`
- `tests/03-harvesting/3.1-source-harvest.test.ts`
- `tests/16-room-mechanics/16.3b-game-api.test.ts`

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

## Declaring Expected Failures (parity.json)

Your `adapters/screeps-ok/parity.json` is an overlay on top of the canonical
gap list shipped inside the `screeps-ok` package. The starter writes it for
you with sensible defaults:

```json
{
  "extends": "screeps-ok/parity/xxscreeps.json",
  "expected_failures": {},
  "expected_passes": []
}
```

Tests always assert canonical (vanilla) behavior. The parity reporter merges
`base ∪ expected_failures` and removes anything in `expected_passes`; failing
tests in the merged set are reclassified as expected and don't break CI.

### Most common: you fixed a gap in your engine

You shipped a fix that brings your engine closer to canonical. A test that
the base still lists as expected-to-fail is now passing, the reporter flags
it as an unexpected pass, and CI goes red. Add the base gap id to
`expected_passes` to suppress it:

```json
{
  "extends": "screeps-ok/parity/xxscreeps.json",
  "expected_failures": {},
  "expected_passes": ["link-self-transfer"]
}
```

The entry vanishes from the merged set, the test stays passing, CI is green.
The next `screeps-ok` release prunes the base entry; after `npm update`,
your override becomes a no-op (harmless to leave, fine to delete).

To find the gap id: the reporter prints `Parity: N unexpected pass(es)` with
the gap id alongside the affected test ids. Or grep `node_modules/screeps-ok/parity/<engine>.json` for the failing catalog id.

### Less common: a new red test surfaced a gap not in the base

The catalog grew (or you noticed an engine divergence the base didn't cover),
and CI is now red on a test the merged set doesn't expect. Add an entry to
`expected_failures` so the suite passes, and open an issue upstream so the
gap moves into the base on the next release:

```json
{
  "extends": "screeps-ok/parity/xxscreeps.json",
  "expected_failures": {
    "link-self-transfer": {
      "actual": "StructureLink.transferEnergy to self returns OK",
      "expected": "Returns ERR_INVALID_TARGET when target is the source link",
      "tests": ["LINK-004"]
    }
  },
  "expected_passes": []
}
```

When upstream catalogs the same gap and publishes, the base covers it and
your overlay entry becomes redundant. Reusing the upstream gap id (once you
know it) makes that transition silent.

### Field reference

Each `expected_failures` entry:

- **gap id** (the JSON key) — stable, adapter-neutral identifier for the
  divergence. Overlay entries with the same id as a base entry replace it
  (handy for narrowing `tests` rather than fully suppressing).
- **actual** — short phrase describing the engine's observed behavior.
- **expected** — short phrase describing the canonical (vanilla) behavior.
- **tests** — catalog IDs of tests expected to fail due to this gap. When a
  single catalog ID has `:variant` sub-tests (e.g. `SHAPE-STRUCT-001:road`),
  list either the base ID (gates all variants) or specific suffixed IDs
  (gates only those variants, letting siblings that pass remain ungated).

`extends` accepts any specifier `createRequire` can resolve (package subpath,
absolute path, relative path). Leave the default unless you're pinning to a
fork. `npm run status:refresh` regenerates the dashboard with parity details.

## Current Status of This Guide

This document is the practical companion to [`adapter-spec.md`](adapter-spec.md),
which owns the current normative contract. The guide captures how the
assumptions in the spec actually play out when implementing against the
initial `vanilla` and `xxscreeps` adapters.

Where the guide and the spec disagree, the spec wins. The guide still carries
some provisional advice that will tighten as the project matures:

- the runner / CLI contract is still pre-1.0
- capability policy is still narrowing
- snapshot semantics will continue to firm up as coverage expands
- external adopter experience has not yet fed back into the contract

## xxscreeps Adapter: Known Limitations

The xxscreeps adapter uses `simulate()` from `xxscreeps/test/simulate.js`.
The `simulate().player()` method calls `runForUser`, which creates a
lightweight game context without a `TickPayload`. Several Screeps runtime
features are populated from `TickPayload` during `runForPlayer` and are
therefore unavailable in `simulate().player()`:

| Feature | Root Cause | Affected Tests |
|---|---|---|
| `Memory` global | Parsed from `TickPayload.memoryBlob` | MEMORY-001 through MEMORY-004 |
| `RawMemory` global | Initialized from `TickPayload` | RAWMEMORY-001 through RAWMEMORY-004 |
| `RawMemory.foreignSegment` | Per-user blob from `TickPayload` | RAWMEMORY-FOREIGN-001 through 004 |
| `Game.flags` | Loaded from per-user flag blob via `TickPayload.flagBlob` | FLAG-001 through FLAG-006, ROOMPOS-ACTION-002 |

The fix is upstream in xxscreeps: `simulate()` needs a `TickPayload`-aware
player execution mode (either extending `player()` or adding a new method)
that calls `runForPlayer` instead of `runForUser`. This would make the
memory, segment, and flag systems available without requiring the full
engine service layer.

All affected tests are written and skipped with a reference to this section.
Once the upstream fix lands, remove the skips and verify.

### Vanilla Cooldown Inconsistency

The vanilla engine handles cooldown storage inconsistently across structure
types within its own processor pipeline:

- **Link**: `transfer.js` sets `cooldown += distance` directly. Then `tick.js`
  decrements `cooldown--` in the same tick. The DB stores the post-decrement
  value. A player observes `LINK_COOLDOWN * distance - 1` after a transfer.

- **Extractor**: `harvest.js` sets `_cooldown = EXTRACTOR_COOLDOWN` (a deferred
  field). Then `tick.js` first decrements any existing cooldown, then overwrites
  with `_cooldown`. The DB stores the overwritten value. A player observes
  `EXTRACTOR_COOLDOWN` after a harvest.

Both DB values correctly represent what a player would see on the next tick,
because player code reads the DB state before the tick processor runs. The
inconsistency is in the engine's processor pipeline, not in the adapter.

### placeFlag Consumes Ticks

Because flags are per-user blobs (not room objects), the xxscreeps adapter
creates flags via `runPlayer` with `RoomPosition.createFlag()`. Under the
current contract (`runPlayer` = 1 tick), this means `placeFlag` silently
consumes a tick. `flushDeferredFlags` then calls `simulation.tick(1)` for
persistence, adding another tick.

This is blocked on the same TickPayload limitation above. Once `simulate()`
supports flag creation natively, `placeFlag` can be made tick-neutral.

### Snapshot Fragility

`getObject` and `findInRoom` use `peekRoom` to access live xxscreeps objects,
then read private `#` fields to build snapshots. This means:

- Snapshot code is tightly coupled to xxscreeps's internal object layout
- If xxscreeps renames or restructures private fields, snapshots break silently
- There is no public render/snapshot API in `simulate()` to decouple from

Vanilla's adapter reads from a stable DB schema, which is more resilient to
engine internals changes. The xxscreeps adapter's snapshot code should be
reviewed whenever xxscreeps is upgraded.
