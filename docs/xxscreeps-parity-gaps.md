# xxscreeps parity gap notes

Narrative notes for selected expected-failure classifications in `adapters/xxscreeps/parity.json`.
For the full generated list and current counts, see `docs/status.md`.

Last refreshed: 2026-05-19 against pin `15df4bea`.

> When a gap moves to fixed-upstream, drop it from `parity.json` and remove the entry here. Current generated status: 22 open parity gaps covering 46 tests, plus 2 accepted divergences covering 4 tests.

## Open parity gaps

### tombstone-creep-body-types-not-objects

- Tests: TOMBSTONE-006
- Status: CONFIRMED.
- Cause: `mods/creep/tombstone.ts` schemas `#creep.body` as `vector(enumerated(...BODYPARTS_ALL))` and the `Tombstone.creep` getter returns the raw vector unchanged, so `tombstone.creep.body` is `string[]` rather than the `{type, hits}[]` shape every other body surface uses (live `Creep.body`, vanilla `tombstones.js`, ruin/runtime adapters).
- Plan: in the `creep` getter, wrap the stored types as `creepInfo.body.map(type => ({ type, hits: 0 }))` to match `Creep.body` and the vanilla `_.map(o.creepBody, type => ({type, hits: 0}))` returned by `screeps-engine/src/game/tombstones.js`. Storage stays compact; only the public surface widens.

### shape-flag-extra-id

- Tests: SHAPE-FLAG-001
- Status: CONFIRMED.
- Cause: `RoomObject`'s base serialized schema contributes an `id` field, and Flag composes from that base even though vanilla flags are named objects without ids.
- Plan: use `docs/xxscreeps-flag-id-plan.md` as the starting point. Avoid the shelved schema-layout split that broke ConstructionSite; prefer a narrower Flag-scoped fix unless upstream asks for the broader schema move.

### rawmemory-set-invalidates-parsed-memhack

- Tests: UNDOC-MEMHACK-012
- Status: RESIDUAL after pin `15df4bea`; the RawMemory.set mutation-preservation rows now pass.
- Cause: first `Memory` access preserves xxscreeps's global accessor descriptor instead of replacing it with a value descriptor for the parsed object.
- Plan: mirror vanilla's first-access descriptor flip so `Object.getOwnPropertyDescriptor(global, 'Memory')` reports a configurable enumerable value descriptor after `Memory` is read.

### foreign-segment-clear-request

- Tests: RAWMEMORY-FOREIGN-006
- Status: CONFIRMED.
- Cause: `setActiveForeignSegment(null)` does not clear the pending foreign-segment request, so `RawMemory.foreignSegment` remains populated on the following tick.
- Plan: clear the pending request slot on `null` and verify the next-tick fallback to `undefined`.

### memory-parsed-json-not-refreshed-across-ticks

- Tests: UNDOC-MEMJSON-001, UNDOC-MEMJSON-003, UNDOC-MEMJSON-004, UNDOC-MEMHACK-011
- Status: CONFIRMED.
- Cause: xxscreeps caches parsed Memory in module-level state and does not invalidate it across ticks. Tick-end serialization normalizes functions, `NaN`, and `Infinity`, but next-tick `Memory` reads still see the stale live object instead of a fresh parse of raw memory.
- Plan: reset parsed Memory state at the tick boundary so the next access re-parses `RawMemory.get()`.

### memory-circular-ref-crash

- Tests: UNDOC-MEMJSON-005
- Status: CONFIRMED.
- Cause: the memory normalizer recurses through Memory without cycle detection, so circular references stack-overflow before JSON serialization can fail gracefully.
- Plan: add cycle protection to the normalizer, or move the normalizer under the existing serialization error handling if upstream prefers a smaller diff.

### game-object-json-room-tojson-null-crash

- Tests: UNDOC-JSONOBJ-001
- Status: RESIDUAL after pin `15df4bea`; `JSON.stringify()` no longer throws for the matrix, but most object snapshots still omit nested `pos` fields.
- Cause: live objects expose position fields at runtime, but the parsed JSON snapshots for creeps, structures, resources, tombstones, ruins, sources, minerals, controllers, and construction sites lose `pos.x`, `pos.y`, and `pos.roomName`.
- Plan: ensure JSON serialization includes the same representative nested position fields as the live object snapshots. The matrix should stay broad because the missing field shape spans many object classes.

### actionlog-lab-renderer-missing-combined-actions

