# xxscreeps parity gap notes

Narrative notes for selected expected-failure classifications in `adapters/xxscreeps/parity.json`.
For the full generated list and current counts, see `docs/status.md`.

Last refreshed: 2026-07-13 against pin `c5fd1522`.

> When a gap moves to fixed-upstream, drop it from `parity.json` and remove the entry here. When a gap is accepted as an intentional shape divergence, move it out of `parity.json` into the adapter's `shapeDivergences` declaration (`adapters/xxscreeps/index.ts`) and into the Accepted divergences section below. Current status: 18 open gaps registered in `parity.json` plus one expected-failure held intentional (`factory-power-effect-not-implemented`); the three intentional shape divergences (flag `id`, body-part `boost`, controller `effects`) are declared on the adapter and their tests pass. The pin-`c5fd1522` bump fixed seven registered gaps (four `tombstone.creep` surfaces, foreign-segment clear-request, construction-site foreign-room error) and surfaced three new `@xxscreeps/pathfinder@0.4.1` regressions (see below). Full counts regenerate in `docs/status.md` on the next full run.

> Pathfinder note: the engine consumes `@xxscreeps/pathfinder` as a published npm prebuild, which can lag the pinned source (upstream only publishes on a version bump). When that happens, pathfinder fixes at the pin ride the vendored build under `vendor/pathfinder/` — see its README. The pin-`549660784` pathfinder regressions (PATHFINDER-012, COSTMATRIX-007, ROOMPOS-FIND-007) were fixed in source at `e6180170` and pass via the vendor build; only the pre-existing ROOMPOS-FIND-010 range gap remains open. At pin `db0d77e9` the registry prebuild (`@xxscreeps/pathfinder@0.4.0`, now napi-based) supersedes the vendor build, so `vendor/pathfinder/` can be retired. At pin `c5fd1522` the registry ships `@xxscreeps/pathfinder@0.4.1` (upstream `pf: algorithm delegates`, `pf: fix cost for incomplete paths`), which regresses three previously-passing searches — PATHFINDER-006, ROOMPOS-FIND-002, ROOMPOS-FIND-009 (see `pathfinder-0-4-1-incomplete-for-solvable-searches` below). With the vendor build retired these cannot ride a vendored fix; they need an upstream source fix and a subsequent prebuild bump.

## Open parity gaps

### rawmemory-set-invalidates-parsed-memhack

- Tests: UNDOC-MEMHACK-012
- Status: RESIDUAL after pin `15df4bea`; the RawMemory.set mutation-preservation rows now pass.
- Cause: first `Memory` access preserves xxscreeps's global accessor descriptor instead of replacing it with a value descriptor for the parsed object.
- Plan: mirror vanilla's first-access descriptor flip so `Object.getOwnPropertyDescriptor(global, 'Memory')` reports a configurable enumerable value descriptor after `Memory` is read.

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
- Cause: live objects expose position fields at runtime, but the parsed JSON snapshots for creeps, structures, resources, tombstones, ruins, sources, minerals, deposits, nukes, controllers, and construction sites lose `pos.x`, `pos.y`, and `pos.roomName`.
- Plan: ensure JSON serialization includes the same representative nested position fields as the live object snapshots. The matrix should stay broad because the missing field shape spans many object classes.

### stale-pickup-target-allowed

- Tests: UNDOC-STALEARG-001:creepPickup.
- Status: CONFIRMED.
- Cause: `Creep.pickup()` (`packages/xxscreeps/mods/creep/creep.ts:335-339`) accepts a stale cached `Resource` argument and returns `OK`, queueing a pickup intent against the stale resource id. `checkPickup` (`creep.ts:516-523`) calls `checkTarget(target, Resource)` (`packages/xxscreeps/game/checks.ts:43-52`), which reads only `target.room` and `target instanceof Resource` — both succeed on a released wrapper because they don't go through the schema-backed property accesses that trip xxscreeps's released-object guard. The remaining checks read `creep.store` and `target.pos` for range, neither of which triggers the guard either. `intents.save(this, 'pickup', resource.id)` then queues the intent against the cached id; the processor finds no backing resource and silently no-ops. The other 17 stale-argument matrix rows reject the call because their per-target checks read schema-backed fields (e.g. `target.store` for transfer/withdraw, `target.hits` for attack/heal/repair) that do trip the guard — `pickup` happens to be the only row whose canonical check chain doesn't.
- Plan: have `checkTarget` (or `checkPickup` directly) read a schema-backed field of the target so a released wrapper trips the guard uniformly. The architectural fix is to make `checkTarget` raise the released-object error for stale wrappers, which closes the entire stale-argument axis at once rather than per-method.

