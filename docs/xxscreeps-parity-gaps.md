# xxscreeps parity gap notes

Narrative notes for selected expected-failure classifications in `adapters/xxscreeps/parity.json`.
For the full generated list and current counts, see `docs/status.md`.

Last refreshed: 2026-10-02 against pin `b6d4c3ba`.

> When a gap moves to fixed-upstream, drop it from `parity.json` and remove the entry here. When a gap is accepted as an intentional shape divergence, move it out of `parity.json` into the adapter's `shapeDivergences` declaration (`adapters/xxscreeps/index.ts`) and into the Accepted divergences section below. Current status: 47 open gaps registered in `parity.json` plus three expected failures held intentional (`controller-my-reset-returns-undefined`, accepted 2026-07-20 per laverdet's undefined-shapes rulings; `memory-parsed-json-not-refreshed-across-ticks`, accepted 2026-07-21 per laverdet's #329 spec-chasing bar; `power-bank-shape-exposes-store-extension`, accepted 2026-07-25 because upstream documents the member as an intentional xxscreeps extension and the rename that would remove it breaks ruin looting and blob migration). Two more intentional entries went with their rows: `structure-active-equal-distance-scan-order` with STRUCTURE-ACTIVE-005, which pinned a tie order neither engine specifies, and `rawmemory-set-invalidates-parsed-memhack` (2026-09-27), which asserted an engine mechanism whose observable consequences already pass. Four open gaps are PR-derived rows awaiting stable vanilla rather than xxscreeps bugs. Three intentional shape divergences (flag `id`, body-part `boost`, room-object `effects`) are declared on the adapter. Pin `38ee6170` → `6d0ffb7e` → `e9380f4d` lands three of our own upstream fixes: xxscreeps#349 (checkSend precedence) closes `terminal-send-check-order-diverges`, and #352 (power-creep movement ties, nuke impact) closes `power-creep-wins-movement-ties` and `power-creep-survives-nuke-impact` — all three dropped from `parity.json`. #350 decodes the runtime source map with trace-mapping, cutting the first `error.stack` read from 33-40ms to 7-10ms and letting the sandbox watchdog drop from 5000ms back to 1000ms. #374 moves the cached `effects` getter onto `RoomObject`, widening the accepted structure/controller `effects` divergence to every room object. Pin `4795a332` consumes xxscreeps#388 (reservation renewal credits `power`, not `power + 1`), closing `reserve-renewal-credits-one-extra-tick`. Pin `b6d4c3ba` closes thirteen more. xxscreeps 92aa02fe moves processor `Game.time` back to the tick the player observed, closing ten one-tick timer gaps (`controller-timer-anchors-one-tick-late`, `nuke-upgrade-block-anchors-one-tick-late`, `mineral-regen-timer-one-tick-long`, `deposit-decay-anchors-one-tick-late`, `bury-creep-stamps-next-tick`, `bury-power-creep-stamps-next-tick`, `power-creep-renew-stamps-next-tick-age`, `power-cooldown-stamps-next-tick`, `power-bank-ruin-spills-one-tick-late`, `stronghold-deploy-trigger-one-tick-late`). #391 closes `reserve-fresh-reservation-one-tick-long` and `reserve-cap-clamps-instead-of-rejecting`; CTRL-RESERVE-010's remaining event assertion moves to `event-log-kept-while-room-sleeps`. #383 implements `PWR_OPERATE_FACTORY`, closing `factory-power-effect-not-implemented`. The same timing commit missed one anchor, so the downgrade step's re-armed timer now reads two ticks short instead of one (renamed `controller-downgrade-step-two-ticks-short`). The `strongholdDeploy` and `powerCreeps` capabilities opened at `38ee6170` are unchanged; their residual rows and the narrower `powerCreepAccountApi` and `powerEffects` skips are documented below. Full counts regenerate in `docs/status.md` on the next full run.

