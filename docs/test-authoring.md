# Test Authoring Guide

How to write a canonical `screeps-ok` test: one that proves one catalog
behavior, fails for one clear reason, and runs unchanged on every engine.

Tests implement entries in [`behaviors.md`](../behaviors.md); matrix-backed
entries also have a scope definition in
[`behavior-matrices.md`](behavior-matrices.md). Find the entry first, then write
the test.

## A test, end to end

A trimmed version of `HARVEST-001` from
`tests/03-harvesting/3.1-source-harvest.test.ts`:

```typescript
import { describe, test, expect, code,
	OK, WORK, CARRY, MOVE, HARVEST_POWER,
} from '../../src/index.js';

describe('creep.harvest()', () => {
	// The title starts with the catalog ID. Coverage and parity tracking key on it.
	test('HARVEST-001 harvest deposits HARVEST_POWER energy per WORK part into the creep store', async ({ shard }) => {
		// Setup: the smallest world that proves the behavior.
		await shard.ownedRoom('p1'); // W1N1, owned by p1, RCL 1
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [WORK, CARRY, MOVE],
		});
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 26], energy: 3000, energyCapacity: 3000,
		});

		// Act: real player code, run inside the engine. `code` interpolates values
		// safely; the last expression is the return value.
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${srcId}))
		`);

		// Assert: the return code and the resulting state, both exact.
		expect(rc).toBe(OK);
		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy).toBe(HARVEST_POWER); // canonical constant, not an engine lookup
	});
});
```

Every canonical test has this shape: set up the smallest world, run the exact
action, advance only the ticks the behavior needs, then assert the exact return
code and observable state.

### The `shard` fixture

Each test receives a fresh world on whichever adapter is running. The test
never sees engine objects, only IDs going in and plain JSON snapshots coming
out.

| Call | What it does | Time |
| --- | --- | --- |
| `ownedRoom(player, room?, rcl?)` | One player owning one room (default `W1N1`, RCL 1) | — |
| `createShard({ players, rooms })` | Full control over players, rooms, and terrain | — |
| `placeCreep`, `placeStructure`, `placeSource`, `placeSite`, … | Typed setup; each returns an opaque ID | — |
| ``runPlayer(player, code`…`)`` | Runs code as that player, processes its intents | +1 tick |
| ``runPlayers({ p1: code`…`, p2: code`…` })`` | Several players against the same state | +1 tick |
| `tick(n?)` | Advances `n` more ticks (default 1) | +n ticks |
| `expectObject(id, kind)`, `expectStructure(id, type)` | Reads one snapshot; fails the test if missing or the wrong kind | — |
| `getObject(id)`, `findInRoom(room, FIND_*)` | Reads snapshots; `getObject` returns `null` for a missing object | — |
| `expectRunPlayerError(player, code, kind)` | Asserts the code fails with a `syntax`, `runtime`, or `serialization` error | as `runPlayer` |
| `requires(capability)` | Skips the test if the adapter lacks the capability | — |

> [!IMPORTANT]
> `runPlayer()` already processes the code's intents within its own tick, so
> the result is observable as soon as it returns. `runPlayer()` followed by
> `tick()` advances two ticks. Only add ticks the behavior needs, such as
> cooldowns, decay, or next-tick visibility.

The full contract, including snapshot shapes, is in
[`adapter-spec.md`](adapter-spec.md).

### Running it

```bash
npm test -- tests/03-harvesting/3.1-source-harvest.test.ts   # xxscreeps (default)
npm test -- vanilla -t "HARVEST-001"                          # vanilla, one test
```

Every new test must pass on both adapters, or fail only on a gap registered in
that adapter's `parity.json`.

## Naming

- Start the test title with the catalog ID: `'HARVEST-001 harvest deposits…'`.
- Matrix rows append `:rowLabel` to the ID: `STRUCTURE-HITS-001:storage`. Keep
  a label one camelCase token, a letter then letters or digits (`:GH2O`, not
  `:not-owner`), so `parity.json` can register a single row. A test in a
  numbered section whose name carries no catalog ID, or two, fails the run.
- Use constants from `src/index.ts` (`FIND_*`, `STRUCTURE_*`, `ERR_*`, body
  parts) rather than string or number literals.

## Rules

### 1. Test only public behavior

A canonical test asserts only player-observable behavior through the public
game surface, adapter setup helpers, and snapshot APIs.

Do not rely on framework-only internals such as adapter discriminators, `any`
casts to recover missing shape, or test-only metadata when the same behavior
can be asserted through public Screeps properties or typed fixture helpers.

Do not assert:

- engine phases
- internal storage layout
- implementation helper usage
- hidden intermediate state that players cannot observe
- adapter-only snapshot tagging in place of public object properties

Some APIs have an effect that leaves the runtime: `Game.notify` sends an email,
`RoomVisual` / `MapVisual` draw in the client, `Game.cpu` samples the host. The
effect is out of scope because no test can observe it. The runtime surface is
in scope and is tested like anything else: method presence, argument
validation, return codes, per-tick caps, size accounting, chainability, and
`export`/`import` round-trips. Write the entry against the surface and never
against the effect (see the scope rule in the `behaviors.md` Summary).

### 2. Never let the engine grade itself

Expected values come from the constants `src/index.ts` exports and the case
lists under `src/matrices/`, never from the engine under test. The constants
are `@screeps/common`'s, the package both reference engines build on, plus a
few it lacks that `src/constants.ts` writes out with their engine source.

```typescript
// Bad: asks the engine under test for the expected value.
const power = await shard.runPlayer('p1', code`HARVEST_POWER`);
expect(creep.store.energy).toBe(power);

