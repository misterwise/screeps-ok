# screeps-ok

> _If your engine agrees, it's Screeps._

<!-- BADGES:START -->
[![vanilla](https://img.shields.io/badge/vanilla-1%20failing-red)](docs/status.md#vanilla-unexpected-failures) [![xxscreeps](https://img.shields.io/badge/xxscreeps-4%20failing-red)](docs/status.md#xxscreeps-unexpected-failures)
<!-- BADGES:END -->
![status](https://img.shields.io/badge/status-alpha-blue)

Behavioral conformance test suite for Screeps server implementations. Write
a test once, run it against any engine.

Current pass/fail breakdown and per-adapter parity gaps live in
[`docs/status.md`](docs/status.md) (regenerate with `npm run status:refresh`).
The browsable coverage dashboard is published at
[misterwise.github.io/screeps-ok](https://misterwise.github.io/screeps-ok/).

## Core docs

- [`behaviors.md`](behaviors.md) — the behavioral catalog
- [`docs/test-authoring.md`](docs/test-authoring.md) — how to write a test
- [`docs/adapter-spec.md`](docs/adapter-spec.md) — normative adapter contract
- [`docs/adapter-guide.md`](docs/adapter-guide.md) — practical adapter authoring
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — first-time setup and PR checklist
- [`AGENTS.md`](AGENTS.md) — rules and routes for coding agents
- [`docs/index.md`](docs/index.md) — full doc map

## Prerequisites

Both adapters compile native modules via `node-gyp`:

- **Node 24.x or newer**
- **git** — `xxscreeps` is installed directly from GitHub
- **C/C++ toolchain** — `xcode-select --install` (macOS), `build-essential
  python3` (Debian/Ubuntu), or `"Development Tools" python3` (RHEL/Fedora)

`npm run setup:xxscreeps` fetches the pinned `xxscreeps` and builds it from
source, so its first run is slower than later ones.

## Quick Start

```bash
nvm use 24
git clone https://github.com/misterwise/screeps-ok.git
cd screeps-ok
npm install

# Build runtime-specific native addons
npm run setup:xxscreeps
npm run setup:vanilla

# Run the suite on one adapter while iterating
npm test -- xxscreeps
npm test -- vanilla

# Full run on both adapters: writes fresh reports and regenerates the status docs
npm run parity
```

`npm test` runs a preflight check and exits with a concrete remediation
message if the active Node or native addons do not match the selected
adapter. Its `posttest` step regenerates [`docs/status.md`](docs/status.md) and
[`docs/coverage.html`](docs/coverage.html) from the last full-run reports in
`reports/`. A run writes a report only in CI mode, which `npm run parity` sets
(as does `CI=1 npm test`): an unfiltered run writes `reports/<adapter>.json`,
and a filtered one (`npm run parity -- <vitest-args>`) writes
`reports/<adapter>-partial.json`, which the docs never read.

Filter tests by path or name, the same as any vitest invocation:

```bash
npm test -- xxscreeps tests/05-construction-repair/5.1-build.test.ts
npm test -- xxscreeps -t "2 energy per WORK part"
```

See `npm test -- --help` for the full option set, or invoke the packaged
runner against an arbitrary adapter module:

```bash
npx screeps-ok --adapter ./path/to/adapter.ts --preflight none
```

## Adapter Selection

The runner sets `SCREEPS_OK_ADAPTER` to the selected adapter module. The
adapter is loaded once and provides a fresh shard per test.

- **xxscreeps** — wraps xxscreeps's `simulate()` API in-process. Fast.
  Requires `npm run setup:xxscreeps` to build the path-finder native addon.
- **vanilla** — wraps `screeps-server-mockup` (spawns engine child
  processes). Requires `npm run setup:vanilla` for `isolated-vm`,
  `@screeps/driver`, and the driver native addon. Runs serially.

After changing Node versions, reinstall dependencies so native modules
rebuild for the current runtime.

## Downstream Consumption

During the alpha, `screeps-ok` is consumed by cloning this repository and
running the suite in-place. Publishing as a package that a downstream engine
installs with `npm i -D screeps-ok` is tracked as a pre-publish release
gate — package metadata is not yet a stable installation contract, and
`"exports"` still resolves to raw TypeScript.

When a test fails in your engine, start at
[When a Test Fails](docs/adapter-guide.md#when-a-test-fails) in the adapter
guide.

Changes a consumer must act on (adapter contract, catalog IDs, runner
semantics) are recorded in [`CHANGELOG.md`](CHANGELOG.md) under Unreleased.
The first versioned release is the beta, cut with the first npm publish.

## Acknowledgments

The xxscreeps adapter depends on [xxscreeps](https://github.com/laverdet/xxscreeps)
by [@laverdet](https://github.com/laverdet). The vanilla adapter uses
[screeps-server-mockup](https://github.com/screepers/screeps-server-mockup).
Both are MIT-licensed.
