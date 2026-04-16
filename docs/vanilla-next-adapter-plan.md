# `vanilla-next` adapter plan

A second vanilla-adjacent adapter that drives **unreleased** `screeps/engine` code instead of the tagged npm build. Purpose: catch regressions and fixes on master before they hit community private servers.

Last refreshed: 2026-04-14.

## Why this, not literal PTR

"PTR adapter" was the original framing and is directionally right, but mechanically wrong:

- PTR (Public Test Realm) is a **live server** operated by Screeps the company. It runs pre-release engine code, but there's no published way to download or self-host the PTR build.
- The engine repo (`screeps/engine`) has no `ptr` branch. Pre-release work lives on `master` between tagged releases; npm publishes happen periodically.
- So the addressable signal for this repo is **`screeps/engine` master** (and the four sibling packages it depends on), not PTR itself.

Naming: `vanilla-next` (or `vanilla-head` / `upstream`) — stays in the `vanilla` family, signals "ahead of stable."

## Architectural benefit

One new adapter, new parity file, no test-suite changes. Buys:

- **Pre-release regression trap** — vanilla's master breaks something → suite flips red on the daily run, not after the next npm publish when bots break.
- **Fix-tracking** — a bug documented as a vanilla parity gap (see `canonical-expected-plan.md`) flips to unexpected-pass on `vanilla-next` before the fix ships. Confirms the fix and gives us a deadline to remove the gap from the vanilla side.
- **Version pin visibility** — status dashboard shows the exact engine SHA each adapter ran against. Silent behavior drift between vanilla npm releases stops being silent.
- **No test rewrite** — adapter is near-identical to `vanilla`, just different module resolution. The catalog is already the canonical source of the contract.

## Blockers to resolve first

### 1. Peer-dep conflict with `screeps-server-mockup`

`screeps-server-mockup@1.5.1` peers `@screeps/engine ^4.1.2`. Engine master today is 4.3.x, so the range still satisfies, but any 5.x bump will break the constraint and mockup upstream is not actively maintained.

Three options, cheapest first:

1. **Relax the peer** — vendor a patched `screeps-server-mockup` into `adapters/vanilla-next/vendor/`. One-line peerDependencies widening. Low risk, but we now own that fork.
2. **Override via npm `overrides`** — pin mockup's peer resolution in root `package.json`. Cleanest; no vendored copy. Recommended.
3. **Replace mockup** — our vanilla adapter only touches a small slice of mockup's API (`ScreepsServer`, `TerrainMatrix`, `world.reset/addRoom/setTerrain/addRoomObject`, `common.storage`, `User`). Writing a thin direct-to-engine equivalent is ~300 lines and removes a dead dependency. Heavier, but gives both `vanilla` and `vanilla-next` the same lighter base. Treat as a v2.

Start with option 2.

### 2. Native rebuild cost

`isolated-vm` and `@screeps/driver/native` rebuild per install and per node version. Two vanilla installs means two native builds, two `setup:vanilla*` scripts, two Node-version-mismatch footguns.

Mitigation: install the extra engine under `adapters/vanilla-next/.engine/` via a dedicated `setup:vanilla-next` script that pins its own `node_modules`, so the stable install isn't perturbed. Share `isolated-vm` across both if versions match.

### 3. Master-is-broken days

