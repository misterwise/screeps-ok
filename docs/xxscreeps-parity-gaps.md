# xxscreeps parity gap notes

Narrative notes for selected expected-failure classifications in `adapters/xxscreeps/parity.json`.
For the full generated list and current counts, see `docs/status.md`.

Last refreshed: 2026-05-04 against pin `3f011d0a`.

> When a gap moves to fixed-upstream, drop it from `parity.json` and remove the entry here. Current generated status: 43 open parity gaps covering 121 tests, plus 3 accepted divergences covering 5 tests.

## Open parity gaps

### shape-flag-extra-id

- Tests: SHAPE-FLAG-001
- Status: CONFIRMED.
- Cause: `RoomObject`'s base serialized schema contributes an `id` field, and Flag composes from that base even though vanilla flags are named objects without ids.
- Plan: use `docs/xxscreeps-flag-id-plan.md` as the starting point. Avoid the shelved schema-layout split that broke ConstructionSite; prefer a narrower Flag-scoped fix unless upstream asks for the broader schema move.

### rawmemory-set-no-eager-limit-check

- Tests: MEMORY-004
- Status: OPEN PR [laverdet/xxscreeps#140](https://github.com/laverdet/xxscreeps/pull/140).
- Cause: `RawMemory.set()` accepts oversized strings and the 2 MB limit throws later during flush, outside user-code `try/catch`.
- Plan: wait for #140, bump the pin, then remove this gap if MEMORY-004 passes.

### rawmemory-set-invalidates-parsed-memhack

- Tests: MEMORY-002, UNDOC-MEMHACK-007, UNDOC-MEMHACK-008, UNDOC-MEMHACK-009, UNDOC-MEMHACK-010, UNDOC-MEMHACK-012
- Status: BLOCKED on #140.
- Cause: `RawMemory.set()` clears xxscreeps's parsed Memory cache, and object memory accessors bypass vanilla's self-replacing global `Memory` binding behavior. After a post-access `RawMemory.set()`, later same-tick Memory/object `.memory` reads can re-parse the just-set raw string and lose in-tick mutations.
- Plan: re-test after #140. If residual tests remain, route object `.memory` through the pinned global Memory binding or add an equivalent per-tick pin that preserves the already-parsed object until the next tick.

### foreign-segment-clear-request

- Tests: RAWMEMORY-FOREIGN-006
- Status: CONFIRMED, but wait for #140 before editing nearby memory code.
- Cause: `setActiveForeignSegment(null)` does not clear the pending foreign-segment request, so `RawMemory.foreignSegment` remains populated on the following tick.
- Plan: clear the pending request slot on `null` and verify the next-tick fallback to `undefined`.

### memory-parsed-json-not-refreshed-across-ticks

- Tests: UNDOC-MEMJSON-001, UNDOC-MEMJSON-003, UNDOC-MEMJSON-004, UNDOC-MEMHACK-011
- Status: CONFIRMED, but wait for #140 before editing nearby memory code.
- Cause: xxscreeps caches parsed Memory in module-level state and does not invalidate it across ticks. Tick-end serialization normalizes functions, `NaN`, and `Infinity`, but next-tick `Memory` reads still see the stale live object instead of a fresh parse of raw memory.
- Plan: reset parsed Memory state at the tick boundary so the next access re-parses `RawMemory.get()`.

### memory-circular-ref-crash

- Tests: UNDOC-MEMJSON-005
- Status: CONFIRMED, but wait for #140 before editing nearby memory code.
- Cause: the memory normalizer recurses through Memory without cycle detection, so circular references stack-overflow before JSON serialization can fail gracefully.
- Plan: add cycle protection to the normalizer, or move the normalizer under the existing serialization error handling if upstream prefers a smaller diff.

### actionlog-lab-renderer-missing-combined-actions

- Tests: ACTIONLOG-STRUCT-001:lab (lab `runReaction` / `reverseReaction` rows)
- Status: CONFIRMED.
- Cause: `mods/chemistry/backend.ts` calls `renderActionLog(lab['#actionLog'], previousTime)`, which returns `{ actionLog: { reaction1, reaction2, ... } }`, but the combiner checks `raw.reaction1` / `raw.reaction2` instead of `raw.actionLog.reaction1` / `raw.actionLog.reaction2`. The raw vectors are saved, but the rendered client/history payload omits the combined `runReaction` and `reverseReaction` markers.
- Plan: fix the lab backend combiner to read from `raw.actionLog`, then remove this gap if the `ACTIONLOG-STRUCT-001` lab rows pass.

### construction-site-foreign-room-wrong-error

- Tests: CONSTRUCTION-SITE-011 (notOwner rows), CONSTRUCTION-SITE-012, CONSTRUCTION-SITE-013, CONSTRUCTION-SITE-014.
- Status: CONFIRMED. Filed upstream as [laverdet/xxscreeps#185](https://github.com/laverdet/xxscreeps/issues/185).
- Cause: `packages/xxscreeps/mods/construction/room.ts:99-102` rejects every placement in any room where `!room.controller?.my` with `ERR_RCL_NOT_ENOUGH`. Regression introduced by upstream commit `afba4b3a` ("Fix spawn placement"), which audited `.my ===` patterns and changed `controller?.my === false` to `!controller?.my`. The first form blocked only hostile-owned rooms; the second blocks unowned and reserved rooms too. Vanilla `rooms.js:1052-1064` separates the cases (hostile-owned → ERR_NOT_OWNER; hostile-reserved → ERR_NOT_OWNER; unowned/self-reserved → fall through to `checkControllerAvailability` at rcl 0, where road and container have non-zero caps).
- Plan: restore the four-case split — hostile-owned (`level > 0 && !my`) returns ERR_NOT_OWNER; hostile reservation returns ERR_NOT_OWNER; otherwise compute the effective rcl as `controller && controller.user ? controller.level : 0` and reuse the existing per-type `CONTROLLER_STRUCTURES` count check.

### look-energy-alias-not-registered

- Tests: ROOM-LOOK-007, ROOM-LOOK-008, ROOM-LOOK-009
- Status: CONFIRMED.
- Cause: `LOOK_ENERGY` is exported from `mods/resource/constants.ts` but no mod aliases it onto the `Resource` register. Three observable surfaces share the same root cause. `lookAt(x, y)` builds entries from each object's `'#lookType'` (`LOOK_RESOURCES` for `Resource`), so a dropped resource never produces a `type: "energy"` entry. `lookForAt(LOOK_ENERGY, ...)` short-circuits to `[]` because `'energy'` isn't in `lookConstants` (`game/room/look.ts:148-152`). `lookForAtArea(LOOK_ENERGY, ...)` runtime-errors on `Cannot read properties of undefined (reading 'length')` because `#lookFor('energy')` is undefined. Vanilla wires `LOOK_ENERGY` as a legacy alias to the same backing register as `LOOK_RESOURCES` (`@screeps/engine/src/game/rooms.js:768-796`).
- Plan: register `LOOK_ENERGY` as an alias for `Resource` so `#lookFor('energy')` shares the resource register, and have `lookAt` emit a second `{ type: 'energy', energy: ... }` entry for each `Resource` (or generalize via the look-alias registry).

### look-for-at-unknown-returns-empty

- Tests: ROOM-LOOK-006
- Status: CONFIRMED.
- Cause: `lookForAt` (`game/room/look.ts:148-152`) returns `[]` for any type not in `lookConstants`, with an in-source TODO to switch to `ERR_INVALID_ARGS` once all game-object types are implemented. Vanilla rejects unrecognized LOOK types with `ERR_INVALID_ARGS` (-10).
- Plan: blocked on the same TODO — flipping the fallback to `ERR_INVALID_ARGS` today would break legitimate aliases like `LOOK_NUKES`/`LOOK_POWER_CREEPS`/`LOOK_DEPOSITS`, which xxscreeps doesn't register. Either register all canonical LOOK_* constants upfront (so the unknown-type fallback is safe to harden) or keep the gap until the broader mod set lands.

### commonjs-main-exports-alias-missing

- Tests: UNDOC-GLOBAL-003
- Status: CONFIRMED.
- Cause: The direct user-code `exports` global is not wired as an alias to the executing main module's `module.exports` object. The isolated sandbox seeds `exports` separately, while `driver/runtime/module.ts` executes CommonJS modules through `(function(require,module,exports){...})` with the module-local alias. In the direct `runPlayer` main path, writes through `module.exports` are not reliably reflected through bare `exports`.
- Plan: make the direct main-module globals mirror CommonJS module execution so `exports === module.exports` inside player code.

### constructor-by-id-missing-for-noncreep-objects

- Tests: UNDOC-CTOR-002, UNDOC-CTOR-003, UNDOC-CTOR-004, UNDOC-CTOR-006, UNDOC-CTOR-007, UNDOC-CTOR-008
- Status: CONFIRMED.
- Cause: xxscreeps implements constructor-by-id for some public classes, but several non-creep object constructors either cannot reconstruct from id-backed state or reconstruct into a base object whose public getters are not usable. `new Source(id)`, `new Resource(id)`, `new Mineral(id)`, and `new Tombstone(id)` throw missing-backing-data TypeErrors; `new Structure(id)` hits the base `Structure.structureType` throwing getter; `new Ruin(id)` does not expose a readable position.
- Plan: if upstream wants vanilla-compatible undocumented constructors, route these constructors through the same live object registry path as `Game.getObjectById(id)` or copy enough public backing fields onto the constructed object for same-tick public access.

## Accepted divergences

### controller-my-never-owned-returns-false

- Tests: CTRL-CLAIM-007
- Status: INTENTIONAL.
- Decision: PR [laverdet/xxscreeps#128](https://github.com/laverdet/xxscreeps/pull/128) intentionally keeps `StructureController.my === false` for never-claimed controllers. screeps-ok keeps the vanilla assertion as an expected failure so consumers can see the divergence.

### shape-body-part-always-has-boost

- Tests: SHAPE-CREEP-002, SHAPE-CREEP-003
- Status: INTENTIONAL.
- Decision: PR [laverdet/xxscreeps#163](https://github.com/laverdet/xxscreeps/pull/163) proposed stripping the `boost` property from unboosted body parts to match vanilla and was closed as not desired. screeps-ok keeps the vanilla assertion as an expected failure.

### factory-power-effect-not-implemented

- Tests: FACTORY-PRODUCE-011:powerEffect, FACTORY-PRODUCE-011:powerEffectBeforeNotEnough
- Status: INTENTIONAL.
- Decision: `mods/factory/factory.ts` documents the `PWR_OPERATE_FACTORY` branch as blocked until power creeps/effects exist upstream. screeps-ok keeps those rows as expected failures until that substrate lands.
