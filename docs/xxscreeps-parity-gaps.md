# xxscreeps parity gaps

Tracks every expected-failure classification in `adapters/xxscreeps/parity.json`.

Last refreshed: 2026-05-02 against pin `579213e`.

> When a gap moves to fixed-upstream, drop it from `parity.json` and remove the entry here. Current status: 10 open parity gaps covering 18 tests, plus 2 accepted divergences covering 3 tests.

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

### construction-site-blocked-by-same-type-ruin

- Tests: CONSTRUCTION-SITE-009 (5 of 25 matrix cells: same-type pairs spawn/spawn, extension/extension, tower/tower, container/container, road/road)
- Status: CONFIRMED.
- Cause: `checkCreateConstructionSite` (`mods/construction/room.ts:128-137`) treats `Ruin.structureType` (the destroyed type) as if it were a live structure's type. The same-type rejection at `object.structureType === structureType` matches a ruin even though `Ruin` is a walkable `RoomObject`, not a `Structure`. Cross-type ruins are correctly ignored because the obstacle checker filters on `instanceof Structure`.
- Plan: filter `Ruin` (or anything whose `#lookType` is `LOOK_RUINS`) out of the placement-collision loop before the structure-type comparison. Surfaces in the wild on respawn — see place-spawn flow at `mods/spawn/backend.ts:128-139`, which inherits the same check via `checkCreateConstructionSite`.

### actionlog-lab-renderer-missing-combined-actions

- Tests: ACTIONLOG-STRUCT-001:lab (lab `runReaction` / `reverseReaction` rows)
- Status: CONFIRMED.
- Cause: `mods/chemistry/backend.ts` calls `renderActionLog(lab['#actionLog'], previousTime)`, which returns `{ actionLog: { reaction1, reaction2, ... } }`, but the combiner checks `raw.reaction1` / `raw.reaction2` instead of `raw.actionLog.reaction1` / `raw.actionLog.reaction2`. The raw vectors are saved, but the rendered client/history payload omits the combined `runReaction` and `reverseReaction` markers.
- Plan: fix the lab backend combiner to read from `raw.actionLog`, then remove this gap if the `ACTIONLOG-STRUCT-001` lab rows pass.

### look-at-omits-energy-alias-entry

- Tests: ROOM-LOOK-009
- Status: CONFIRMED.
- Cause: xxscreeps's `Room.lookAt` (`game/room/look.ts`) emits one entry per object using its `'#lookType'`, which for `Resource` is `LOOK_RESOURCES`. Vanilla `Room.lookAt` (`@screeps/engine/src/game/rooms.js:768-796`) explicitly walks both `LOOK_ENERGY` and `LOOK_RESOURCES` against the same backing register, so a dropped resource appears twice — once with `type: "energy"` and once with `type: "resource"`.
- Plan: emit an extra `{ type: 'energy', energy: <Resource> }` entry for each `Resource` returned by `#lookAt`, or generalize via the look-alias registry so the alias's own type tag is included in `lookAt` output.

### look-for-at-deposit-not-registered

- Tests: ROOM-LOOK-010
- Status: CONFIRMED.
- Cause: `LOOK_DEPOSITS` is exported from `game/constants/find.ts` but no xxscreeps mod calls `registerLook(C.LOOK_DEPOSITS)`, so it is absent from the `lookConstants` set. `lookForAt`'s validity check rejects it, returning `ERR_INVALID_ARGS` instead of an empty array. Vanilla registers `deposit` in `lookTypeSpatialRegisters` (`@screeps/engine/src/game/rooms.js:506`), so the empty case correctly returns `[]`.
- Plan: add `registerLook<never>()(C.LOOK_DEPOSITS)` alongside `LOOK_NUKES` / `LOOK_POWER_CREEPS` in `game/room/unimplemented-look.ts` until a real deposit mod lands.

## Accepted divergences

### controller-my-never-owned-returns-false

- Tests: CTRL-CLAIM-007
- Status: INTENTIONAL.
- Decision: PR [laverdet/xxscreeps#128](https://github.com/laverdet/xxscreeps/pull/128) intentionally keeps `StructureController.my === false` for never-claimed controllers. screeps-ok keeps the vanilla assertion as an expected failure so consumers can see the divergence.

### shape-body-part-always-has-boost

- Tests: SHAPE-CREEP-002, SHAPE-CREEP-003
- Status: INTENTIONAL.
- Decision: PR [laverdet/xxscreeps#163](https://github.com/laverdet/xxscreeps/pull/163) proposed stripping the `boost` property from unboosted body parts to match vanilla and was closed as not desired. screeps-ok keeps the vanilla assertion as an expected failure.