Engine master will occasionally be genuinely broken (failed tests in screeps/engine's own CI, build failures, etc.). The daily `vanilla-next` run will fail hard.

Mitigation: treat setup-failure as a distinct outcome from test-failure in the status dashboard. Flag as "upstream broken" rather than "regression detected."

## Adapter layout

```
adapters/vanilla-next/
  index.ts           — thin subclass/re-export of VanillaAdapter with alternative module resolution
  parity.json        — gaps between vanilla (stable npm) and vanilla-next (master)
  setup.sh           — clones/pulls screeps/engine + driver + common + backend + launcher to .engine/
  .engine/           — gitignored, populated by setup
README.md            — how to run, cadence, known-broken-days policy
```

The `index.ts` is ~15 lines: import `VanillaAdapter` from `../vanilla/index.js`, override the mockup import path to the locally-installed copy, export. No duplication of game logic.

## Runner integration

Already supported — `scripts/run-suite.js:105-117` accepts arbitrary external adapter paths via `--adapter ./adapters/vanilla-next/index.ts --preflight none`. Needs:

1. `scripts/setup.js` — add `'vanilla-next'` to `validTargets`; `setupVanillaNext()` clones the five screeps packages to `.engine/` and rebuilds native addons against that tree.
2. `scripts/preflight.js` — add `checkVanillaNext()` mirroring `checkVanilla()`, pointing at the `.engine/` paths.
3. `scripts/parity-report.js` — no change needed; treats adapter names as arbitrary.
4. `scripts/generate-status.js` — `DEFAULT_ADAPTERS` becomes `['vanilla', 'vanilla-next', 'xxscreeps']`. Verify parity-file loading is keyed by adapter name (looks like yes, `loadParityFile(adapter)`).
5. `package.json` scripts — `setup:vanilla-next`, and `parity:next` as an alias for `npm run parity -- vanilla-next` so nightly CI has a single command.

## Parity file shape

Same schema as `adapters/xxscreeps/parity.json`, with two deliberate gap categories expressed in the gap id:

- `head-regression-*` — master breaks what stable does right. **Action:** file upstream issue immediately; include link in the entry.
- `head-fix-*` — master fixes what stable does wrong. **Action:** cross-reference to the matching gap in `adapters/vanilla/parity.json` (see `canonical-expected-plan.md`). When the fix hits npm, remove both entries.

Empty at launch. Gaps appear organically as master diverges.

## Companion doc

`docs/vanilla-next-parity-gaps.md` — symmetric to `docs/xxscreeps-parity-gaps.md`. Root-cause analysis with engine source file:line. Stays thin until there's something to write about.

## CI cadence

Three tiers, increasing coverage for increasing cost:

1. **Daily scheduled job** (recommended starting point) — `npm run parity -- vanilla-next`. Updates `.engine/` to latest master, runs suite, opens an issue if gap count changed. Catches regressions within 24 hours.
2. **On every `screeps/engine` master push** — via GitHub webhook or polling `git ls-remote`. Faster feedback but noisier if engine master is active.
3. **Per-PR-to-this-repo** — overkill. `vanilla-next` can't block PRs in this repo; it tracks an external dependency, not internal state.

Start with tier 1. Move to tier 2 only if there's a stretch of weeks with multiple missed regressions.

## What this does NOT do

- Doesn't catch bugs already present in stable (those are `canonical-expected-plan.md`'s job).
- Doesn't exercise PTR-specific behavior (Screeps doesn't publish PTR engine builds).
- Doesn't run faster than `vanilla` — it's the same engine code path, just pinned differently.
- Doesn't replace `vanilla`. Stable is still the reference for "what a Screeps bot on a community private server experiences today."

## Phasing

1. **Phase 0 — spike** (half day): manual `npm install github:screeps/engine#master` in a worktree, verify mockup still drives it, pick one flaky test to sanity-check the setup.
2. **Phase 1 — infrastructure** (1–2 days): `adapters/vanilla-next/` skeleton, setup script, preflight, status wiring. No gaps yet.
3. **Phase 2 — CI** (half day): daily scheduled workflow, issue-filing bot, status dashboard section.
4. **Phase 3 — bug-filing discipline** (ongoing): when a regression shows up, file upstream; when a fix shows up, cross-reference canonical-vanilla gaps.

Total cost to stand up: ~3 days. Ongoing: one daily CI minute plus triage time per regression.

## Open questions

- **All five packages, or engine only?** Recommend all five (engine/driver/common/backend/launcher). Regressions in `driver` or `common` are real and bite tests just as hard as engine regressions. Cheaper to track them all from day one than retrofit later.
- **What about `screeps-launcher` (Go-based)?** Not on our path — we use mockup, which bypasses the launcher. Skip.
- **Cadence for stable pin bumps?** When npm publishes a new `screeps` release, bump `vanilla`'s pin in the same PR that adjusts for any behavior change. `vanilla-next` either flips to match (gap closed) or stays ahead (continued divergence).
