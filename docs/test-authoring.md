# screeps-ok Test Authoring Rules

This document defines how canonical conformance tests in `screeps-ok` should be
written so they are self-verifying, deterministic, and low-maintenance.

It complements:

- `behaviors.md`, which defines what behavior exists
- `docs/behavior-matrices.md`, which defines how matrix-backed behavior expands
  into explicit case families

## Goals

Canonical tests should:

- prove one catalog behavior or one generated matrix family
- fail for one clear reason
- assert exact public outcomes rather than requiring manual interpretation
- avoid implementation-shaped assumptions

## Core Rules

### 1. Test only public behavior

A canonical test must assert only player-observable behavior through the public
game surface, adapter setup helpers, and snapshot/output APIs.

Canonical gameplay tests must not rely on framework-only internals such as
adapter discriminators, `any` casts to recover missing shape, or test-only
metadata when the same behavior can be asserted through public Screeps
properties or typed fixture helpers.

Canonical tests must also avoid self-oracling through the implementation under
test. In particular:

- do not read gameplay constants, tables, or expected formulas from the engine
  under test at runtime and then assert that the engine matches them
- do not treat a dependency bundled with one implementation as the source of
  truth for another implementation
- do use the checked-in canonical constants exported by `src/constants.ts`

Some APIs have an effect that leaves the runtime: `Game.notify` sends an
email, `RoomVisual` / `MapVisual` draw in the client, `Game.cpu` samples the
host. The effect is out of scope because no test can observe it. The runtime
surface is in scope and is tested like anything else: method presence,
argument validation, return codes, per-tick caps, size accounting,
chainability, and `export`/`import` round-trips. Write the entry against the
surface and never against the effect (see the scope rule in the
`behaviors.md` Summary).
  and the checked-in matrix definitions under `src/matrices/`

Do not assert:

- engine phases
- internal storage layout
- implementation helper usage
- hidden intermediate state that players cannot observe
- adapter-only snapshot tagging in place of public object properties
- implementation-provided constants or tables used as the oracle for that same
  implementation

### 2. One behavior, one reason to fail

A hand-written test should normally prove one `behavior` catalog entry.

A generated test family should normally prove one `matrix` catalog entry.

If a test needs unrelated assertions to be meaningful, split the behavior or
split the test.

### 3. Assert exact outcomes

Prefer exact assertions over qualitative ones.

Good:

- exact return code
- exact resulting position
- exact resource amount
- exact same-tick vs next-tick visibility
- exact returned array/object shape when that shape is the behavior
- exact normalized `null` outcome when the adapter contract owns
  `undefined -> null`
- exact public fields from typed snapshots such as `structureType`,
  `resourceType`, `creepName`, `owner`, `pos`, and `store`
- exact values derived from checked-in canonical constants and tables rather
  than magic numbers or runtime engine lookups

Avoid:

- “works correctly”
- “changed as expected”
- console output inspection
- manual spot-checking of logs or snapshots
- filtering or branching on adapter discriminators like `kind` in canonical
  gameplay tests

### 4. Assert return value and resulting state when both matter

If the public contract includes both an API return code and a resulting world
state, assert both unless the catalog entry deliberately scopes to only one.

Examples:

- `transferEnergy()` returning `OK` and changing both source/target energy
- `createConstructionSite()` returning `OK` and creating the site on the next
  tick
- `observeRoom()` returning `OK` and making the room visible on the next tick

### 5. Timing must be explicit

If a behavior depends on timing, the test must make the tick boundary explicit.

Examples:

- same tick
- next tick
- current tick only
- becomes available when cooldown reaches `0`

Do not leave timing implicit in setup or helper behavior.

When a behavior depends on same-tick observation from multiple players, use a
shared-state helper such as `runPlayers(...)` rather than sequential
single-player reads that may observe different ticks.

### 6. Determinism first

A canonical test must not depend on ambiguous tie-breaking, broad random
sampling, or unstated world assumptions.

If a behavior is important but only expressible through a set of example
scenarios, write it as:

- a concrete `behavior` entry per scenario, or
- a `matrix` with an explicit case list in `docs/behavior-matrices.md`

Do not encode reverse-engineered algorithm prose in the test as a substitute
for concrete cases.

### 7. Matrix tests must come from the matrix definition

If a catalog entry is `matrix`-backed, the generated test family must derive its
cases from `docs/behavior-matrices.md`, the canonical source it references, and
the checked-in executable case definitions under `src/matrices/` when
present.

