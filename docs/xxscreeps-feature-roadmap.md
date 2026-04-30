# xxscreeps feature roadmap

Implementation order for the **major missing features** in xxscreeps relative to vanilla, sourced from the April 2026 parity audit posted on upstream Issue 52.

This doc is **feature-shaped**: missing major systems that don't exist in xxscreeps yet. The companion docs cover other axes:

| Doc | Scope | Shape |
| --- | --- | --- |
| `xxscreeps-parity-gaps.md` | The 49 confirmed bugs in shipped code, with file:line root cause | Bug |
| `xxscreeps-pr-plan.md` | PR-by-PR submission plan for those bugs | PR |
| **this doc** | **Major missing features** from upstream Issue 52 (Apr 2026 audit) | **Feature** |

If a row in Issue 52 is "missing structure" or "missing subsystem" → it lives here. If it's "structure exists but is wrong" → it lives in parity-gaps and pr-plan.

**Principle**: each tier depends only on those above it. Sibling items inside a tier are independent and can land in any order.

---

## Already done (out of roadmap scope)

Per the April 2026 audit, these were on earlier roadmap drafts but no longer apply:

- **`Structure.isActive()` + RCL-downgrade tear-down** (#110)
- **Extension capacity scaling** at RCL 7/8
- **Multi-spawn / multi-tower / multi-lab / multi-link by RCL**
- **Terminal** (`send`, transaction log, cooldown)
- **Factory** (#114; produce intent + commodity recipes)
- **Mineral / Extractor** lifecycle
- **Portal** (#159; same-shard mechanics plus cross-shard destination shape)
- **TOUGH boost damage reduction** (#109)
- **Rampart damage redirection** (#147)
- **Tombstone / Ruin** mechanics (#136, #145)
- **`MAX_CONSTRUCTION_SITES` enforcement**
- **GCL counter** (`Game.gcl`)
- **Foreign / public memory segments** (#131)

Treat the above as preconditions; surface bugs in any of them are parity-gap-shaped, not feature-shaped.

## Tier 1 — small isolated wins (≤ 1 day each)

No dependencies; can land in any order. Each closes a discrete item from the audit.

- **Construction site stomping** (#99) — movement destroys hostile sites on entry
- **Spawn stomping** (#100) — new creep destroys hostile creeps on the spawn tile
- **`Game.notify`** — queueing and delivery are in flight upstream as #161/#165; do not duplicate while those are open
- **`Game.gpl`** — currently hardcoded zeros; mirror `Game.gcl` plumbing on the user record
- **`RoomObject.effects`** — surface getter; precondition for Power and InvaderCore effects (start with `[]` default)
- **`notifyWhenAttacked` damage-side consumer** — surface landed in #132; after #161/#165, damage processors still need to read `'#noAttackNotify'` and emit notifications

## Tier 2 — medium standalone features

Self-contained, no dependency chain to each other.

- **Nuker + Nuke** (RCL 8) — launch intent with delayed-impact processor, `StructureNuke` object, room visual on impact
- **Deposit** — ~250 LOC mod for the game object + harvest cycle parity; spawn/respawn on highway rooms deferred to room-generation work
- **MapVisual rendering** (#97) — surface exists, rendering issues to chase
- **Map visual / tile asset rendering** for the client — not strictly engine work but pairs naturally with MapVisual fixes

## Tier 3 — Market

Terminal exists; this is the user-facing market layer on top of it.

- `createOrder` / `deal`
- `getAllOrders` / `getHistory`
- Order book + matching engine
- `credits` and transaction ledger

Market is mostly HTTP plumbing on top of the existing terminal `send`. Bigger than it looks because of the persistence and order-matching rules, but no game-engine plumbing required.

## Tier 4 — NPCs and strongholds

Depends on Tier 1's `RoomObject.effects` (Strongholds apply effects to nearby rooms).

- **InvaderCore** — fixed NPC base structure; deploy phase, decay timer, tower/rampart child structures. Deploy-layout parity is pinned by §14.5 `STRONGHOLD-LAYOUT-001`.
- **Strongholds** — composite of InvaderCore + auto-built ramparts/towers + loot terminal-equivalent. Stress-tests every prior tier; do last among NPCs.
- **Caravans** — moving NPC convoy, optional polish

(Plain "Invaders" — the wandering hostile creep AI — already exists per the audit.)

### Service jobs PRD — what does and doesn't belong in screeps-ok

screeps-ok tests engine-side, tick-driven, player-observable behavior.
The vanilla service-jobs PRD lists 11 backend cronjobs; an audit of
those against this scope concluded:

- The framework concerns (registration, cadence, persistence, runCronjob
  CLI, error isolation) are operator-facing and live in xxscreeps' own
  repo.
- Most cronjob *outputs* (invader bodies, power-bank/deposit/stronghold
  spawn timing and placement, NPC market orders, transaction caps,
  market-history aggregation, power-creep removal-after-cooldown) are
  written directly to the database from the cronjob — no tick-driven
  engine path to invoke or observe in screeps-ok.
- The one exception is **stronghold deployment**: when a level-0
  invader core's `deployTime` elapses, the engine processor's
  invader-core pretick calls `deployStronghold`, which places the
  canonical bunker layout. That's tick-driven and player-observable, so
  it's pinned by §14.5 `STRONGHOLD-LAYOUT-001`. The vanilla cronjob
  (`expandStrongholds`/`genStrongholds`) is what creates the deploying
  core in production, but screeps-ok seeds the core directly via
  `placeObject` and does not exercise the cronjob.

Other entity-shape behaviors a cronjob might create are already pinned
elsewhere by entity (e.g. `POWERCREEP-DELETE-001..003`,
`STRUCTURE-HITS-001`, `INVADER-CORE-*`, `DEPOSIT-*`, `POWER-BANK-*`).
No SERVICE-JOB-* axis or `runServiceJob` adapter affordance —
implementation-coupled framing the catalog rejects.

## Tier 5 — Power system

Tracked upstream as #53 (draft). Self-contained subsystem; can slot in any time after Tier 1's `effects` surface lands.

- `PowerCreep` (currently stubbed via `Game.powerCreeps = {}`)
- `StructurePowerBank`
- `StructurePowerSpawn`
- Power resource flow + power-creep abilities

## Tier 6 — Cross-shard / InterShardMemory

Per audit: shard infrastructure exists, only the cross-shard API is missing.

- `InterShardMemory.getLocal` / `setLocal` / `getRemote`
- Cross-shard portal traversal (Portal object and destination shape landed in #159; full traversal depends on multi-shard runtime)

## Tier 7 — Server admin / tooling

Independent of game systems; largely client/backend work.

- **Room generation** — `map.generateRoom` (today: import-only via `scrape-world`)
- **CLI** (#79; admin-CLI proposal #137 was closed in favor of sandbox-recreation)
- **Bot management**
- **Pause / resume simulation**
- **Leaderboard** (currently stubbed)
- **Room history / replay**

## Polish — slot anywhere

- WASM support
- Mods / hooks audit
- Constants override
- Auth tokens

---

## Suggested next step

Tier 1 is still the right batch, but Portal landed in #159 and `Game.notify` is already in flight upstream. The next clean new feature branch should be **`RoomObject.effects`** because it unlocks Tier 4 strongholds and Tier 5 power without colliding with current PRs. After that, the remaining small standalone Tier 1 choices are construction-site stomping, spawn stomping, and `Game.gpl`.

If picking one Tier 2 item to start in parallel later: **Nuker** is the cleanest (well-scoped delayed-impact intent, no NPC entanglement) and closes the last RCL 8 row in the audit.
