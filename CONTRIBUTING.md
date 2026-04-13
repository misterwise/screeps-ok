# Contributing to screeps-ok

This repository is easy to work in once the vocabulary and generated files make
sense. This guide is the short path for first-time contributors.

If you want the full document map, including maintainer-only docs, see
[`docs/index.md`](docs/index.md).

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
npm test xxscreeps -- tests/00-adapter-contract/error-model.test.ts
```

Then prove the slower adapter path separately:

```bash
npm run setup:vanilla
npm test vanilla -- tests/16-room-mechanics/16.3b-game-api.test.ts
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
re-runs `scripts/generate-status.js` and blocks the commit if the README
badges or `docs/status.md` disagree with the latest `reports/*.json`. When
it fires, stage the regenerated files and commit again.

Commit regenerated files when the underlying behavior inventory, parity data, or
published dashboard is intentionally changing.

Do not include incidental local artifacts in a normal doc-only or narrow debug
PR:

- `reports/`
- unrelated `docs/status.md` changes from exploratory runs
- unrelated `docs/coverage.html` changes from exploratory runs

If you intentionally changed parity declarations or catalog coverage, run
`npm run status:refresh` and review the generated output before opening the PR.

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

1. `npm run lint`
2. Targeted `npm test <adapter> -- <file-or-filter>`
3. `npm run validate:capabilities` if you changed adapter capabilities
4. `npm run status:refresh` if you changed parity declarations, catalog
   coverage, or intentionally updated the published dashboard

Also check:

- Example commands in docs still match real file paths.
- Internal doc references still match `src/matrices/` and `src/limitations.ts`.
- Generated files in the diff are intentional.