// Good: the checked-in constant is the oracle.
expect(creep.store.energy).toBe(HARVEST_POWER); // imported from src/index.ts
```

The same applies to tables and formulas: do not read them from the engine at
runtime.

### 3. One behavior, one reason to fail

A hand-written test proves one `behavior` catalog entry. A generated test
family proves one `matrix` catalog entry. If a test needs unrelated assertions
to be meaningful, split the behavior or split the test.

When a behavior has both positive and negative cases, prefer separate tests
unless they are one tightly coupled matrix family.

### 4. Assert exact outcomes

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
- exact values derived from canonical constants rather than magic numbers

Avoid:

- "works correctly" or "changed as expected"
- console output as a stand-in for state, unless the console output is the
  behavior (a deprecation notice, say)
- manual spot-checking of logs or snapshots
- filtering or branching on adapter discriminators like `kind`

A loose assertion (`toBeGreaterThan`, `not.toBe(OK)`, `toBeDefined`) is
allowed only as a guard before an exact one, for a value that is genuinely
nondeterministic (wall clock, a random roll with no `randomInjection`), or
when presence is the whole of what the entry claims. Anything else tightens
to the value the constants derive, even when that surfaces a gap on one
engine; register the gap rather than loosen the assertion.

If the public contract includes both a return code and a resulting world state,
assert both unless the catalog entry deliberately scopes to one. Examples:
`transfer()` returning `OK` and changing both stores; `createConstructionSite()`
returning `OK` and creating the site on the next tick.

### 5. Make timing explicit

If a behavior depends on timing, the test states the tick boundary: same tick,
next tick, current tick only, or when a cooldown reaches `0`.

```typescript
const harvest = code`Game.getObjectById(${creepId}).harvest(Game.getObjectById(${srcId}))`;

// Bad: "enough" ticks and a loose bound hide when the effect lands.
await shard.runPlayer('p1', harvest);
await shard.tick(5);
expect((await shard.expectObject(creepId, 'creep')).store.energy).toBeGreaterThan(0);

// Good: the intent resolves inside runPlayer's tick; assert the exact amount then.
await shard.runPlayer('p1', harvest);
expect((await shard.expectObject(creepId, 'creep')).store.energy).toBe(HARVEST_POWER);
```

When a behavior depends on same-tick observation from multiple players, use
`runPlayers(...)` rather than sequential `runPlayer` calls, which observe
different ticks.

### 6. Determinism first

A canonical test must not depend on ambiguous tie-breaking, broad random
sampling, or unstated world assumptions.

If a behavior is only expressible through example scenarios, write a concrete
`behavior` entry per scenario, or a `matrix` with an explicit case list. Do not
encode reverse-engineered algorithm prose in the test as a substitute for
concrete cases.

### 7. Gate missing features on capabilities

If a test needs a feature area some engines lack, skip it through the
capability, never by returning early or checking the adapter's name.

```typescript
// Bad: reports as a pass on engines that never ran the assertions.
if (!shard.capabilities.chemistry) return;

