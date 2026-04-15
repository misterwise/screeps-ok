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
