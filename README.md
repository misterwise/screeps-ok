# screeps-ok

> _If your engine agrees, it's Screeps._

![vanilla](https://img.shields.io/badge/vanilla-199%20passing-brightgreen) ![xxscreeps](https://img.shields.io/badge/xxscreeps-185%20passing-brightgreen) ![xxscreeps expected-fail](https://img.shields.io/badge/xxscreeps%20expected--fail-9-yellow) ![status](https://img.shields.io/badge/status-alpha-blue)

Behavioral conformance test suite for Screeps server implementations. Write
a test once, run it against any engine.

> [!NOTE]
> **Current suite status** — see [`docs/status.md`](docs/status.md) for the
> generated dashboard: per-adapter pass/expected-failure/unexpected counts,
> the parity gaps each engine currently exhibits, and drill-downs into the
> passing, skipped, and failing test sets. Regenerate with
> `npm run status:refresh`. The badges above are updated manually as part of
> the release flow.

The suite is governed by three companion docs:

- [`behaviors.md`](behaviors.md) — the behavioral catalog
- [`docs/behavior-matrices.md`](docs/behavior-matrices.md) — matrix-backed case-family definitions
- [`docs/test-authoring.md`](docs/test-authoring.md) — canonical test-writing rules
- [`docs/style.md`](docs/style.md) — documentation style and visual vocabulary

## Prerequisites

Both adapters compile native modules via `node-gyp`, so a C/C++ toolchain is
required in addition to Node and git:

- **Node 24.x or newer** — native addons are rebuilt against the active runtime
- **git** — `xxscreeps` is installed directly from GitHub
- **C/C++ build toolchain** for `node-gyp`:
  - **macOS**: `xcode-select --install`
  - **Debian/Ubuntu**: `sudo apt-get install build-essential python3`
  - **RHEL/Fedora**: `sudo dnf groupinstall "Development Tools" && sudo dnf install python3`

The first `npm install` pulls a pinned `xxscreeps` commit and builds its
JavaScript output, so the initial install takes noticeably longer than
subsequent runs.

## Quick Start

```bash
# Use Node 24.x or newer
nvm use 24

# Clone and install
git clone https://github.com/misterwise/screeps-ok.git
cd screeps-ok
npm install

# Build runtime-specific prerequisites
npm run setup:xxscreeps
npm run setup:vanilla

# Run against xxscreeps
npm test xxscreeps

# Run against vanilla
npm test vanilla
```

## Running Tests

`npm test` now runs a preflight check before starting Vitest. If the active Node
version or native addons do not match the selected adapter, the command exits
immediately with a concrete remediation message instead of failing hundreds of
tests.

### All tests
```bash
npm test xxscreeps
```

### Via the packaged CLI
```bash
npx screeps-ok --adapter xxscreeps
```

### A specific test file
```bash
npm test xxscreeps -- tests/actions/build.test.ts
```

### A specific test by name
```bash
npm test xxscreeps -- -t "harvests 2 energy"
```

### Watch mode (re-runs on file change)
```bash
npm test xxscreeps -- --watch
```

### Verbose output (see every test name)
```bash
npm test xxscreeps -- --reporter=verbose
```

## Downstream Consumption

> [!NOTE]
> During the alpha, `screeps-ok` is consumed by cloning this repository and
> running the suite in-place against the two bundled adapters. Publishing
> `screeps-ok` as a package that another engine repository installs with
> `npm i -D screeps-ok` (and points at a local adapter module) is tracked
> as a pre-publish release gate — the package is currently marked private
> and `"exports"` still resolves to raw TypeScript.

The packaged runner does work against an arbitrary adapter module when
invoked from a repo clone, which is how downstream adopters will exercise
it once publishing is unblocked:

```bash
./bin/run.js --adapter ./path/to/screeps-ok-adapter.ts --preflight none
```

## Adapter Docs

- [docs/adapter-guide.md](docs/adapter-guide.md) — practical authoring guide
- [docs/adapter-spec.md](docs/adapter-spec.md) — current normative adapter contract

## Reviewer Path

If you are reviewing the project for the first time, read in this order:

1. `README.md`
2. `docs/test-authoring.md`
3. `behaviors.md`
4. `docs/behavior-matrices.md`
5. `docs/adapter-spec.md`

Then run one representative adapter locally:

```bash
npm test vanilla -- tests/room/game-api.test.ts
```

## Writing Tests

Tests use [vitest](https://vitest.dev/) with a custom fixture that provides a `shard` object — the adapter instance.

### Minimal test

```typescript
import { describe, test, expect, code, OK, TOP, MOVE } from '../../src/index.js';

describe('creep.move()', () => {
  test('moves one tile in the given direction', async ({ shard }) => {
    // 1. Set up the world (single owned room shorthand)
    await shard.ownedRoom('p1');

    // 2. Place objects
    const creepId = await shard.placeCreep('W1N1', {
      pos: [25, 25],
      owner: 'p1',
      body: [MOVE],
    });

    // 3. Run player code (returns the last expression)
    const rc = await shard.runPlayer('p1', code`
      Game.getObjectById(${creepId}).move(TOP)
    `);
    expect(rc).toBe(OK);

    // 4. Advance the game
    await shard.tick();

    // 5. Inspect results — throws if null or wrong kind (no silent passes)
    const creep = await shard.expectObject(creepId, 'creep');
    expect(creep.pos.y).toBe(24);
  });
});
```

### Key concepts

**`ownedRoom(player, room?, rcl?)`** — shorthand for createShard with a single player owning a single room. Defaults to `'W1N1'` at RCL 1.

**`createShard`** — full setup when you need multiple players, multiple rooms, or specific RCL values.

```typescript
await shard.createShard({
  players: ['p1', 'p2'],
  rooms: [
    { name: 'W1N1', rcl: 8, owner: 'p1' },
    { name: 'W2N1' },  // unowned
  ],
});
```

**`placeCreep` / `placeStructure` / `placeSite` / `placeSource` / `placeMineral`** — add objects to rooms. Returns an ID you can use later.

**`code\`...\``** — tagged template for player code. Safely interpolates IDs and values via `JSON.stringify`. The code runs inside the engine's game runtime with access to `Game`, all Screeps constants, `RoomPosition`, and `PathFinder`.

**`runPlayer`** — executes the code string in the engine. The last expression is the return value. Returns numbers (action return codes), strings, booleans, objects, or null. Intents generated by the code are processed on the next `tick()`.

**`tick(n?)`** — advances the game by n ticks (default 1). Processes all pending intents.

**`expectObject(id, kind)`** — returns a typed snapshot and throws if the object is null or has the wrong kind. Use this instead of `getObject` + manual `if` guards to avoid silent test passes. Supported kinds: `'creep'`, `'structure'`, `'site'`, `'source'`, `'mineral'`, `'tombstone'`, `'ruin'`, `'resource'`.

**`expectStructure(id, structureType)`** — like `expectObject` but narrows to a specific structure type. Returns a fully typed snapshot (e.g., `LinkSnapshot` for `STRUCTURE_LINK`).

```typescript
const link = await shard.expectStructure(linkId, STRUCTURE_LINK);
expect(link.store.energy).toBe(300);  // fully typed — no casts needed
expect(link.cooldown).toBeGreaterThan(0);
```

**`getObject(id)`** — returns a plain JSON snapshot of the object, or null if destroyed. Use this only when you need to assert null (destroyed/decayed objects).

**`findInRoom(room, type)`** — returns all objects of a type in the room using supported Screeps `FIND_*` constants: `FIND_CREEPS`, `FIND_STRUCTURES`, `FIND_CONSTRUCTION_SITES`, `FIND_SOURCES`, `FIND_MINERALS`, `FIND_TOMBSTONES`, `FIND_RUINS`, `FIND_DROPPED_RESOURCES`.

### Constants

All Screeps constants are exported from `src/index.js` for use in test-side code:

```typescript
import {
  // Return codes
  OK, ERR_NOT_IN_RANGE, ERR_NOT_ENOUGH_RESOURCES, ERR_NO_BODYPART,
  // Body parts
  WORK, CARRY, MOVE, ATTACK, TOUGH, HEAL, CLAIM, RANGED_ATTACK,
  // Directions
  TOP, BOTTOM, LEFT, RIGHT,
  // Structure types
  STRUCTURE_SPAWN, STRUCTURE_TOWER, STRUCTURE_LINK, STRUCTURE_CONTAINER,
  // FIND constants
  FIND_CREEPS, FIND_STRUCTURES, FIND_SOURCES,
  // Resources
  RESOURCE_ENERGY,
  // Gameplay
  HARVEST_POWER, ATTACK_POWER,
} from '../../src/index.js';
```

These are the same constants available inside `code` blocks (the engine
runtime), re-exported for test-side assertions and setup.

> [!IMPORTANT]
> Canonical tests must import constants and tables from `src/index.js`, not
> from the engine under test at runtime. If the suite reads its oracle from
> the implementation it is testing, the implementation silently "agrees with
> itself" and the conformance guarantee is gone. This rule is the whole
> reason `src/constants.ts` exists as a checked-in snapshot.

### Body builder

The `body()` helper builds body part arrays concisely:

```typescript
import { body, WORK, CARRY, MOVE, TOUGH } from '../../src/index.js';

body(3, WORK, CARRY, MOVE)          // ['work','work','work','carry','move']
body(9, TOUGH, MOVE)                // 9 tough + 1 move
body(5, WORK, 2, CARRY, MOVE)       // 5 work + 2 carry + 1 move
body(WORK, CARRY, MOVE)             // single parts — count is optional
```

### Tips

- **Return codes**: Use named constants (`OK`, `ERR_NOT_IN_RANGE`, etc.) instead of numeric values.
- **Store values**: Snapshots omit zero-value store entries. Use `creep.store.energy ?? 0` when checking for empty.
- **Multi-player**: Declare all players in `createShard`. Each `runPlayer` call executes on a single tick.
- **Owned rooms**: Sources in unowned rooms have 1500 capacity (not 3000). Set `rcl` and `owner` on the room to get owned-room behavior.
- **Asserting destruction**: Use `getObject` (not `expectObject`) when you expect null — `expectObject` throws on null.

## Project Structure

```
screeps-ok/
├── src/                        # Framework core
│   ├── index.ts                # Public API (import from here)
│   ├── adapter.ts              # ScreepsOkAdapter interface
│   ├── code.ts                 # code`` tagged template
│   ├── constants.ts            # Re-exported Screeps constants
│   ├── fixture.ts              # vitest fixture (provides { shard })
│   ├── errors.ts               # RunPlayerError
│   ├── helpers/
│   │   └── body.ts             # body() builder
│   └── snapshots/common.ts     # Snapshot type definitions
├── adapters/
│   ├── xxscreeps/              # xxscreeps adapter (wraps simulate())
│   └── vanilla/                # Official server adapter (screeps-server-mockup)
├── tests/
│   ├── adapter-contract/       # Tests the adapter interface itself
│   ├── movement/               # Fatigue, directions, pulling
│   ├── actions/                # harvest, build, repair, transfer, etc.
│   ├── combat/                 # attack, rangedAttack, rangedMassAttack, tower
│   ├── structures/             # spawn, link, extension
│   └── room/                   # controller, source regen, pathfinder, Game API
├── vitest.config.ts
└── package.json
```

## Adapter Selection

The runner sets `SCREEPS_OK_ADAPTER` to the selected adapter module. The
adapter is loaded once and provides a fresh shard per test via `createShard` +
`teardown`.

### xxscreeps adapter
- Uses xxscreeps's `simulate()` API directly (in-process, fast)
- Requires Node 24.x or newer
- Requires `npm run setup:xxscreeps` to build the path-finder native addon for
  the active runtime
- ~6s for the full suite

### vanilla adapter
- Wraps `screeps-server-mockup` (spawns engine child processes)
- Requires Node 24.x or newer
- Requires `npm run setup:vanilla` for `isolated-vm`, `@screeps/driver`, and
  the driver native addon
- Tests run serially (~37s for the full suite)
- Code is injected via Memory and executed by the bot's main loop

## Environment Requirements

> [!IMPORTANT]
> Node 24.x or newer is required. `screeps-ok` does not support older Node
> releases — the preflight check will reject them before vitest starts.

- After changing Node versions, reinstall dependencies before running setup or
  tests so the native modules rebuild for the current runtime.
- `npm install` prepares xxscreeps's JavaScript output, but the runtime-specific
  native addons are built explicitly through `npm run setup:xxscreeps` and
  `npm run setup:vanilla`.

## Known Issues

> [!NOTE]
> Per-adapter parity gaps live in [`docs/status.md`](docs/status.md), which
> is generated from the latest test runs and each adapter's `parity.json`.
> This section covers only harness-level and cross-cutting issues that
> affect both adapters or the test framework itself.

🔴 **Multi-player vanilla** — A second player without an owned room cannot
execute code reliably. The mockup driver disables users that own no
`rooms.objects`, so the adapter-contract test for that case is skipped on
vanilla.

> [!TIP]
> Narrow adapter-specific skips are centralized in
> `tests/support/limitations.ts`, and capability-based skips in
> `tests/support/policy.ts`, rather than scattered raw adapter-name checks.
> Planned but unimplemented coverage should use `test.todo`, not `test.skip`.