- Tests: ACTIONLOG-STRUCT-001:lab (lab `runReaction` / `reverseReaction` rows)
- Status: CONFIRMED.
- Cause: `mods/chemistry/backend.ts` calls `renderActionLog(lab['#actionLog'], previousTime)`, which returns `{ actionLog: { reaction1, reaction2, ... } }`, but the combiner checks `raw.reaction1` / `raw.reaction2` instead of `raw.actionLog.reaction1` / `raw.actionLog.reaction2`. The raw vectors are saved, but the rendered client/history payload omits the combined `runReaction` and `reverseReaction` markers.
- Plan: fix the lab backend combiner to read from `raw.actionLog`, then remove this gap if the `ACTIONLOG-STRUCT-001` lab rows pass.

### construction-site-foreign-room-wrong-error

- Tests: CONSTRUCTION-SITE-014.
- Status: RESIDUAL after pin `15df4bea`.
- Cause: the hostile-owned and validation-precedence rows now match vanilla, but hostile reservations still do not return `ERR_NOT_OWNER` ahead of the RCL/type checks for every structure type.
- Plan: keep the four-case split narrow now: hostile reservation returns ERR_NOT_OWNER; otherwise let the existing ownership/RCL/type path handle the already-fixed cases.

### stale-construction-site-remove-allowed

- Tests: UNDOC-STALERECV-001:constructionSiteRemove.
- Status: CONFIRMED.
- Cause: `ConstructionSite.remove()` (`packages/xxscreeps/mods/construction/construction-site.ts`) accepts a stale cached construction-site wrapper and returns `OK`, queueing another remove intent after the backing site has been removed. Other receiver methods (`Structure.notifyWhenAttacked`, `StructureSpawn.spawnCreep` / `renewCreep` / `recycleCreep`, `StructureLink.transferEnergy`, `StructureTower.attack`/`heal`/`repair`) throw xxscreeps's `Accessed a released object from a previous tick` runtime error on stale wrappers, which the matrix accepts. `ConstructionSite.remove()` somehow bypasses that check — the schema-backed `#user` read inside `checkRemove` does not throw the released-object error the way the same pattern does for the other receivers — and the call proceeds through to `intents.save`.
- Plan: gate `ConstructionSite.remove()` on the same released-object / missing-backing-data check that the other receiver methods already trigger, so a stale cached site rejects the call instead of queueing a duplicate remove intent.

### stale-pickup-target-allowed

- Tests: UNDOC-STALEARG-001:creepPickup.
- Status: CONFIRMED.
- Cause: `Creep.pickup()` (`packages/xxscreeps/mods/creep/creep.ts:335-339`) accepts a stale cached `Resource` argument and returns `OK`, queueing a pickup intent against the stale resource id. `checkPickup` (`creep.ts:516-523`) calls `checkTarget(target, Resource)` (`packages/xxscreeps/game/checks.ts:43-52`), which reads only `target.room` and `target instanceof Resource` — both succeed on a released wrapper because they don't go through the schema-backed property accesses that trip xxscreeps's released-object guard. The remaining checks read `creep.store` and `target.pos` for range, neither of which triggers the guard either. `intents.save(this, 'pickup', resource.id)` then queues the intent against the cached id; the processor finds no backing resource and silently no-ops. The other 17 stale-argument matrix rows reject the call because their per-target checks read schema-backed fields (e.g. `target.store` for transfer/withdraw, `target.hits` for attack/heal/repair) that do trip the guard — `pickup` happens to be the only row whose canonical check chain doesn't.
- Plan: have `checkTarget` (or `checkPickup` directly) read a schema-backed field of the target so a released wrapper trips the guard uniformly. The architectural fix is to make `checkTarget` raise the released-object error for stale wrappers, which closes the entire stale-argument axis at once rather than per-method.

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

## Accepted divergences

### shape-body-part-always-has-boost

- Tests: SHAPE-CREEP-002, SHAPE-CREEP-003
- Status: INTENTIONAL.
- Decision: PR [laverdet/xxscreeps#163](https://github.com/laverdet/xxscreeps/pull/163) proposed stripping the `boost` property from unboosted body parts to match vanilla and was closed as not desired. screeps-ok keeps the vanilla assertion as an expected failure.

### factory-power-effect-not-implemented

- Tests: FACTORY-PRODUCE-011:powerEffect, FACTORY-PRODUCE-011:powerEffectBeforeNotEnough
- Status: INTENTIONAL.
- Decision: `mods/factory/factory.ts` documents the `PWR_OPERATE_FACTORY` branch as blocked until power creeps/effects exist upstream. screeps-ok keeps those rows as expected failures until that substrate lands.
