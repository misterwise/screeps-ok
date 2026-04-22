# xxscreeps Flag/id Plan

Deferred work from the original PR 133 scope (see `xxscreeps-pr-plan.md` for the broader tracker). PR 133 was split into three:

- **Landed as rescoped PR 133**: Game/Room surface additions (`cpuLimit` as `@deprecated` getter deriving from `cpu.limit`, `powerCreeps` stub, `Room.survivalInfo`).
- **PR 134**: `RoomObject` base `hits`/`hitsMax`/`my` leak cleanup via `this:` constraint on `#applyDamage` + `hasHits` type guard.
- **Deferred (this plan)**: Flag `id` restructure.

## Parity gap

- Vanilla: `flag.id === undefined`.
- xxscreeps today: `flag.id` is a non-undefined string read from the buffer slot (base `RoomObject` schema has `id: Id.format`; Flag composes from it).
- Existing workaround: `declare id: never` (TS-only) on the Flag class + `id: null as never` at two `instantiate(Flag, ...)` sites. Neither is a runtime fix.

User-observable: code like `if (obj.id) ...`, `Game.getObjectById(obj.id)`, or `obj.id === someId` can produce wrong branches for Flag. Not just a test-harness concern.

## Laverdet's feedback (from PR 133 comments)

- **Approves special-casing Flag**: "Flags are the only object in the game which don't get id's, so it's probably ok to special case them."
- **Frames Flag as already-architecturally-separate**: "flags do not affect game state. xxscreeps takes advantage of this and does not store them in the room. In vanilla flags are treated the same as any structure, which is of course crazy."
- **Pushed back on PR 133's scope**: "idk what moving all that stuff around accomplished." BUT his "getter returning undefined is indistinguishable from an undefined property" reasoning was about `hits`/`hitsMax`/`my` — all of which return literal `undefined`. **It does not apply to `id`**, because `id`'s schema-injected getter reads a real buffer value. This distinction was not made clear in the original PR description.

## Relevant code

- `packages/xxscreeps/game/object.ts` — base schema (`id: Id.format`).
- `packages/xxscreeps/mods/flag/flag.ts` — Flag class, `declare id: never`.
- `packages/xxscreeps/mods/flag/game.ts` — `instantiate(Flag, { id: null as never, ... })` call site.
- `packages/xxscreeps/mods/flag/room.ts` — `instantiate(Flag, { id: null as never, ... })` call site.

## Options

### Option A — Move `id` out of the base schema into each id-having subclass

Base becomes `struct({pos, '#posId'})`. Nine id-having subclasses each add `id: Id.format` to their own struct: `Creep`, `Structure`, `ConstructionSite`, `Source`, `Mineral`, `Resource`, `Tombstone`, `Ruin`, `ObserverSpy`. Flag's schema is unchanged — naturally inherits an id-less base.

- **Fixes**: `flag.id` at runtime, `'id' in flag`, prototype walking, SHAPE-FLAG-001.
- **Scope**: ~10 files, mechanical.
- **Con**: the scope laverdet already questioned.
- **Defense**: lead with the runtime-observable argument — see the critical argument below. The original PR 133 framing ("clean up base surface") did not make this case.

### Option B — Flag-only override, runtime-parity only

Override `get id(): undefined { return undefined; }` on the Flag class body. Drop `id: null as never` at two instantiate sites.

- **Fixes**: `flag.id` at runtime (the user-observable gap).
- **Does NOT fix**: `'id' in flag` (still `true` via inherited `RoomObject.prototype.id`), prototype walking, SHAPE-FLAG-001.
- **Scope**: 3 files, surgical.
- **Matches**: laverdet's "special case Flag" framing literally.

### Option C — Option B + ok-screeps acknowledgment

Option B engine change, plus on the screeps-ok side document `'id'` appearing on Flag's prototype chain as a known xxscreeps divergence. Either a capability flag or a targeted assertion relaxation in SHAPE-FLAG-001.

- **Fixes**: user-visible behavior matches; deep prototype introspection doesn't.
- **Scope**: xxscreeps 3-file change + screeps-ok harness documentation.
- **Pragmatic fallback** if laverdet rejects Option A.

## Critical argument for Option A

The argument the original PR 133 should have made, and didn't:

> Unlike `hits`/`hitsMax`/`my` — whose base getters returned literal `undefined`, making the runtime behavior match vanilla even with the leak — `id`'s schema-injected getter reads from the buffer. `flag.id` in xxscreeps today is a non-undefined string; vanilla's is `undefined`. That's a user-visible parity gap that manifests in normal player code (`if (obj.id)`, `getObjectById(obj.id)`, `obj.id === someId`), not a test-harness or prototype-introspection concern.
>
> Moving `id` out of the base schema and into each id-having subclass's own struct is the only way to have Flag genuinely inherit an id-less prototype. The nine subclass schema additions are mechanical: one line per class. Flag's schema is untouched.

## Recommendation

Propose **Option A** to laverdet with the reframed argument. If rejected, fall back to **Option C** (Option B engine patch + screeps-ok-side acknowledgment).

## Execution notes

- New branch + worktree for this work. Do not touch `fix/object-shape` (PR 133's branch, worktree at `xxscreeps-pr-object-shape`).
- Validate in `screeps-ok-pr` with `XXSCREEPS_LOCAL=<new worktree path>` — see `xxscreeps-pr-workspace.md`.
- Expected test flip: SHAPE-FLAG-001 goes green under Option A. Under Options B/C, the ok-screeps-side change must also land (or the test stays red).
- Confirm each push per the established "Confirm each push" memory rule.
