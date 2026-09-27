# Agent Guide

For coding agents working in this repository, and for anyone reviewing their
work. It routes to the public docs and states the rules agents most often
break. [`CONTRIBUTING.md`](CONTRIBUTING.md) is the human-paced version.

`screeps-ok` is a conformance suite for Screeps server engines.
[`behaviors.md`](behaviors.md) catalogs public game behavior by ID. Tests under
`tests/NN-*/` implement catalog entries through the `shard` fixture, and the
adapters under `adapters/xxscreeps/` and `adapters/vanilla/` translate that
fixture to each engine. Those adapters are this repo's CI fixtures and
reference implementations; an engine that installs the package owns its own.

## Where to look

| Task | Read |
| --- | --- |
| Write or fix a test | [`docs/test-authoring.md`](docs/test-authoring.md), then one sibling test in the same `tests/NN-*/` directory |
| Add, split, or drop a catalog entry | [`CONTRIBUTING.md` → Catalog changes](CONTRIBUTING.md#catalog-changes); matrix entries also [`docs/behavior-matrices.md`](docs/behavior-matrices.md) |
| Change an adapter | [`docs/adapter-spec.md`](docs/adapter-spec.md) (normative), then [`docs/adapter-guide.md`](docs/adapter-guide.md) |
| Triage a failing test from an engine repo | [`docs/adapter-guide.md` → When a Test Fails](docs/adapter-guide.md#when-a-test-fails) |
| Read a run's result | [`CONTRIBUTING.md` → Reading Parity Results](CONTRIBUTING.md#reading-parity-results) |
| Current pass/fail state | [`docs/status.md`](docs/status.md) (generated) |

## Rules

- **The catalog comes first.** A test implements an entry in `behaviors.md`;
  it never invents behavior. Its title starts with the catalog ID. If no entry
  fits, propose one before writing the test.
- **Public surface only.** Tests use the `shard` fixture and player code run
  through `runPlayer`, never adapter internals or engine objects. Expected
  values come from the constants in `src/index.ts` and the case lists in
  `src/matrices/`, never from the engine under test or from string or number
  literals.
- **Both adapters.** Every test runs on `xxscreeps` and `vanilla`. A
  capability skip on one of them is not verification.
- **Never weaken an assertion to fit an engine.** A test failing on one
  adapter is often a real engine gap, so check that adapter's `capabilities`
  and `parity.json` first. Gate a missing feature with `shard.requires(...)`;
  register a divergence in `adapters/<engine>/parity.json`.
- **Suspect the setup before the catalog.** When a test disagrees with
  vanilla, rule out the [traps](docs/test-authoring.md#traps), then read the
  vanilla engine source (`node_modules/@screeps/engine/src/`). Conclude an
  entry is wrong only after both, and cite the file and line.
- **`tests/` ships.** The npm package runs every test under `tests/`,
  framework tests included, in consumer installs. A test must not read files
  the package leaves out, such as `CONTRIBUTING.md`, `adapters/`, or
  `reports/`; `package.json`'s `files` lists what ships.
- **Don't hand-edit generated files**: `docs/status.md`, `docs/coverage.html`,
  the README badge region, `starter/`, and `parity/*.json` (edit
  `adapters/<engine>/parity.json` instead). Resolve merge conflicts in them by
  regenerating with `npm run status:refresh`.

## Running

| Command | What it does |
| --- | --- |
| `npm test -- [adapter] <file-or-filter>` | One adapter (default `xxscreeps`), filtered. Use while iterating. |
| `npm run parity` | Full suite on both adapters, then regenerates the status docs. Takes minutes: once per change, not per edit. |
| `npm run parity -- <vitest-args>` | Filtered run. Writes `reports/<adapter>-partial.json` and leaves the docs alone. |
| `npm run status:refresh` | Regenerates the status docs from existing reports. Runs no tests. |
| `npm run check` | The static checks pre-commit and CI run: typecheck, capability gates, catalog labels, doc references, engine-free framework tests. Rewrites the generated files it owns. |

- **Capture, don't stream.** Suite output runs to thousands of lines.
  Redirect it and read the log:

  ```bash
  mkdir -p .test-output
  npm run parity > .test-output/parity.log 2>&1; echo "exit=$?"
  grep -n 'Parity:' .test-output/parity.log
  ```

  Never re-run the suite to see another slice of its output; the log and
  `reports/*.json` already hold it.
- **The exit code is the verdict.** 0 means every failing test is a
  registered gap; the per-adapter pass/fail summary counts those gaps as
  failures, so don't triage from it.
  [Reading Parity Results](CONTRIBUTING.md#reading-parity-results) says what
  each `Parity:` line asks of you.
- **Skips are static.** "Why is X skipped on Y?" is answered by the test's
  `requires(...)` and the adapter's `capabilities`, not by a run.
- **Sandboxes.** The vanilla adapter starts a server on localhost (`::1`). A
  sandbox that blocks binding local ports fails every vanilla test with
  `listen EPERM`; run vanilla with that permission granted.

## Before you finish

1. `npm run check`.
2. The smallest test run that covers the change, on both adapters.
3. `npm run parity` if you changed tests, the catalog, an adapter, or
   `parity.json`, and commit the regenerated docs with the change.
4. If the change alters a command, a `Parity:` line, a generated file, or a
   rule this file states, update the doc that says so in the same change.
   `npm run check` catches broken links and paths, not stale claims.
5. A consumer-visible change (adapter contract, catalog ID rename or drop,
   runner or reporter semantics) gets an entry under **Unreleased** in
   [`CHANGELOG.md`](CHANGELOG.md).
