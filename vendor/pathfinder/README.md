# Vendored @xxscreeps/pathfinder build

The xxscreeps engine consumes `@xxscreeps/pathfinder` as a published npm
package (JS wrapper + prebuilt napi binary), and upstream only publishes on a
version bump. When the pinned source under `packages/pathfinder` moves past
the latest release, the prebuild lags behind the pin — pathfinder fixes exist
in source but never run in the suite.

This directory holds a complete package built from the pinned source:

- `package/` — wrapper (`package.json`, compiled `dist/`, `module/` loader)
- `platform/<triplet>/pf.<triplet>.node` — native binaries for the platforms
  the suite runs on (darwin-arm64 locally, linux-x64-gnu in CI)
- `manifest.json` — source sha + tree hash, package version, native ABI

`scripts/build-xxscreeps.js` applies it automatically during
`npm run setup:xxscreeps` **unless** the registry version is newer than
`manifest.version` — so the moment upstream publishes a release that
supersedes this build, every setup reverts to the official prebuild and this
directory can be deleted.

Refresh (only needed when a pin bump changes `packages/pathfinder`; setup
prints a warning when the source drifts from `manifest.sourceTreeHash`):

```
npm run pf:build            # host platform (macOS: brew install cmake ninja boost lld llvm)
npm run pf:build:linux-x64  # via docker (debian:sid, clang-22)
```

Both platforms must be rebuilt together — the wrapper package is shared, and
binaries built from different pins would make local and CI results diverge.
The build recipe mirrors upstream's `.github/workflows/pathfinder.yml`, minus
the PGO passes.
