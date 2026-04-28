# xxscreeps PR plan

Companion to `docs/xxscreeps-parity-gaps.md`. Tracks active xxscreeps PRs and queues remaining parity work.

Last refreshed: 2026-04-27 (pin `113800b7`).

> Source paths: xxscreeps engine at `/Users/mrwise/Coding/Screeps/xxscreeps/src`; this repo's adapter at `adapters/xxscreeps/`. PR validation runs in the `screeps-ok-pr` workspace via `XXSCREEPS_LOCAL` (see `conventions/xxscreeps-pr-workspace.md`).

## In flight (awaiting review)

| PR | Plan | Title | Closes |
|---|---|---|---|
| [#120](https://github.com/laverdet/xxscreeps/pull/120) | PR-11a | Short-circuit Room.findPath when origin === goal | findpath-same-pos-not-empty |
| [#121](https://github.com/laverdet/xxscreeps/pull/121) | PR-11b | Fix Game.map.findRoute: routeCallback arg order and null-exit guard | route-callback-ignored |
| [#122](https://github.com/laverdet/xxscreeps/pull/122) | PR-18 | Scale ConstructionSite.progressTotal for roads by terrain ratio | road-site-progresstotal-no-terrain-scaling |
| [#123](https://github.com/laverdet/xxscreeps/pull/123) | PR-19 | Respect roads over wall terrain in the movement resolver | wall-road-not-traversable |
| [#124](https://github.com/laverdet/xxscreeps/pull/124) | PR-20 | Fix Terrain.getRawBuffer Uint8Array destination overload | getrawbuffer-uint8-truncation |
| [#125](https://github.com/laverdet/xxscreeps/pull/125) | PR-12 | Decouple boost output from energy cost (build/repair/upgrade) | boost-energy-cost-scales |
| [#126](https://github.com/laverdet/xxscreeps/pull/126) | PR-3 | Fix controller safe-mode guards and generateSafeMode intent | safemode-ignores-downgrade-threshold + safemode-concurrent-allowed + generate-safe-mode-requires-work |
| [#127](https://github.com/laverdet/xxscreeps/pull/127) | PR-5 | Guard link.transferEnergy, persist cooldown, restore legacy getters | link-cross-owner + link-self-transfer + link-cooldown-not-persisted + shape-struct-missing-legacy-compat:link |
| [#128](https://github.com/laverdet/xxscreeps/pull/128) | PR-1 | Fix structure ownership precedence in checkMyStructure and destroy | destroy-ownership-bypass + lab/observer/factory-not-owner-precedence + controller-my-undefined-on-unowned |
| [#129](https://github.com/laverdet/xxscreeps/pull/129) | PR-4 | Fix cooldown anchoring for lab, factory, and extractor intents | lab/extractor/factory-cooldown |
| [#130](https://github.com/laverdet/xxscreeps/pull/130) | PR-2 | Fix Store.getFreeCapacity null propagation and OpenStore pool semantics | mineral-harvest-no-overflow-drop + transfer/withdraw-wrong-resource + lab-bound-getfreecapacity |
| [#131](https://github.com/laverdet/xxscreeps/pull/131) | PR-15 | Fix RawMemory.set guards and implement foreign/public memory segments | rawmemory-set-no-eager-limit-check + foreign-segment-not-supported (5 of 6 sub-tests; null-clear residual queued as Q2) |
| [#132](https://github.com/laverdet/xxscreeps/pull/132) | PR-13 | Add notifyWhenAttacked and missing structure surface getters | notifyWhenAttacked-not-implemented + shape-struct-missing-legacy-compat:storage (+ SHAPE-STRUCT-001:wall + SHAPE-RUIN-001 jointly with PR-14b) |
| [#133](https://github.com/laverdet/xxscreeps/pull/133) | PR-14a | Add Game.cpuLimit, Game.powerCreeps, Room.survivalInfo | shape-room-missing-survivalInfo + shape-game-surface-mismatch |
| [#134](https://github.com/laverdet/xxscreeps/pull/134) | PR-14b | Remove hits/hitsMax/my leak from RoomObject base | shape-extra-hits-my (Flag id residual queued as Q6) |
| [#152](https://github.com/laverdet/xxscreeps/pull/152) | PR-10a | Fix Creep.transfer redirect to upgradeController; reject pull on spawning | transfer-controller-no-upgrade-redirect + pull-spawning-no-guard |
| [#153](https://github.com/laverdet/xxscreeps/pull/153) | PR-10b | Add Creep.withdraw enemy-rampart guard; fix moveTo noPathFinding return code | withdraw-enemy-rampart-no-protection + moveto-nopathfinding-returns-ok |
| [#160](https://github.com/laverdet/xxscreeps/pull/160) | Q1 | Reject Creep.pull(self) with ERR_INVALID_TARGET | pullSelfHang limitation (MOVE-PULL-007:self) |

## Queued PRs (ordered by complexity, simplest first)

After every in-flight PR merges, ten gap entries in `parity.json` remain. `eventlog-attack-missing` is also remaining but is blocked on upstream PR #107 and resolves on a pin bump. The PRs below close those entries in seven submissions.

### Q2: Memory mod cleanups (3 small fixes bundled)
- **Blocked on:** upstream PR [#140](https://github.com/laverdet/xxscreeps/pull/140) (`fix/raw-memory-set-guards`) landing. #140 already touches `mods/memory/memory.ts` (eager 2 MB throw + preserve in-tick mutations + cross-tick re-parse) and overlaps Q2.2's `json = undefined` reset. Stacking would conflict in the same `crunch`/`flush` neighborhood. Re-evaluate Q2 scope after #140 merges — Q2.2 may already be closed by it, and Q2.1 + Q2.3 should split into separate focused PRs (laverdet prefers clean diffs; bundling them wins nothing once Q2.2 is gone).
- **Closes (3 entries / 6 tests):**
  - `memory-circular-ref-crash` (UNDOC-MEMJSON-005)
  - `memory-parsed-json-not-refreshed-across-ticks` (UNDOC-MEMJSON-001/003/004 + UNDOC-MEMHACK-011)
  - `foreign-segment-not-supported` residual (RAWMEMORY-FOREIGN-006)
- **Fix:** Three independent one-liner-class fixes in `mods/memory/`:
  1. `memory.ts:34` `crunch`: add a `WeakSet` cycle guard so circular references no-op the recursing branch instead of stack-overflowing the runtime.
  2. `game.ts:38` `runtimeConnector.receive`: set the module-level `json = undefined` at tick start so the next `Memory` access re-parses from `RawMemory.get()` — matches vanilla's per-tick re-parse semantics that JSON-normalize functions / NaN / Infinity.
  3. `memory.ts` `setActiveForeignSegment`: when the argument is `null`, clear the pending `requestedForeignSegment` slot so `RawMemory.foreignSegment` falls back to `undefined` next tick.
- **Blast radius:** memory mod only; no schema or storage changes. Item 2 trades the documented `crunch` micro-optimization for parity (already flagged in `memory.ts:30`'s code comment).

### Q3: RoomPosition.__packedPos setter
- **Closes (1 entry / 1 test):** `packedpos-write-ignored` (UNDOC-PACKEDPOS-003).
- **Fix:** `game/position.ts:111`: add a setter alongside the existing `@deprecated` `__packedPos` getter that decomposes `value` into `x`/`y`/`rx`/`ry` and writes `#id` using the inverse of the getter's bit layout. WASM bridges (e.g. TheInternational's commiebot pkg at `src/wasm/pkg/commiebot_wasm.js:381`) construct positions cheaply via `__packedPos =` assignments which are currently silent no-ops in non-strict mode.
- **Blast radius:** single getter pair; behavior change only triggers on previously-no-op writes.

### Q4: Controller never-owned vs cleared-owner distinction
- **Closes (1 entry / 1 test):** `controller-my-never-owned-returns-false` (CTRL-CLAIM-007).
- **Fix:** After PR-1 lands, `OwnedStructure.my` returns `false` for `#user = null` regardless of whether the structure was never owned (vanilla → `undefined`) or explicitly unclaimed (vanilla → `false`). xxscreeps schema-defaults `#user` to the empty string, losing the distinction. Two paths:
  1. **`#everOwned` bool on `OwnedStructure` schema** — set on first claim/place-with-owner, cleared never. `my` returns `undefined` when `!everOwned`. ~one-byte schema add per owned structure.
  2. **Schema initializer change** — keep `#user` undefined until first claim. Requires teaching the schema layer to omit a defaulted field; harder.
- **Blast radius:** Path 1 is additive with no migration; verify all `OwnedStructure` subclass initializers route through the same set-on-claim pathway.

### Q5: Body-part boost schema shape (was PR-10c)
- **Closes (1 entry / 2 tests):** `shape-body-part-always-has-boost` (SHAPE-CREEP-002, SHAPE-CREEP-003).
- **Fix:** Body schema declares `boost: optionalResourceEnumFormat`, which makes `boost` a required own property on every deserialized body part — `Object.getOwnPropertyNames(part)` includes `boost: undefined` even for unboosted parts. Vanilla only sets `boost` after `applyBoost` runs. Removing the literal `boost: undefined` from `creep.ts:414` `create()` is masked by the next tick's blob round-trip; the real fix needs schema-level work — either a custom struct reader that omits properties when the optional resolves to `undefined`, or a `compose()` overlay class with a conditional getter.
- **Blast radius:** schema layer — verify no other deserialized objects depend on the "always own property" shape; body parts are the documented case.

### Q6: Flag id field suppression
- **Closes (1 entry / 1 test):** `shape-flag-crash` residual (SHAPE-FLAG-001).
- **Fix:** PR-14b removed the base RoomObject `id`/`hits`/`hitsMax`/`my` leak via `instanceof` narrowing, but Flag's serialized struct (`game/object.ts:21` base) still contributes an `id` field. Vanilla declares `Flag.id` as `never`. Suppress `id` from Flag's serialized shape via a custom Flag struct reader or a schema-level `excluding` overlay. Note: Option A (schema-layout split) was attempted on 2026-04-21 and broke ConstructionSite (`docs/xxscreeps-flag-id-plan.md`); a different approach is required, ideally one that doesn't disturb the shared base struct.
- **Blast radius:** Flag schema only if scoped narrowly. Prior burn means double-check ConstructionSite + any other subclass that inherits the base struct's `id` field.

### Q7: Object memory accessor unification (memhack)
- **Blocked on:** upstream PR [#140](https://github.com/laverdet/xxscreeps/pull/140) landing — same overlap with `mods/memory/memory.ts` as Q2. Re-evaluate fix shape after #140; #140 may shift the `_parsed` invalidation surface that this PR routes around.
- **Closes (1 entry / 6 tests):** `rawmemory-set-invalidates-parsed-memhack` (MEMORY-002, UNDOC-MEMHACK-007/008/009/010/012).
- **Fix:** xxscreeps's object memory accessors (`mods/creep/creep.ts`, `mods/flag/flag.ts`, `mods/memory/game.ts`, `mods/spawn/spawn.ts`) call the exported `Memory.get()` directly, bypassing any self-replaced global `Memory` binding. After `RawMemory.set()` clears `_parsed`, the next object `.memory` access re-parses the just-set string and drops in-tick mutations. Vanilla binds `Memory` as a self-replacing lazy getter — first access redefines it as a value descriptor — and its object accessors route through `globals.Memory`, so they trigger the same self-replacement. Two fix shapes:
  1. **Route object accessors through the global `Memory` binding** so they participate in the self-replacement contract.
  2. **Pin-this-tick flag** — `RawMemory.set` checks an `accessedJson`-style flag (already tracked in `memory.ts`) before clearing `_parsed`, and the object accessors set the flag on read.
- **Blast radius:** memory mod + four object mods. Schema-free but cross-mod; pick the path that minimizes per-mod touches.

### Q8: Event-log shape + missing emissions
- **Closes (1 entry / 10 tests):** `eventlog-flat-shape-and-missing-action-events` (ROOM-EVENTLOG-012/013/014/015/016/017/018/021/022/025).
- **Companion (blocked):** `eventlog-attack-missing` (ROOM-EVENTLOG-001/002/005..011/023/024) is gated on upstream PR #107 landing and the pin advancing — not part of this PR.
- **Fix:**
  1. **Wrap event payloads under `data:`** — change `appendEventLog` (`game/room/event-log.ts:11`) and the call sites in `mods/harvestable/processor.ts:39`, `mods/combat/processor.ts:27/50/119` so non-routing fields nest under `data: {...}` instead of spreading directly onto the event object. Affects HARVEST, ATTACK_RANGED, HEAL_MELEE.
  2. **Add missing emission sites:**
     - `mods/construction/processor.ts`: emit EVENT_BUILD on build completion, EVENT_REPAIR on repair, EVENT_DISMANTLE on dismantle.
     - `mods/combat/processor.ts`: rangedMassAttack inner loop emits per-target EVENT_ATTACK_TYPE_RANGED_MASS damage entries (not just the umbrella); melee retaliation path emits EVENT_ATTACK_TYPE_HIT_BACK.
     - `mods/creep`: rangedHeal emits the RANGED variant of EVENT_HEAL.
- **Blast radius:** every event-log consumer + the shared helper. Largest of the queued PRs — touches multiple processors and changes the on-the-wire event shape. Worth landing last so the smaller PRs aren't dragged into a wider review.

## Adapter changes

AD-1 (`placeTombstone`/`placeRuin` decay anchoring) and AD-2 (finalize-extras error handler + border-position test fix) landed previously and closed `tombstone-place-low-decay`, `ruin-place-low-decay`, `ruin-spill-decay-on-spill-tick` (bonus), `reserve-007-processor-finalize-missing-room`, `claim-reserved-no-guard`, and `upgrade-blocked-no-guard`. No in-flight adapter changes.

## Summary

| Stage | Count | Tests |
|---|---|---|
| In flight | 18 PRs | ~86 tests |
| Queued (Q2–Q8) | 7 PRs | 19 tests |
| Blocked on upstream #107 | — | 11 tests (eventlog-attack-missing) |