### live-cached-receiver-released

- Tests: UNDOC-STALERECV-002
- Status: CONFIRMED at pin `c5fd1522`; surfaced by a real bot running against xxscreeps (screeps-ok PR #2).
- Cause: wrapper invalidation is unconditional, not liveness-based. At end of each tick the runtime releases every room's shared-memory buffer via `detach(room, () => new Error('Accessed a released object from a previous tick'))` (`driver/runtime/index.ts:205-208`), so any schema-backed access on a wrapper cached from a previous tick throws — even when the backing object (e.g. a creep that is alive and visible) still exists. Vanilla resolves cached wrappers by receiver id against current backing data: reads return values, actions dispatch intents that execute (a `move()` via a last-tick wrapper displaces the creep), and only a dangling reference to a removed object is rejected (UNDOC-STALERECV-001).
- Plan: needs per-object liveness rather than blanket buffer release — e.g. re-attaching still-live wrappers to the new tick's buffer, or routing schema access through id re-resolution. Architecturally deep (the release keeps shared-memory semantics safe), so a design conversation upstream should precede any PR.

### look-for-at-unknown-returns-empty

- Tests: ROOM-LOOK-006
- Status: CONFIRMED.
- Cause: `lookForAt` (`game/room/look.ts:148-152`) returns `[]` for any type not in `lookConstants`, with an in-source TODO to switch to `ERR_INVALID_ARGS` once all game-object types are implemented. Vanilla rejects unrecognized LOOK types with `ERR_INVALID_ARGS` (-10).
- Plan: blocked on the same TODO — flipping the fallback to `ERR_INVALID_ARGS` today would break legitimate aliases like `LOOK_POWER_CREEPS`, which xxscreeps doesn't register (`LOOK_NUKES` and `LOOK_DEPOSITS` are registered as of pin `05be3b2e`). Either register all canonical LOOK_* constants upfront (so the unknown-type fallback is safe to harden) or keep the gap until the broader mod set lands.

### terminal-send-check-order-diverges

- Tests: TERMINAL-SEND-005, TERMINAL-SEND-013:invalidRoom (plus its five ordering rows), TERMINAL-SEND-013:cooldownBeforeNotEnoughEnergyCost, TERMINAL-SEND-013:cooldownBeforeInvalidDescription
- Status: CONFIRMED at pin `05be3b2e`; first exposed by splitting the `terminalSend` capability out of `market`.
- Cause: `checkSend` (`mods/market/terminal.ts`) computes the transaction energy cost up front and orders its checks owner → active → resources → description → room name → cooldown. Vanilla validates room name third and cooldown before the energy-cost and description checks. Two visible consequences: an invalid destination room name yields a NaN range, so the NaN energy cost fails the resource check and returns ERR_NOT_ENOUGH_RESOURCES instead of ERR_INVALID_ARGS; and an on-cooldown terminal reports the energy-cost or description failure instead of ERR_TIRED.
- Plan: reorder `checkSend` to vanilla's sequence — room-name validity before any cost math (which also removes the NaN poisoning), cooldown ahead of the energy-cost and description checks.

### commonjs-main-exports-alias-missing

- Tests: UNDOC-GLOBAL-003
- Status: CONFIRMED.
- Cause: The direct user-code `exports` global is not wired as an alias to the executing main module's `module.exports` object. The isolated sandbox seeds `exports` separately, while `driver/runtime/module.ts` executes CommonJS modules through `(function(require,module,exports){...})` with the module-local alias. In the direct `runPlayer` main path, writes through `module.exports` are not reliably reflected through bare `exports`.
- Plan: make the direct main-module globals mirror CommonJS module execution so `exports === module.exports` inside player code.

### invader-core-collapse-controller-not-reset

- Tests: INVADER-CORE-004
- Status: CONFIRMED at pin `05be3b2e`; first exposed by un-skipping the invader-core family (INVADER-CORE-001..003/005 pass, including defender spawn and collapse removal).
- Cause: the invader-core object tick processor (`mods/invader/processor.ts`) handles collapse expiry as a silent `#removeObject(core)` and leaves the room controller untouched, with an in-source TODO to reset an NPC-owned controller once stronghold deployment can create one. Vanilla (`processor/intents/invader-core/tick.js`) clears the room's controller unconditionally in the collapse tick: user null, level 0, progress 0, downgrade/safe-mode timers cleared, `isPowerEnabled` false, effects null.
- Plan: reset the room controller in the collapse branch to match vanilla. Vanilla does not require an NPC-owned controller — any controller in the room is cleared — so the reset need not wait for stronghold deployment.

### pathfinder-0-4-1-incomplete-for-solvable-searches

- Tests: PATHFINDER-006, ROOMPOS-FIND-002, ROOMPOS-FIND-009
- Status: REGRESSION at pin `c5fd1522` — all three passed at the prior pin; introduced by the `@xxscreeps/pathfinder@0.4.1` algorithm rewrite (`pf: algorithm delegates`, `pf: fix cost for incomplete paths`). Deterministic on re-run in isolation. Not observed on vanilla, which uses a different pathfinder (`@screeps/driver/native`).
- Platform divergence (observed 2026-07-13 at pin `05be3b2e`): the regression boundary differs per prebuild platform. The `linux-x64-gnu` prebuild (CI) *passes* ROOMPOS-FIND-009 while `darwin-arm64` (local) fails it deterministically, so CI is red with an unexpected pass. ROOMPOS-FIND-001 (unregistered) fails *intermittently* on `darwin-arm64` with the same null-for-reachable-target signature — roughly one run in two, both in the full suite and in isolation. Decision: both alarms stay live. No tolerance mechanism (a "may pass" marker was considered and rejected) — these searches should be deterministic and platform-independent, so a red run is the correct signal until the upstream fix lands.
- Cause: `PathFinder.search` over multiple goal positions returns an incomplete result with no `last` instead of routing to the closest goal, and `RoomPosition.findClosestByPath` returns `null` for reachable targets — both for a target reachable at the requested range and when a `costCallback` walls off the cheapest route but leaves a valid detour. Common thread: the new algorithm gives up on searches the previous build solved.
- Plan: fix in the pathfinder source upstream and cut a new `@xxscreeps/pathfinder` prebuild, then bump the pin. The vendor override is retired, so there is no vendored-build shortcut this time.

## Accepted divergences

Intentional shape divergences are declared in the adapter's `shapeDivergences` (`adapters/xxscreeps/index.ts`) rather than registered as expected failures: shape tests fold the declared extras into their expected key sets via `expectedShape()`, so the tests pass, the rest of the surface stays asserted, and dropping a divergence fails the test until the declaration is updated. Gaps that are deliberate but blocked on an upstream substrate stay in `parity.json` as expected failures (factory power effect below).

### shape-flag-extra-id

- Tests: SHAPE-FLAG-001 (passes; `id` folded into the expected key set).
- Status: INTENTIONAL — declared divergence.
- Decision (2026-06-11): accepted per laverdet/xxscreeps#215's shape rule ("we should not be bending over backwards to adhere to Screeps' exact undefined-in shapes"). `flag.id` always reads `null` at runtime — both `instantiate(Flag, ...)` sites write `id: null` and `Id.format` composes a zeroed slot as `null` — so value-level behavior matches vanilla; only property presence diverges. The narrow runtime fix attempt regressed ConstructionSite schema layout (`docs/xxscreeps-flag-id-plan.md`); laverdet approved special-casing Flag in PR 133, so the upstream door stays open if a fix ever becomes worth it.

### shape-body-part-always-has-boost

- Tests: SHAPE-CREEP-002, SHAPE-CREEP-003 (pass; `boost` folded into the expected key set).
- Status: INTENTIONAL — declared divergence.
- Decision: PR [laverdet/xxscreeps#163](https://github.com/laverdet/xxscreeps/pull/163) proposed stripping the `boost` property from unboosted body parts to match vanilla and was closed as not desired.

### shape-controller-effects-always-enumerable

- Tests: SHAPE-CTRL-001 (passes; `effects` folded into the expected key set via `expectedShape('controller', ...)`).
- Status: INTENTIONAL — declared divergence (`controller: { extra: ['effects'] }`).
- Decision: appeared at pin `d1e3bade`. `mods/controller/controller.ts:62` declares an `@enumerable override get effects()` (safe-mode invulnerability / `PWR_OPERATE_CONTROLLER`), the same deliberate treatment as `StructureInvaderCore` (`mods/invader/invader-core.ts:29`, already canonical in SHAPE-NPC-002). The base `RoomObject.effects` getter is non-enumerable, so this is an intentional per-object choice to surface controller effects, not an accident — accepted like `boost` / `flag.id`. Vanilla `screeps-engine/src/game/rooms.js:1651` assigns `effects` only when an effect is active, so its no-effect controller omits the key; the divergence is empty-case key presence only.

### factory-power-effect-not-implemented

- Tests: FACTORY-PRODUCE-011:powerEffect, FACTORY-PRODUCE-011:powerEffectBeforeNotEnough
- Status: INTENTIONAL — expected failure, blocked on upstream substrate.
- Decision: `mods/factory/factory.ts` documents the `PWR_OPERATE_FACTORY` branch as blocked until power creeps/effects exist upstream. screeps-ok keeps those rows as expected failures until that substrate lands.

## Capability skips

These rows do not run on xxscreeps because the adapter declares a capability unavailable, so they are not registered in `parity.json` (a skipped test has no pass/fail to expect) and are not in the generated counts above. Documented here so the skip is not silent.

### roomStatus — room-status data not modeled

- Capability: `roomStatus` (declared `false` in `adapters/xxscreeps/index.ts`).
- Tests skipped: MAP-ROOM-004:adminClosed, MAP-ROOM-004:novice, MAP-ROOM-004:respawn, NUKE-LAUNCH-014, NUKE-LAUNCH-015, NUKE-LAUNCH-016, NUKE-LAUNCH-017.
- Status: INTENTIONAL.
- Decision: PR [laverdet/xxscreeps#236](https://github.com/laverdet/xxscreeps/pull/236) proposed modeling room-status data (admin-closed/novice/respawn) and was rejected. laverdet self-patched `Game.map.getRoomStatus` in commit `2cf66aaf` to return only `{status:'normal', timestamp:null}` for accessible rooms and `{status:'closed', timestamp:null}` for everything off-world, with no `roomStatusData` storage; the [#245](https://github.com/laverdet/xxscreeps/pull/245) follow-up finalizes the empty-set behavior. xxscreeps therefore never exposes a non-null timestamp, a `novice`/`respawn`/admin-`closed` status, or the novice/respawn launch guards that consult it. These rows assert the vanilla side only and stay capability-skipped on xxscreeps; MAP-ROOM-004's invalid-format, accessible-`normal`, and off-world-`closed` branches still run on both adapters.

### strongholdDeploy — stronghold deployment not implemented

- Capability: `strongholdDeploy` (declared `false` in `adapters/xxscreeps/index.ts`; split out of `invaderCore` when the pinned engine gained the invader-core mod at `05be3b2e`).
- Tests skipped: STRONGHOLD-LAYOUT-001 (all five bunker templates) and the adapter-contract inspection test `invader core snapshot includes deploy and stronghold fields`.
- Status: INTENTIONAL — engine-missing.
- Decision: the pinned invader-core mod (laverdet/xxscreeps#274) ships the structure, its intent processors, defender spawn, and collapse removal, but `create()` has no deploy caller: nothing places the stronghold template layout at deploy time, and the schema has no `templateName`/`strongholdId` fields (effects are derived from the deploy/collapse timers, so arbitrary seeded effects are also unrepresentable). The basic invader-core family runs under `invaderCore: true`; stronghold-deployment rows stay capability-skipped until an upstream deploy slice lands.
