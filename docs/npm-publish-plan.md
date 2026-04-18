# `screeps-ok` npm publish plan

Goal: xxscreeps (and eventually vanilla's `screeps/engine`) can `npm i -D screeps-ok`, copy the starter adapter into their own source tree, wire it to their local engine, and run `npx screeps-ok --adapter ./adapters/screeps-ok/index.ts` against the canonical suite in CI. `xxscreeps` and `vanilla` are the only realistic consumers; we don't invest in scaffolding machinery beyond what those two need.

Last refreshed: 2026-04-17. Status: alpha, unpublished. All changes in this doc have been end-to-end validated via a smoke test against `laverdet/xxscreeps` `main` @ `819a8632` (our pinned sha), in the worktree at `~/Coding/Screeps/xxscreeps-screeps-ok-smoke`. Full suite result through the consumer flow: **985 passed / 88 expected-fail / 168 skipped / exit 0 — matches our own CI tallies exactly.**

## Design principle

**The consumer owns their adapter. `screeps-ok` ships the framework, tests, and catalog — not the adapter.**

This is the single most important decision in the plan. Every other choice follows from it. Concretely:

- No subpath exports for built-in adapters. The `adapters/xxscreeps/` and `adapters/vanilla/` trees in *this* repo stay as this-repo CI fixtures and reference implementations — they are **not** part of the published public API.
- Consumers write `adapters/screeps-ok/index.ts` (or wherever they prefer) in their own repo, import their engine's simulate/runtime via local paths or bare specifiers that resolve against their own workspace, and implement `ScreepsOkAdapter` from the `screeps-ok` package.
- Starter-code path is copy-paste from our reference adapters on GitHub, not npm subpath imports. Our README + `docs/adapter-guide.md` point at them.

This cleanly dissolves the self-import problem: xxscreeps's adapter doesn't go through `node_modules/xxscreeps/...`, it imports from its own `packages/xxscreeps/...` or whatever local path it wants. Vanilla-as-consumer is the same story.

## Scope of v0.2.0 (first npm tag)

Publish a single package `screeps-ok` containing:

- **Framework** (`src/`) — **raw `.ts` source**, not compiled. Vitest (our peer dep) handles TS natively, and shipping raw source avoids the dual-module-identity trap described below.
- **Runner CLI** (`bin/run.js`, `scripts/run-suite.js`, `scripts/preflight.js`, `scripts/lib/`) — plain JS, invoked as `npx screeps-ok`.
- **Canonical test suite** (`tests/`) — raw `.test.ts`, run by the consumer's vitest using our packaged `vitest.config.ts`.
- **Starter adapters** (`starter/xxscreeps/`) — the copy source for consumers. Generated from `adapters/xxscreeps/` by `scripts/generate-starter.js` (prepublish) with imports mechanically rewritten to `'screeps-ok'`. Single source of truth stays in `adapters/xxscreeps/`. Consumers copy the directory wholesale; no scaffolding CLI needed given the small consumer set.
- **Catalog** (`behaviors.md`) — referenced at runtime by the matrices.
- **Public adapter docs** — `docs/adapter-spec.md`, `adapter-guide.md`, `test-authoring.md`.

**Not shipped in the tarball:**

- `adapters/xxscreeps/**`, `adapters/vanilla/**` — this-repo CI fixtures. The regenerated `starter/` trees ship instead.
- `dist/**` — we don't compile.
- `server/`, `screeps/`, `reports/`, `.agent/`, CLAUDE files, internal plan docs.

Use a `"files"` allowlist (not `.npmignore`) enforced by `scripts/validate-package.js`.

Current size: 178 files, 250 KB packed, 1.27 MB unpacked.

## `package.json` shape (shipped)

| Field | Value |
|---|---|
| `version` | `0.2.0` |
| `main` | `./src/index.ts` |
| `types` | `./src/index.ts` |
| `exports["."]` | `{ types: "./src/index.ts", import: "./src/index.ts" }` |
| `files` | `["src", "tests", "bin", "scripts/run-suite.js", "scripts/preflight.js", "scripts/lib", "behaviors.md", "docs/adapter-spec.md", "docs/adapter-guide.md", "docs/test-authoring.md", "vitest.config.ts"]` |
| `postinstall` | **removed** — xxscreeps clone moved to `setup:xxscreeps` |
| `prepare` | `install-git-hooks.js` (early-returns when `.git/` absent) |
| `prepublishOnly` | `node scripts/generate-starter.js && node scripts/validate-package.js` |
| `build:starter` | `node scripts/generate-starter.js` — regenerates `starter/xxscreeps/` from `adapters/xxscreeps/`. CI fails if it produces a diff. |
| `dependencies` | `{ "@screeps/common": "^2.16.0" }` — our `src/constants.ts` requires it at runtime; not a transitive any consumer can be trusted to supply |
| `peerDependencies` | `{ "vitest": "^3" }` |
| `devDependencies` (`screeps`, `screeps-server-mockup`) | stay in devDependencies — only needed for *this* repo's CI |

No subpath exports. One entry point.

## The five non-obvious problems the smoke test surfaced

All five landed as real code changes, not plan notes. Any fork of screeps-ok that wants to ship as a package needs to solve them the same way.

### 1. Cross-realm class identity (the dominant bug)

`RunPlayerError` is both thrown inside the adapter and caught inside `src/fixture.ts`. Tests catch it again (`expect(err).toBeInstanceOf(RunPlayerError)`).

The three import paths can land on different `errors.ts` module instances depending on how the consumer resolves things:

- Adapter → `import { RunPlayerError } from 'screeps-ok'` → package resolution → `<pkg>/src/index.ts` → `./errors.js`
- Fixture → `import { RunPlayerError } from './errors.js'` → resolved against fixture's own location
- Tests → `import { RunPlayerError } from '../../src/errors.js'` → relative from inside the installed tarball

Even when all three resolve to the same filesystem path, vitest's SSR graph can end up with two module instances (one inlined, one externalized). Default `instanceof` is prototype-chain-based → both copies of the class have separate prototypes → check fails silently → genuine adapter success looks like a test failure.

**Fix**: `RunPlayerError` overrides `Symbol.hasInstance` with a check for a `Symbol.for('screeps-ok.RunPlayerError')` marker stamped on every instance. Any copy of the class recognizes instances created by any other copy. Zero API surface change — `instanceof RunPlayerError` just works cross-realm. See `src/errors.ts`.

**Guideline going forward**: any exported class that participates in try/catch or assertion paths across the adapter/fixture/test boundary needs the same marker-override pattern. Plain classes will break in the same way.

### 2. `@screeps/common` CJS → ESM interop

`src/constants.ts` re-exports canonical constant tables from `@screeps/common/lib/constants.js`. That package is CJS-style — `Object.assign(module.exports, {...})`. Node's static CJS→ESM interop can't enumerate those dynamic property assignments, so `import { REACTIONS } from '@screeps/common/lib/constants.js'` fails with "does not provide an export named 'REACTIONS'" in native Node ESM. Our own CI worked because vitest's SSR transform papered over the gap.

**Fix**: pull everything through `createRequire(import.meta.url)` once, then re-export with explicit types. Works uniformly under native Node ESM, vitest's SSR, and any downstream bundler. See `src/constants.ts`.

**Guideline**: never rely on ESM named imports from a CJS Screeps package with dynamic `exports` assignment. Use `createRequire` + explicit types.

### 3. `xxscreeps` workspace self-link externalize

In the consumer, `node_modules/xxscreeps → ..` (workspace self-link). After vite's realpath resolution, xxscreeps's files are at `<consumer-root>/dist/<subdir>/...`, not `node_modules/xxscreeps/...`. Our externalize regex was keyed on the latter, so vite started SSR-transforming xxscreeps — which uses `import.meta.resolve`, which vite's SSR shim doesn't implement.

**Fix**: broaden `test.server.deps.external` to match known xxscreeps dist subdirs in addition to the `node_modules/` prefix:

```ts
external: [
  /node_modules\/(?:@[^/]+\/)?xxscreeps\//,
  /\/dist\/(?:backend|config|driver|engine|functional|game|mods|schema|scripts|utility|test)\//,
],
```

Also set `resolve.preserveSymlinks: true` as a belt-and-braces measure. See `vitest.config.ts`.

### 4. Reports path

Vitest's `outputFile: 'reports/...'` is relative to the package root, which in a consumer is `node_modules/screeps-ok/reports/...` — invisible to their CI. Route through `SCREEPS_OK_PROJECT_ROOT` so reports land in the consumer's own `reports/` dir. See `vitest.config.ts` + `scripts/run-suite.js`.

### 5. Adapter-declared limitations (not a central path-sniffing registry)

Some tests must be skipped rather than asserted-to-fail — e.g. `MOVE-PULL-007:self` hangs xxscreeps in an infinite circular-pull check. In this repo we originally decided "is this xxscreeps?" by sniffing the adapter's filesystem path for `/adapters/xxscreeps/`. That works in-repo but breaks in any consumer whose adapter lives somewhere else (e.g. `packages/xxscreeps/adapters/screeps-ok/`).

**Fix**: the adapter declares its own limitations via an optional `limitations` field on `ScreepsOkAdapter`. Added `AdapterLimitation` and `AdapterLimitations` types in `src/limitations.ts`. `limitationGated(name)` in `src/test-helpers.ts` reads the active adapter's `limitations` at test-run time (not module-import time) and skips when the flag is set. The reference adapter sets `limitations: { pullSelfHang: true }`; the generated `starter/xxscreeps/` inherits it; any consumer who copies via `screeps-ok init` gets the correct gate without knowing why.

**Guideline**: any future quirk that needs a skip-not-fail (rather than a full capability disable) is a new entry in `AdapterLimitation`. Don't introduce path-sniffing fallbacks.

## Consumer pattern

From a fresh consumer repo (xxscreeps today; vanilla eventually):

```bash
npm i -D screeps-ok vitest
cp -r node_modules/screeps-ok/starter/xxscreeps adapters/screeps-ok
# (edit adapters/screeps-ok/index.ts if engine wiring differs)
npx screeps-ok --adapter ./adapters/screeps-ok/index.ts --preflight none
```

The resulting layout:

```
<engine-repo>/
  adapters/screeps-ok/
    index.ts, snapshots.ts, sandbox-runner.ts, engine-internals.ts
    parity.json         — overlay; extends screeps-ok/parity/xxscreeps.json
  package.json
    devDependencies: { "screeps-ok": "^0.2", "vitest": "^3" }
    scripts:
      "test:screeps-ok": "screeps-ok --adapter ./adapters/screeps-ok/index.ts --preflight none"
  .github/workflows/screeps-ok.yml — matrix over Node 24, runs test:screeps-ok
```

To pick up new framework capabilities added upstream, the consumer re-copies `starter/xxscreeps/` and merges against their local edits with git. Plain `cp` and `git diff` handle this better than a bespoke scaffolding CLI would for a two-consumer set.

For forks that have renamed xxscreeps dirs (e.g., `pathfinder` → `path-finder`), patch the bare `xxscreeps/*` specifiers in the copied adapter. Failure mode is a clean "Failed to load url" at resolve time — easy to find, trivial to fix.

### Parity baseline ships in the package; consumer file is an overlay

The canonical expected-failure list for each engine ships inside the package at `parity/<engine>.json` (currently `parity/xxscreeps.json`, generated from `adapters/xxscreeps/parity.json` by `scripts/generate-starter.js`). Consumers don't author or copy that file — they get it via `npm install screeps-ok`, and `npm update screeps-ok` is what propagates our pin bumps and gap prunes.

The consumer-facing `parity.json` (shipped in `starter/<engine>/parity.json` and copied into their `adapters/screeps-ok/` dir) is a thin overlay:

```json
{
  "extends": "screeps-ok/parity/xxscreeps.json",
  "expected_failures": {},
  "expected_passes": []
}
```

The reporter (`src/reporters/parity-reporter.ts`) resolves `extends` via `createRequire(overlayPath).resolve(spec)` — standard Node subpath resolution, made reachable by the `./parity/*` export in `package.json`. It then merges:

- `base.expected_failures ∪ overlay.expected_failures` — overlay entries with the same gap id replace the base entry.
- minus any gap id listed in `overlay.expected_passes` — the consumer's escape hatch for "I fixed this in my fork before screeps-ok pruned it from base."

Two-direction sync, no manual mirror:

- We add a canonical test → consumer CI flags it as an unexpected failure → they fix the engine or add a gap entry to their overlay's `expected_failures` (and file an issue so we catalog it).
- We bump our xxscreeps pin and prune base entries → publish a patch → consumer `npm update`s and the entries disappear from their merged set automatically.
- Consumer fixes a base-listed gap before we publish → they add the gap id to `expected_passes` until the next package update makes it a no-op.

In this repo's own dev path the reporter still loads `adapters/xxscreeps/parity.json` directly (no `extends`), so the merge is a no-op and behavior is unchanged.

### Starter templates ship in the tarball

`scripts/generate-starter.js` runs at prepublish and regenerates `starter/xxscreeps/` from `adapters/xxscreeps/` with imports rewritten to `'screeps-ok'`. Consumers `cp -r node_modules/screeps-ok/starter/xxscreeps adapters/screeps-ok/` — offline, no network call, no scaffolding machinery. When we add a `starter/vanilla/` for the second consumer, the generator picks up the new template automatically.

CI runs `npm run build:starter` and fails if the working tree has a diff, so a hand-edit to `adapters/xxscreeps/` that someone forgets to regenerate never lands.

## Pre-publish checklist

1. `package.json` in the state above; no `postinstall`; `prepublishOnly` runs `generate-starter && validate-package`.
2. `scripts/validate-package.js` — allowlist enforcement on tarball contents. Runs `npm pack --dry-run --ignore-scripts` (the `--ignore-scripts` matters: `prepare`'s stdout would otherwise contaminate the JSON). Fails on any `CLAUDE*.md`, `.agent/`, `adapters/`, `dist/`, `server/`, `screeps/`, `reports/`, `.env*`, or `.local.*`. Wired into CI on every PR.
3. CI step: run `npm run build:starter` and fail on a working-tree diff. Ensures `starter/` never drifts from `adapters/xxscreeps/`.
4. `npm pack --dry-run` review; eyeball size + contents.
5. **Two real consumer smoke tests, both green before tag:**
   - **xxscreeps**: fresh clone of `laverdet/xxscreeps`, `pnpm install`, `pnpm build`, run mods bootstrap (`node packages/xxscreeps/dist/config/mods/index.js`), `pnpm add -D file:.../screeps-ok-0.2.0.tgz vitest@^3`, `cp -r node_modules/screeps-ok/starter/xxscreeps packages/xxscreeps/adapters/screeps-ok`, run the full suite. Must produce `985 passed / 88 expected-fail / 168 skipped / exit 0` (or current tallies — compare against `docs/status.md`).
   - **vanilla**: analogous against `screeps/engine`. (Not exercised in the v0.2 smoke cycle; blocker before tag — needs a `starter/vanilla/` template first.)

   Both scripts must nuke `node_modules/.pnpm/screeps-ok@*` between tarball rebuilds — pnpm keys its store by the tarball filename, not content hash, so it happily reuses stale extracted contents.

6. Compare smoke-test tallies to `docs/status.md`. Any delta means one of the non-obvious problems above has regressed.
7. `npm publish --access public` with 2FA. Tag + GitHub release.
8. Open the xxscreeps integration PR. The adapter files are whatever `cp -r starter/xxscreeps/` produced; no hand-editing needed if upstream paths match our reference.

## Versioning

Pre-1.0, semver advisory:

- **Minor bumps**: adapter interface additions, new required capabilities, new exports.
- **Patch bumps**: bug fixes, new tests, doc updates.

At 1.0:

- `ScreepsOkAdapter` interface frozen within major.
- Catalog IDs in `behaviors.md` stable within major.
- Fixture / `test()` / `simulate()` signatures stable within major.
- Cross-realm markers (`Symbol.for('screeps-ok.RunPlayerError')` etc.) are part of the public contract — changing them is a major bump.

## Deferred to v0.3+

- A `vanilla` template (`starter/vanilla/`) alongside the `xxscreeps` one — when we actually integrate vanilla.
- Publishing `behaviors.md` as HTML at a stable URL.
- Shipping compiled `.js` alongside `.ts` for non-vitest consumers. Not needed today; reconsider if a non-vitest consumer appears.
- A scaffolding CLI (`screeps-ok init`) if the consumer set grows beyond xxscreeps + vanilla and the `cp -r` instruction becomes a real friction point. Today it would be speculative infrastructure.

## Risks

- **Tarball leaks** — repo has `CLAUDE.local.md`, `.agent/`, internal workspace refs. `files` allowlist + `validate-package.js` is the mitigation.
- **Node version drift** — we require Node 24; consumer CI may be older. Document in README; preflight catches it at runtime.
- **Parity-baseline maintenance** — base list ships in the `screeps-ok` package (`parity/<engine>.json`); consumer's `parity.json` is an overlay that `extends` it. `npm update screeps-ok` is the sync mechanism. `adapter-guide.md` should explain the overlay shape and the `expected_passes` escape hatch.
- **Starter-adapter drift** — if our reference changes and a consumer's copy doesn't, they miss fixes. README note: "your adapter is yours; rebasing from our reference is manual."
- **Future cross-realm hazards** — any new exported class used across the adapter/fixture/test boundary must adopt the `Symbol.hasInstance` marker pattern. Adding a new class without this is a silent trap; adapter-spec.md should call it out in the extension section.