// Good: reports as skipped, with the capability as the reason.
shard.requires('chemistry');
```

Don't use vitest's `skip`, `todo`, `only`, `fails`, `skipIf`, or `runIf`
modifiers in a catalog test: the test would still claim its ID's coverage
while running nothing, or run with its result inverted. An entry with no test
yet has no test.

The capability list and what each flag covers are in
[`adapter-spec.md`](adapter-spec.md#capabilities-and-skip-policy).

### 8. Make negative cases explicit

When behavior depends on rejection, failure, or inapplicability, the test says
exactly what is rejected and how: `ERR_NOT_IN_RANGE`, `ERR_INVALID_TARGET`,
`null`, `undefined`, or the object being absent on that tick.

### 9. Avoid side-effect duplication

Do not write a second canonical test for a side effect another catalog entry
already owns, unless the second behavior needs its own source-specific
coverage. For example, if the death section owns tombstone mechanics, a
suicide test proves suicide-specific behavior or belongs to a death-source
matrix.

### 10. If it can't verify itself, it isn't ready

If a proposed test still needs a human to decide whether it passed, one of
these is missing:

- the catalog entry is too vague
- the matrix definition is incomplete
- the adapter surface is insufficient
- the behavior should remain a note instead of a catalog entry

Do not patch around that with a vague or inspection-based test.

When the setup the contract offers can't reach a branch the entry's canonical
source has, extend the contract (a new spec field, say) rather than scope the
entry down to what setup reaches. Narrow an entry only where vanilla itself
doesn't do what it claims.

## Matrix families

A `matrix` entry is one public rule that expands across a documented case
family: one row per structure type, reaction, boost, or validation condition.
The case list lives in `src/matrices/` (or inline in the test, for a short
list no other test runs) and the test loops over it:

```typescript
import { structureHitsCases } from '../../src/matrices/structure-hits.js';

describe('Structure hits', () => {
	for (const { structureType, expectedHits } of structureHitsCases) {
		test(`STRUCTURE-HITS-001:${structureType} initializes with ${expectedHits} hits`, async ({ shard }) => {
			await shard.ownedRoom('p1', 'W1N1', 8);
			const id = await shard.placeStructure('W1N1', {
				pos: [25, 25], structureType, owner: 'p1',
			});
			const struct = await shard.expectObject(id, 'structure');
			expect(struct.hits).toBe(expectedHits);
		});
	}
});
```

(The real test also sets the minimum RCL per structure and calls
`shard.requires` for structures behind a capability.)

Use a matrix when:

- one public rule expands across a documented case family
- the family is defined by a canonical source or explicit applicability list
- the cases differ only by bounded input dimensions, not by unrelated mechanics

Examples: `BOOSTS`, `REACTIONS`, `COMMODITIES`, `CONTROLLER_STRUCTURES`, and
documented target-validity families.

The generated family must derive its cases from its definition in
`docs/behavior-matrices.md` and the canonical source it references. Every
`matrix` entry needs a definition, and a framework test fails on one without
it. Do not:

- hand-pick an undocumented subset
- silently expand scope beyond the documented applicability set
- rely on a matrix whose dimensions or exclusions are still unclear
- use a matrix only to hide unclear scope

If the definition is incomplete, finish it before writing the test family. If
the applicability set is not stable, keep the claim in a Note until the
family is explicit.

## Write from the idiom, not only the method

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

## Traps

Setups that have produced wrong tests. When a test disagrees with vanilla,
rule these out, then read the vanilla engine source
(`node_modules/@screeps/engine/src/`) before deciding the catalog entry is
wrong, and cite the file and line when it is.

- **Sparse rooms.** Apart from a controller at `(1, 1)` and walls on its four
  corner tiles, a default room holds nothing the test didn't place: no
  sources, minerals, or other structures. `moveTo` may still detour around
  what the test does place, so assert range rather than exact direction when
  the entry doesn't specify one.
- **Damage order.** Damage lands on body parts in array order from index 0,
  whatever their type. Put the part the assertion is about first.

## Review checklist

Before a canonical test is accepted, each of these should be a "yes":

- Does it map to exactly one catalog behavior or one documented matrix family?
- Does the title start with that catalog ID?
- Does it assert exact public outcomes, using canonical constants?
- Is tick timing explicit where relevant?
- Would a failure point to one clear contract break?
- Is it free of implementation-shaped assertions?
- If matrix-backed, does it come from the documented matrix definition?
- Does it pass on both adapters, or fail only on a registered gap?
- Can another engineer evaluate pass/fail without manual interpretation?
