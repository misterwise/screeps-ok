# Engine-internals policy (xxscreeps adapter)

xxscreeps has no public "construct an object with X initial state" API, so
the adapter reaches into `#`-private fields to prime test state. This doc
bounds that coupling.

## Three rules

### Rule 1 — Allowed categories

Each `#`-field access must classify as exactly one of:

- **`SETUP`** — prime an initial value that the engine's processor will
  manage from that point onward. One-shot, during `createShard` / `place*`.
  Example: `#downgradeTime = time + ticksToDowngrade`. After setup, the
  engine's processor decrements it every tick — the adapter never touches
  it again.
- **`SNAPSHOT`** — read a field during `peekRoom` when no public getter
  works outside a player runtime. Example: `obj['#user']` in `snapOwner`
  because `obj.owner.username` depends on `userInfo` which is empty during
  peek.
- **`INJECT`** — add/remove objects from the world (`#insertObject`,
  `#removeObject`, `#objects` iteration) because xxscreeps has no public
  world-builder API.

### Rule 2 — Forbidden categories

- **`OVERRIDE`** — writing fields the engine computes/maintains after
  setup. The `keepRoomsActive` + `visibleRooms` bug was this class.
  Test: would the engine's next-tick processing write this field? If yes,
  adapter writes here are suspect.
- **`PROCESSOR-WORK`** — transformations the engine's processor would
  perform. Reimplements gameplay. Every processor-like loop in the
  adapter is a red flag.
- **`PATCH`** — compensating for engine bugs by adjusting values on read
  or write. Engine bugs belong in `adapters/xxscreeps/parity.json`,
  never in adapter code. If a test fails under the adapter, the adapter
  never "helps."

### Rule 3 — Surface discipline

- All `#` writes from `adapters/xxscreeps/index.ts` and `snapshots.ts`
  must go through a named helper in `adapters/xxscreeps/engine-internals.ts`.
- Each helper's docstring carries a `CATEGORY — engine file:line` tag
  citing the xxscreeps source the coupling depends on.
- `index.ts` and `snapshots.ts` contain **zero** direct `#` accesses.
- A pre-commit drift trap greps for violations and fails the commit.

## Out-of-scope: engine-level orchestration

Two parts of the adapter drive the engine's own machinery from the outside
rather than poking at `#`-fields. They are exempt from Rule 3 because they
use public-ish engine exports as-designed, not private state:

1. **`createSimulation` fork** — `adapters/xxscreeps/index.ts` inlines a
   ~200-line fork of `xxscreeps/src/test/simulate.ts`. Its own `#` accesses
   (`#flushObjects`) are part of the engine's simulation loop. If the fork
   is retired (upstreamed or replaced), these go with it.

2. **`sandbox-runner.ts`** — drives `createSandbox` + iterates
   `hooks.map('runnerConnector')` to round-trip per-user state
   (`flagBlob`, `memoryBlob`) through a real `NodejsSandbox`. Treats the
   engine's `Sandbox.run` and `runnerConnector` hooks as a public boundary.
   No `#`-field writes, no hook fingerprinting, no synthetic blobs; each
   mod owns its own persistence via its `save` hook. Two adapter-side
   adjustments go through `RunOptions`:
   - `gclBaseline` is ADDED to `payload.gcl` after refresh so
     `Game.gcl.level` reflects `PlayerSpec.gcl` (or the polyfill) while
     `Game.gcl.progress` still reflects the DB delta the engine's
     `mods/controller/processor.ts:239` increments on upgradeController.
   - `controlledRoomCount` REPLACES `payload.controlledRoomCount` because
     the `processorHooks.refreshRoom` path that would maintain
     `user/<id>/controlledRooms` scratch only fires inside a real
     processor worker, not the in-process simulation.

## Adding a new helper

When a gate-close or new placement requires a `#` write not already
covered:

1. Add the helper to `engine-internals.ts` with the `CATEGORY — file:line`
   tag.
2. If no existing category fits, the access probably shouldn't happen —
   stop and reconsider. Most "need a new category" impulses are actually
   `OVERRIDE` or `PATCH` in disguise.
3. Cite the exact xxscreeps file and line where the field is read or
   written by the engine. This is the version-coupling record.