Do not:

- hand-pick an undocumented subset
- silently expand scope beyond the documented applicability set
- rely on a matrix whose dimensions or exclusions are still unclear

If the matrix definition is incomplete, finish the definition before writing the
canonical test family.

### 8. Negative cases must be explicit

When behavior depends on rejection, failure, or inapplicability, the test must
say exactly what is rejected and how that rejection is exposed.

Examples:

- `ERR_NOT_IN_RANGE`
- `ERR_INVALID_TARGET`
- `null`
- `undefined`
- object absent on that tick

### 9. Avoid side-effect duplication

Do not write a second canonical test for a side effect already owned by another
catalog entry unless the second behavior truly needs its own source-specific
coverage.

Example:

- if tombstone mechanics are owned by the death section, a suicide-specific test
  should prove either suicide-specific behavior or explicitly belong to a
  death-source matrix

### 10. If a behavior cannot be made self-verifying, it is not ready

If a proposed test still requires a human to decide whether it passed, then one
of these is still missing:

- the catalog entry is too vague
- the matrix definition is incomplete
- the adapter surface is insufficient
- the behavior should remain a note instead of a catalog entry

Do not patch around that by writing a vague or inspection-based test.

## Preferred Test Shape

For most canonical tests:

1. set up the smallest world state that proves the behavior
2. run the exact action(s) under test
3. tick only as much as needed
4. assert the exact return code and exact observable state

When a behavior has both positive and negative cases, prefer separate tests
unless they are one tightly-coupled matrix family.

## Matrix Family Rules

A matrix family should be used when:

- one public rule expands across a documented case family
- the family is defined by a canonical source or explicit applicability list
- the cases differ only by bounded input dimensions, not by unrelated mechanics

Examples:

- `BOOSTS`
- `REACTIONS`
- `COMMODITIES`
- `CONTROLLER_STRUCTURES`
- documented target-validity families

Do not use a matrix only to hide unclear scope. If the applicability set is not
stable, keep the catalog item as `needs_vanilla_verification` or a note until
the family is explicit.

## Write From the Idiom, Not Only the Method

Every gap a real bot has found in this suite passed a test that called the
method directly with valid arguments. The bot reached the same API through an
idiom the method-shaped test never exercised. When a new entry is written for
a method, check the entry against how bots actually reach it:

- **Wrapped natives.** `const orig = Creep.prototype.x; Creep.prototype.x =
  function () { … orig.apply(this, arguments) }`. Fails silently if the
  method is an own property (`UNDOC-PROTO-004`..`007`).
- **Stale references.** Ids and names read back out of `Memory` that no
  longer resolve (`GAME-LOOKUP-001`, section 27.12-27.13).
- **Empty-state comparisons.** `store[RESOURCE] === 0`, `!room.storage`,
  `spawn.spawning === null` on objects that have never held the key or the
  structure (`STORE-ACCESS-001`, `ROOM-STRUCTURE-002`).
- **Lookalikes.** A construction site carries the built structure's
  `structureType`; a tombstone or ruin carries a `store`. Any lookup keyed on
  the shared field must exclude the lookalike (`CONSTRUCTION-SITE-019`,
  `ROOM-ENERGY-004`).
- **Same-tick call order.** Bots call intents in whatever order their logic
  produces; the engine resolves them in its own fixed order
  (`INTENT-CREEP-004`..`006`).
- **Budgets and caps.** A right answer at the wrong cost (`ops` against
  `maxOps`, `PATHFINDER-021`..`023`), and a cap that rejects versus one that
  clamps (`CTRL-RESERVE-010`, `CTRL-DOWNGRADE-013`).
- **Recovery paths.** `Game.notify`, `console.log`, and cancel/clear calls
  run from inside error handlers, so a missing or non-returning surface
  takes down the handler (section 31, `CONSOLE-001`, `SPAWN-TIMING-008`).

If the entry only survives the direct call, add the idiom-shaped row next to
it rather than widening the existing one.

## Review Checklist

Before a canonical test is accepted, it should be possible to answer “yes” to
all of these:

- Does it map to exactly one catalog behavior or one documented matrix family?
- Does it assert exact public outcomes?
- Is tick timing explicit where relevant?
- Would a failure point to one clear contract break?
- Is it free of implementation-shaped assertions?
- If matrix-backed, does it come from the documented matrix definition?
- Can another engineer evaluate pass/fail without manual interpretation?
