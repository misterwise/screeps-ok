# Contributing to screeps-ok

This repository is easy to work in once the vocabulary and generated files make
sense. This guide is the short path for first-time contributors.

If you want the full document map, including maintainer-only docs, see
[`docs/index.md`](docs/index.md). Coding agents start at
[`AGENTS.md`](AGENTS.md), which condenses this guide.

## Before You Start

- Use Node 24.x or newer.
- Install dependencies from the repository root with `npm install`.
- Build only the adapter you need first:
  - `npm run setup:xxscreeps`
  - `npm run setup:vanilla`

Both adapters build native modules. If you switch Node versions, reinstall
dependencies and rerun the relevant `setup:*` command before testing again.

## First Successful Run

Start with the fast adapter first. It has the shortest feedback loop.

```bash
nvm use 24
npm install
npm run setup:xxscreeps
npm test -- xxscreeps tests/00-adapter-contract/error-model.test.ts
```

Then prove the slower adapter path separately:

```bash
npm run setup:vanilla
npm test -- vanilla tests/16-room-mechanics/16.3b-game-api.test.ts
```

## Contributor Paths

### Reviewing the project

Read in this order:

1. `README.md`
2. `CONTRIBUTING.md`
3. `docs/test-authoring.md`
4. `behaviors.md`
5. `docs/behavior-matrices.md`
6. `docs/adapter-spec.md`

### Adding or updating canonical tests

- Define or confirm the behavior in `behaviors.md`.
- If it is matrix-backed, keep the executable case list in `src/matrices/` and
  document the scope in `docs/behavior-matrices.md`.
- Follow `docs/test-authoring.md` for determinism and assertion rules.
- Prefer targeted test runs while iterating.

### Catalog changes

- IDs take the shape `FAMILY-001` or `FAMILY-SUBFAMILY-001`. A test or
  `parity.json` entry can name one row of an entry with a camelCase suffix,
  `STRUCTURE-HITS-001:storage` (see Naming in `docs/test-authoring.md`).
  Extend an existing family before starting a new one.
- An entry needs a canonical source: stable vanilla does it, the Screeps API
  docs promise it, or an upstream bug report or fix says vanilla gets
  documented behavior wrong. Record which in the entry or its `parity.json`
  gap. An entry that only restates an unmerged feature proposal doesn't
  belong in the catalog.
- A test earns its ID by covering the whole entry. If it covers only part,
  rewrite the test or split the entry; don't tag partial coverage.
- Name the kind of change in the PR: merge, drop, or split. After a merge,
  the surviving entry's description states its broader scope.
- Write a test from the entry's description, not from a sibling test's
  implementation. Two tests that look alike are not duplicates until you've
  confirmed they assert the same behavior.
- Renaming or dropping an ID is a consumer-visible change; note it in
  `CHANGELOG.md`.

### Adding or updating an adapter

- Start with `docs/adapter-guide.md`.
- Treat `docs/adapter-spec.md` as the normative contract.
- Run adapter-contract tests before broad gameplay coverage.

## Generated Files

`npm test` always runs `posttest`, which regenerates:

- `docs/status.md`
- `docs/coverage.html`
- the adapter badge region of `README.md` (between `<!-- BADGES:START -->`
  and `<!-- BADGES:END -->`)

That means even a targeted local test run can dirty the worktree.

A pre-commit hook (installed via `npm install`, wired through `.githooks/`)
runs `npm run check` against the staged tree. Its generators rewrite the
README badges, `docs/status.md`, `docs/coverage.html`, `starter/`, and
`parity/`, and the hook stages whatever they change, so each commit carries
generated files that match it. CI runs the same checks and fails when they
would change a committed file. For checks of your own, add an executable
`pre-commit.local` beside the hook in `.githooks/`; the hook runs it after
its own checks, and git ignores it.

Commit regenerated files when the underlying behavior inventory, parity data, or
published dashboard is intentionally changing.

Do not include incidental local artifacts in a normal doc-only or narrow debug
PR:

- `reports/`
- unrelated `docs/status.md` changes from exploratory runs
- unrelated `docs/coverage.html` changes from exploratory runs

If you intentionally changed parity declarations or catalog coverage, run
`npm run status:refresh` and review the generated output before opening the PR.

## Reading Parity Results

`npm test`, `npm run parity`, and `npx screeps-ok` check every run against the
adapter's `parity.json`, and the exit code is the verdict. It is 0 when every
failing test is a registered gap. Otherwise the `Parity:` lines printed above
vitest's failure list say what needs attention:

| Line | Meaning | Action |
| --- | --- | --- |
| `Parity: N expected failure(s)` | Registered gaps, still failing | None |
| `Parity: N unexpected pass(es)` | A registered gap now passes | Remove its test IDs, or the whole gap, from `parity.json` |
| `Parity: N registration(s) matched no test that ran` | Full runs only: a registered ID is misspelled, renamed, or skipped for a missing capability | Fix or prune the registration |

Any other `Parity:` line names its own fix. A failing test that isn't listed
under expected failures is a genuine failure.

The per-adapter summary `npm run parity` prints (`xxscreeps: N/T passed,
F failed`) is vitest's raw count, which includes the registered gaps. Don't
triage from it.

A change confined to one adapter can't move the other adapter's results. If
it does, suspect the shared environment, such as a native module built for a
different Node version, rather than the change.

## Glossary

- `adapter`: The translation layer between `screeps-ok` and a specific Screeps
  engine implementation.
- `behavior catalog`: `behaviors.md`, the checklist of concrete public gameplay
  rules the suite owns.
- `matrix`: A bounded family of generated cases backed by a documented source
  and executable case list in `src/matrices/`.
- `capability`: An honest adapter feature flag used to skip tests the engine
  cannot exercise yet.
- `parity gap`: A known difference from canonical behavior recorded in an
  adapter's `parity.json`.

## PR Checklist

Before opening a PR, run the smallest useful validation set for your change:

1. `npm run check`: the static checks pre-commit and CI run (typecheck,
   capability gates, doc references, the engine-free framework tests, and the
   generated files)
2. Targeted `npm test -- <adapter> <file-or-filter>`
3. `npm run parity` if you changed tests, the catalog, an adapter, or parity
   declarations: the full suite on both adapters, which also regenerates the
   status docs
4. `npm run status:refresh` if you only need the docs regenerated from existing
   reports (it runs no tests)

`npm run check` confirms that doc links, anchors, `npm run` scripts, and repo
paths exist. It can't confirm that what a doc says is still true, so also
check:

- A change to a command, a `Parity:` line, a generated file, or a rule
  [`AGENTS.md`](AGENTS.md) states updates that doc in the same change.
- Internal doc references still match `src/matrices/` and `src/shape-divergences.ts`.
- Generated files in the diff are intentional.
- A change a consumer must act on (adapter contract, catalog ID renames or
  drops, runner or reporter semantics) has an entry under **Unreleased** in
  `CHANGELOG.md`.