> Pathfinder note: the engine consumes `@xxscreeps/pathfinder` as a published npm prebuild, which can lag the pinned source (upstream only publishes on a version bump). When that happens, pathfinder fixes at the pin ride the vendored build under `vendor/pathfinder/` — see its README. The pin-`549660784` pathfinder regressions (PATHFINDER-012, COSTMATRIX-007, ROOMPOS-FIND-007) were fixed in source at `e6180170` and pass via the vendor build; only the pre-existing ROOMPOS-FIND-010 range gap remains open. At pin `db0d77e9` the registry prebuild (`@xxscreeps/pathfinder@0.4.0`, now napi-based) supersedes the vendor build, so `vendor/pathfinder/` can be retired. At pin `c5fd1522` the registry shipped `@xxscreeps/pathfinder@0.4.1` (upstream `pf: algorithm delegates`, `pf: fix cost for incomplete paths`), which regressed three previously-passing searches (PATHFINDER-006, ROOMPOS-FIND-002, ROOMPOS-FIND-009) with a darwin/linux platform divergence and intermittent ROOMPOS-FIND-001 failures — a goal-lifetime use-after-free. Fixed upstream in `@xxscreeps/pathfinder@0.4.2` (laverdet/xxscreeps#317, `pf: keep multi-goal storage alive during search`), consumed at pin `427f8677`; all four searches pass deterministically again. Pin `4795a332` moves the engine to `@xxscreeps/pathfinder@0.4.6` (`pf: compatibility updates`, a toolchain refresh); no parity rows move.

## Open parity gaps

### spawning-cancel-returns-undefined

- Tests: SPAWN-TIMING-008
- Status: CONFIRMED 2026-09-12 at pin `e9380f4d`.
- Cause: `StructureSpawn.Spawning.cancel()` (`mods/classic/spawn/spawn.ts:60-64`) calls `chainIntentChecks(...)` without returning it, so the call evaluates to `undefined` even though the `cancelSpawning` intent is saved and takes effect. Vanilla (`game/structures.js:1327-1333`) returns `OK`.
- Plan: one-line upstream fix, `return chainIntentChecks(...)`. Not yet filed.

### controller-level-up-ignores-downgrade-timer

- Tests: CTRL-UPGRADE-015
- Status: CONFIRMED 2026-09-12 at pin `e9380f4d`.
- Cause: the `upgradeController` processor (`mods/classic/controller/processor.ts:179-189`) levels up on `#progress >= CONTROLLER_LEVELS[level]` alone. Vanilla (`creeps/upgradeController.js:63-64`) also requires the downgrade timer to be within one `CONTROLLER_DOWNGRADE_RESTORE` of its ceiling, and otherwise lets progress accumulate past the threshold.
- Plan: add the timer condition to the level-up branch upstream. Not yet filed.

### harvest-not-ordered-before-upgradecontroller

- Tests: INTENT-CREEP-005
- Status: CONFIRMED 2026-09-12 at pin `e9380f4d`.
- Cause: creep intents are ranked only by declared `before`/`after` constraints (`engine/processor/index.ts:140-190`). `harvest` (`{ before: 'move' }`) and `upgradeController` (`{ after: 'build' }`) are unrelated, so `upgradeController` resolves first. Vanilla's fixed `creepActions` order (`creeps/intents.js:15`) runs `harvest` first.
- Plan: `after: 'harvest'` on the `upgradeController` processor upstream. Not yet filed. INTENT-CREEP-004 (emptying before harvest) and INTENT-CREEP-006 (transfer before suicide) pass, so the constraint graph covers those pairs already.

### room-getpositionat-out-of-bounds-throws

- Tests: ROOM-API-001
- Status: CONFIRMED 2026-09-12 at pin `e9380f4d`, surfaced by PR #5 (external contributor).
- Cause: `Room.getPositionAt` (`game/room/look.ts:133`) constructs the position unconditionally and the `RoomPosition` constructor guard (`game/position.ts:79`) throws for coordinates outside 0..49. Vanilla (`game/rooms.js:971`) returns `null` first.
- Plan: one-line upstream fix, return `null` before constructing. Not yet filed.

### map-visual-clear-returns-undefined

- Tests: VISUAL-MAP-001, VISUAL-ROOM-002:clear
- Status: CONFIRMED 2026-09-12 at pin `e9380f4d`, surfaced by PR #5 (external contributor); the room-visual row added the same day pins the shared code path.
- Cause: the shared visual class's `clear()` (`mods/meta/visual/visual.ts:397`) resets the buffer but has no `return this`, so a chained `visual.clear().text(...)` throws for both `Game.map.visual` and `RoomVisual`. Every other drawing method returns the visual.
- Plan: one-line upstream fix, `return this`. Not yet filed.

### room-visual-roomname-missing

- Tests: VISUAL-ROOM-001:roomName
- Status: CONFIRMED 2026-09-12 at pin `e9380f4d`.
- Cause: `RoomVisual` (`mods/meta/visual/visual.ts:444`) passes the room name into its private description and the shared-state lookup but never assigns a public `roomName`, so `room.visual.roomName` reads `undefined`. Vanilla (`game/rooms.js:1146`) sets `this.roomName = roomName` and the API documents the property.
- Plan: one-line upstream fix, assign `this.roomName` in the constructor. Not yet filed. Pairs naturally with the `clear()` fix above in one PR.

### map-visual-accepts-non-roomposition

- Tests: VISUAL-MAP-002
- Status: CONFIRMED 2026-09-12 at pin `e9380f4d`.
- Cause: `extractPositions` (`mods/meta/visual/visual.ts:211`) duck-types position arguments on `typeof arg.x === 'number'`, so a plain `{ x, y, roomName }` is encoded like a real position and a bare number passes through as a coordinate. Vanilla (`game/map.js:283-343`) guards `circle`, `line`, `rect`, and `text` with `instanceof RoomPosition` and throws; only a missing argument throws on xxscreeps, and `poly` is unguarded on both engines.
- Plan: add the `instanceof RoomPosition` check to the map-visual position path. The numeric case is the one that matters, since it draws at a garbage location and hides a caller bug. Not yet filed; belongs in the same upstream PR as the two visual gaps above.

### game-object-json-omits-prototype-accessors

- Tests: UNDOC-JSONOBJ-001, every row but `room`, `roomPosition` and `flag`.
- Status: CONFIRMED 2026-07-25 (was filed as a nested-`pos` residual after pin `15df4bea`); mechanism corrected 2026-09-25. Needs an upstream conversation before any PR — see the PR plan.
- Cause: object-model wide, not position-specific. Probing the same creep on both adapters: vanilla emits `{room, pos{x,y,roomName}, id, name, body, my, owner, spawning, ticksToLive, carryCapacity, carry, store, fatigue, hits, hitsMax, …}`; xxscreeps emits `{room, id, name}` and nothing else. Both engines put the public surface on enumerable PROTOTYPE accessors — vanilla's `defineGameObjectProperties` is called on `Structure.prototype` and friends, and xxscreeps's `withOverlay` keys enumerability off the `#` prefix (`schema/overlay.ts:65`). The difference is that vanilla also installs a `toJSON` (`@screeps/engine/src/utils.js:535`) that walks the object with `for...in` (inherited enumerable keys included) and skips `_`-prefixed cache slots, while xxscreeps has no game-object `toJSON`, so `JSON.stringify` sees only own keys. `RoomPosition.prototype.toJSON` (`game/position.ts:416`) is correct: `JSON.stringify(creep.pos)` alone returns `{"x":25,"y":25,"roomName":"W1N1"}`.
- Plan: none queued. The likely fix is a vanilla-style `toJSON` on `RoomObject` rather than an object-model rework. The payoff is debug ergonomics plus any bot that round-trips an object through JSON and reads `.pos.x`; no upstream report exists, so raise it with laverdet before writing code. The matrix stays broad because the divergence spans every object class.

### stale-pickup-target-allowed

- Tests: UNDOC-STALEARG-001:creepPickup.
- Status: CONFIRMED.
- Cause: `Creep.pickup()` (`packages/xxscreeps/mods/creep/creep.ts:335-339`) accepts a stale cached `Resource` argument and returns `OK`, queueing a pickup intent against the stale resource id. `checkPickup` (`creep.ts:516-523`) calls `checkTarget(target, Resource)` (`packages/xxscreeps/game/checks.ts:43-52`), which reads only `target.room` and `target instanceof Resource` — both succeed on a released wrapper because they don't go through the schema-backed property accesses that trip xxscreeps's released-object guard. The remaining checks read `creep.store` and `target.pos` for range, neither of which triggers the guard either. `intents.save(this, 'pickup', resource.id)` then queues the intent against the cached id; the processor finds no backing resource and silently no-ops. The other 17 stale-argument matrix rows reject the call because their per-target checks read schema-backed fields (e.g. `target.store` for transfer/withdraw, `target.hits` for attack/heal/repair) that do trip the guard — `pickup` happens to be the only row whose canonical check chain doesn't.
- Plan: vanilla returns `ERR_INVALID_TARGET` here (`game/creeps.js:574-576`), so the fix is a liveness test in `checkTarget` that returns that code for a released wrapper, not a read that trips the guard. The same test closes `stale-argument-throws-instead-of-invalid-target`.

### stale-argument-throws-instead-of-invalid-target

- Tests: UNDOC-STALEARG-001, the 16 cases other than `creepWithdrawStructure` and `creepPickup`.
- Status: CONFIRMED 2026-09-26, when the row was pinned to vanilla's per-case outcome (it had accepted any rejection).
- Cause: the end-of-tick `detach` (`driver/runtime/index.ts:212`) makes a cached wrapper throw on its first schema-backed read, and these methods' check chains read one (`target.store` in `checkTransferTarget`, for one) before anything tests whether the target still exists. Vanilla looks the id up in the tick's registry first and returns `ERR_INVALID_TARGET` (`Creep.attack`, `game/creeps.js:607-610`).
- Plan: the `checkTarget` liveness test above. `Creep.withdraw` must keep throwing: vanilla reads `data(target.id).store` before its target test (`creeps.js:509`).

### live-cached-receiver-released

- Tests: UNDOC-STALERECV-002
- Status: CONFIRMED at pin `c5fd1522`; surfaced by a real bot running against xxscreeps (screeps-ok PR #2).
- Cause: wrapper invalidation is unconditional, not liveness-based. At end of each tick the runtime releases every room's shared-memory buffer via `detach(room, () => new Error('Accessed a released object from a previous tick'))` (`driver/runtime/index.ts:205-208`), so any schema-backed access on a wrapper cached from a previous tick throws — even when the backing object (e.g. a creep that is alive and visible) still exists. Vanilla resolves cached wrappers by receiver id against current backing data: reads return values, actions dispatch intents that execute (a `move()` via a last-tick wrapper displaces the creep), and only a dangling reference to a removed object is rejected (UNDOC-STALERECV-001).
- Plan: needs per-object liveness rather than blanket buffer release — e.g. re-attaching still-live wrappers to the new tick's buffer, or routing schema access through id re-resolution. Architecturally deep (the release keeps shared-memory semantics safe), so a design conversation upstream should precede any PR.

### controller-unclaim-clears-safe-mode-cooldown

- Tests: CTRL-UNCLAIM-005
- Status: CONFIRMED at pin `427f8677`; still failing at pin `f01f0a23` (NOT covered by xxscreeps#318).
- Cause: `release()` zeroes `#safeModeCooldownTime`, so `safeModeCooldown` reads `undefined` after unclaim. Vanilla instead STARTS a fresh cooldown on unclaim — `safeModeCooldown = gameTime + SAFE_MODE_COOLDOWN` in non-novice rooms. The same `release()` path runs on the terminal (level-0) downgrade step, so that step shares the divergence, though no catalog row pins it yet; the non-terminal downgrade step starts a fresh cooldown and matches vanilla (CTRL-DOWNGRADE-010 passes).
- Plan: set a fresh `#safeModeCooldownTime` in `release()` (or its callers) to match vanilla. The #318 centralized resets cover `safeModeAvailable`/`isPowerEnabled` only — this needs its own upstream change.

### creep-attack-cannot-target-power-creep

- Tests: POWERCREEP-DEATH-002
- Status: CONFIRMED at pin `38ee6170`; exposed by enabling `powerCreeps`.
- Cause: `checkAttack` / `checkRangedAttack` (`mods/classic/combat/creep.ts:141,152`) call `checkTarget(target, Creep, Structure)`, and `PowerCreep` extends `RoomObject` rather than `Creep`, so any attack on a power creep returns ERR_INVALID_TARGET. Vanilla's guard admits power creeps explicitly (`game/creeps.js:607`). Only the check rejects: `PowerCreep['#applyDamage']` accumulates `tickRawDamage` and the object tick processor buries the creep at `hits <= 0`, so the whole damage-to-death path is unreachable from combat intents alone.
- Plan: admit `PowerCreep` to the combat target union. Note the row is a vanilla expected-failure too, for the unrelated NaN-TTL reason (screeps/engine#148) — the adapters fail it for different causes.

## Accepted divergences

Intentional shape divergences are declared in the adapter's `shapeDivergences` (`adapters/xxscreeps/index.ts`) rather than registered as expected failures: shape tests fold the declared extras into their expected key sets via `expectedShape()`, so the tests pass, the rest of the surface stays asserted, and dropping a divergence fails the test until the declaration is updated. Gaps that are deliberate but not shape-foldable — blocked on an upstream substrate, or accepted value divergences in behavior tests — stay in `parity.json` as expected failures with `intentional: true` (the controller `.my` reset, the two memory rows, the `isActive` tie order, and the power-bank `store` extension below).

### shape-flag-extra-id

- Tests: SHAPE-FLAG-001 (passes; `id` folded into the expected key set).
- Status: INTENTIONAL — declared divergence.
- Decision (2026-06-11): accepted per laverdet/xxscreeps#215's shape rule ("we should not be bending over backwards to adhere to Screeps' exact undefined-in shapes"). `flag.id` always reads `null` at runtime — both `instantiate(Flag, ...)` sites write `id: null` and `Id.format` composes a zeroed slot as `null` — so value-level behavior matches vanilla; only property presence diverges. The narrow runtime fix attempt regressed ConstructionSite schema layout; laverdet approved special-casing Flag in PR 133, so the upstream door stays open if a fix ever becomes worth it.

### shape-body-part-always-has-boost

- Tests: SHAPE-CREEP-002, SHAPE-CREEP-003 (pass; `boost` folded into the expected key set).
- Status: INTENTIONAL — declared divergence.
- Decision: PR [laverdet/xxscreeps#163](https://github.com/laverdet/xxscreeps/pull/163) proposed stripping the `boost` property from unboosted body parts to match vanilla and was closed as not desired.

### shape-room-object-effects-always-present

- Tests: every room-object shape row — SHAPE-CREEP-001, SHAPE-POWERCREEP-001, SHAPE-CTRL-001, the SHAPE-STRUCT-001 matrix, SHAPE-NPC-001/002/003/004, SHAPE-SOURCE-001, SHAPE-MINERAL-001, SHAPE-DEPOSIT-001, SHAPE-SITE-001, SHAPE-FLAG-001, SHAPE-RESOURCE-001, SHAPE-TOMBSTONE-001, SHAPE-RUIN-001, SHAPE-NUKE-001 (all pass; `effects` folded into the expected key set via `expectedShape('roomObject', ...)`, which every room-object target inherits). SHAPE-NPC-003 remains an expected failure only for its independent `store` extension.
- Status: INTENTIONAL — declared divergence (`roomObject: { extra: ['effects'] }`).
- Decision: laverdet/xxscreeps#215 explicitly rejected exact undefined-vs-absent shape parity: "we should not be bending over backwards to adhere to Screeps' exact undefined-in shapes." The divergence started narrow — #311 had the invader mod extend base `Structure` with an enumerable derived getter so every stronghold peer could expose its collapse timer, and the controller declared its own for safe-mode invulnerability — and widened to the whole room-object surface at pin `e9380f4d`, where xxscreeps#374 moved the cached getter onto `RoomObject` over a `'#effects'` generator chain so mods contribute entries instead of shadowing each other's getters. The getter returns `undefined` when the chain yields nothing, so `obj.effects` reads identically on both engines; vanilla (`screeps-engine/src/game/rooms.js:1651`) just assigns the property only when effect data exists, making this empty-case key presence only. This is the designed producer-owned effects surface, not an adapter gap; do not re-queue an upstream fix.

### controller-my-reset-returns-undefined

- Tests: CTRL-DOWNGRADE-002, CTRL-UNCLAIM-001
- Status: INTENTIONAL — expected failure, accepted value divergence.
- Decision (2026-07-20): xxscreeps returns `undefined` where vanilla returns `false` for `controller.my` after a claimed controller goes neutral (unclaim or RCL 1 downgrade). Truthiness is identical; only strict `=== false` checks diverge. Accepted on three upstream rulings: laverdet called vanilla's `controller.my === undefined` shape "a dumb quirk" ([#128](https://github.com/laverdet/xxscreeps/pull/128) review, 2026-04-22), steered `structure.my` to `undefined` for null users in the FIND_HOSTILE_STRUCTURES fix ([#193](https://github.com/laverdet/xxscreeps/issues/193)), and rejected codifying strict conformance to vanilla's exact undefined-in shapes ([#215](https://github.com/laverdet/xxscreeps/pull/215) review, 2026-06-03). Not shape-foldable — the divergence is a runtime value in behavior tests, not key presence — so it stays in `parity.json` and the rows run as regression traps. Do not re-queue an upstream fix.

### memory-parsed-json-not-refreshed-across-ticks

- Tests: UNDOC-MEMJSON-001, UNDOC-MEMJSON-003, UNDOC-MEMJSON-004, UNDOC-MEMHACK-011
- Status: INTENTIONAL — expected failure, accepted behavior divergence.
- Decision (2026-07-21): submitted in [#329](https://github.com/laverdet/xxscreeps/pull/329) and withdrawn per laverdet's review bar — "Have you observed these values (NaN, Infinity) causing problems with user scripts? ... So if this is just a matter of chasing a spec then I don't want to do it. If it's a matter of fixing something that actually broke then we can figure it out." No observed breakage exists on either half: functions/`NaN`/`Infinity` surviving in the cached parse has no corpus repro, and the skip-save half (UNDOC-MEMHACK-011) has no coherent victim — every real bot deleting `RawMemory._parsed` (ZeSwarm, the MemHack wiki pattern) pairs it with a heap-cached `Memory` clobber or `RawMemory.set`, both of which bypass or already invalidate the cached parse, while mutate-then-bare-delete loses its mutations on vanilla itself, so nobody ships it (the one coherent bare-delete shape, a dirty-flag save skip, mutates nothing and so cannot leak). laverdet's cached-parse design (`32c9fdb`, which superseded the #140 cross-tick re-parse proposal in 2021) deliberately trades exact per-tick-re-parse semantics for CPU and already diverges on prototypes, `toJSON`, getters, Dates, circular flattening, and sparse arrays; these four rows pin the same accepted class. Not shape-foldable, so the rows stay in `parity.json` as regression traps. Do not re-queue an upstream fix without an actual user-script report.

### power-bank-shape-exposes-store-extension

- Tests: SHAPE-NPC-003
- Status: INTENTIONAL — expected failure, accepted documented extension.
- Cause: `store: powerBankStoreFormat` is a public member of the `powerBankShape` struct (`mods/modern/powerbank/schema.ts`), and `withOverlay` publishes schema fields — `schema/overlay.ts:65` decides enumerability purely from the key name (`!key.startsWith('#')`) — so the backing store sits on the player surface beside the canonical `@enumerable get power()` projection. Vanilla keeps the same internal representation and publishes only `power` (`@screeps/engine/src/game/structures.js:585`), and is deliberate about which structures publish a store: `StructurePowerSpawn` declares `store: _storeGetter` twenty lines later.
- Decision (2026-07-25): accepted; the row was previously queued for a small upstream rename PR, and that plan is withdrawn. Upstream already treats this member as a deliberate extension: laverdet's `035d70bf` ("docs: sync with Screeps API", 2026-07-14) annotated it `@public` with "this member is an xxscreeps extension; the official API only exposes the amount via `power`." Across that 97-file sweep the phrase "xxscreeps extension" appears exactly twice — here and on `getTerrain`'s `version` param — so the field was audited against the official API and kept on purpose, which retires the "storage representation showing through" premise this row was filed under. Prototyping the `store` → `'#store'` rename against `upstream/main` then surfaced two independent blockers. First, `createRuin` (`mods/classic/structure/ruin.ts:68-76`) duck-types the loot out of the public name (`structure as never as Record<'store', Store | undefined>`), so hiding the field leaves a destroyed bank's ruin empty — the structure exists to be destroyed for its power, so this is a functional regression, and closing it means a protocol change in `mods/classic/`, well outside a mod-local rename. Second, persisted blobs cannot survive the rename: `makeUpgrader` (`engine/schema/build/index.ts:66-92`) migrates by reading with the old layout and writing with the new, and members are looked up by name (`schema/write.ts:39`). Replicating that path against the real schema primitives shows renaming *or adding* a composed member throws `Cannot read properties of undefined` — absent primitives merely default to 0 — so every saved world holding a live power bank would throw on room load; and even with the upgrader taught to default composed members, a rename is a drop plus an add, so the bank's power would reset. Not shape-foldable: `shapeDivergences`' `roomObject` target applies to every room-object row (right for `effects`, which every room object inherits) whereas `store` is power-bank-only, so folding it would stop walls and roads being asserted against a store-free surface. The row therefore stays in `parity.json` with `intentional: true` as a regression trap — if upstream ever does remove the member, SHAPE-NPC-003 surfaces as an unexpected pass. Do not re-queue an upstream fix.

### map-wrap-per-axis-extent

- Tests: none. MAP-ROOM-003 covers the x axis only.
- Status: INTENTIONAL — untested, accepted world-shape difference.
- Decision (2026-09-26): `getRoomLinearDistance(a, b, true)` wraps each axis by its own extent on xxscreeps (`game/map.ts:267-268`) and both by `getWorldSize()` on vanilla (`utils.js:644-654`). They differ only in a non-square world, which the map generator never makes; xxscreeps' 13×11 harness world is the only place it shows, so the row does not claim the y axis.

## Capability skips

These rows do not run on xxscreeps because the adapter declares a capability unavailable, so they are not registered in `parity.json` (a skipped test has no pass/fail to expect) and are not in the generated counts above. Documented here so the skip is not silent.

### roomStatus — room-status data not modeled

- Capability: `roomStatus` (declared `false` in `adapters/xxscreeps/index.ts`).
- Tests skipped: MAP-ROOM-004:adminClosed, MAP-ROOM-004:novice, MAP-ROOM-004:respawn, and the room-status rows of NUKE-LAUNCH-008 (`:noviceSource`, `:respawnSource`, `:noviceTarget`, `:respawnTarget`, `:noviceSourceBeforeCooldown`).
- Status: INTENTIONAL.
- Decision: PR [laverdet/xxscreeps#236](https://github.com/laverdet/xxscreeps/pull/236) proposed modeling room-status data (admin-closed/novice/respawn) and was rejected. laverdet self-patched `Game.map.getRoomStatus` in commit `2cf66aaf` to return only `{status:'normal', timestamp:null}` for accessible rooms and `{status:'closed', timestamp:null}` for everything off-world, with no `roomStatusData` storage; the [#245](https://github.com/laverdet/xxscreeps/pull/245) follow-up finalizes the empty-set behavior. xxscreeps therefore never exposes a non-null timestamp, a `novice`/`respawn`/admin-`closed` status, or the novice/respawn launch guards that consult it. These rows assert the vanilla side only and stay capability-skipped on xxscreeps; MAP-ROOM-004's invalid-format, accessible-`normal`, and off-world-`closed` branches still run on both adapters.

### powerCreepAccountApi — the roster is mutable only from the backend

- Capability: `powerCreepAccountApi` (declared `false` in `adapters/xxscreeps/index.ts`; split out of `powerCreeps` at pin `38ee6170` when the power-creep mod closed the object gap).
- Tests skipped: GPL-004/005; POWERCREEP-CREATE-001/002/003, POWERCREEP-ENABLE-002's `busy` cases, RENAME-001/002, LIFETIME-002, DELETE-001/002, ACTION-002, UPGRADE-001/002, SPAWN-001/002; ATTACK-NOTIFY-004 (19.1); SHARD-PCREEP-001:neverSpawned; the roster cases of INTENT-LIMIT-001/002 (`:createPowerCreep`, `:spawnPowerCreep`, `:deletePowerCreep`, `:upgradePowerCreep`, `:renamePowerCreep`).
- Status: INTENTIONAL — engine-missing surface, not yet reported upstream.
- Decision: `powerCreeps` is now `true`. xxscreeps#335/#338 ship the roster, the spawned room object, and `Game.powerCreeps` including unspawned entries — but every roster *mutation* lives behind the backend's `/api/game/power-creeps/{create,upgrade,rename,delete,cancel-delete}` routes (`mods/mmo/powercreep/backend.ts`), driven by the official client's power-creep screen. The runtime `PowerCreep` class (`mods/mmo/powercreep/powercreep.ts`) declares no `create` static and no `rename`/`upgrade`/`delete` methods, so game code cannot reach them and cannot reach the unspawned states they produce. On vanilla these are ordinary global intents. The checks themselves are already shared and engine-side (`checkCreatePowerCreep`, `checkUpgradePowerCreep`, `checkRenamePowerCreep`), so the missing piece is runtime plumbing rather than logic — plausible upstream work, but ask before building: laverdet may consider account management deliberately out of the game runtime.

### powerEffects — only PWR_GENERATE_OPS and PWR_OPERATE_FACTORY are applied

- Capability: `powerEffects` (declared `false` in `adapters/xxscreeps/index.ts`; split out of `powerCreeps` at pin `38ee6170`).
- Tests skipped: EFFECT-HOST-001 (all rows), EFFECT-DECAY-001/002, EFFECT-APPLY-001/002, EFFECT-DESTROY-001, SHAPE-EFFECT-001; POWER-OPERATE-001/002, POWER-DISRUPT-001/002, POWER-REGEN-002, POWER-COMBAT-001/002/003; TOWER-POWER-001/002, SPAWN-TIMING-005, LAB-RUN-003, LAB-REVERSE-003, FACTORY-COMMODITY-003, POWER-SPAWN-002, RAMPART-DECAY-004, TERMINAL-SEND-002/004, OBSERVER-003, the `disruptedTerminal` rows of WITHDRAW-017, ROOM-EVENTLOG-020, SOURCE-POWER-001/002, MINERAL-POWER-001, and the `Valid`/`Invalid` rows of POWER-OPERATE-005 and POWER-DISRUPT-003.
- Status: INTENTIONAL — staged upstream, landing one power at a time.
- Decision: `usePower` validates every power correctly — ownership, spawned-ness, power-enabled room, cooldown, ops balance and range all return the canonical codes — but the processor applies only `PWR_GENERATE_OPS` inline and, since pin `b6d4c3ba` (xxscreeps#383), `PWR_OPERATE_FACTORY` through a registered per-power processor (`mods/mmo/operator`). Every other power falls to the default arm, which drops the intent without applying an effect, charging ops, or starting a cooldown (`mods/mmo/powercreep/processor.ts`). xxscreeps#335 states the staging explicitly. FACTORY-COMMODITY-003 exercises only `PWR_OPERATE_FACTORY` and could run under a narrower flag; the leveled-recipe checks FACTORY-PRODUCE-011 and FACTORY-COMMODITY-002 don't need a power creep and already pass. The rows kept on the broader `powerCreeps` flag are the ones whose assertions stop at the return code (POWER-OPERATE-006 and POWER-OPERATE-005's `Disabled` rows) — xxscreeps genuinely satisfies those. Gating is by what a row asserts, not by whether it currently passes: a row that would pass only because nothing happened is not verification. Flip the flag when the remaining powers land; no gap rows are registered for this surface.

### invaderRaidSpawner — active-room generator is not the canonical backend spawner

- Capability: `invaderRaidSpawner` (declared `false` in `adapters/xxscreeps/index.ts`).
- Tests skipped: INVADER-RAID-001 through INVADER-RAID-010 (21 rows).
- Status: INTENTIONAL — engine-missing canonical orchestration.
- Decision: xxscreeps has a partial room-tick generator that can spawn up to three small Invaders in an already-active room after its harvested-energy threshold is crossed. It does not implement the canonical inactive-room backend sweep, sector/stronghold qualification, active-room suppression, or raid composition and escalation matrix. Keep the capability disabled until those observable behaviors exist.
