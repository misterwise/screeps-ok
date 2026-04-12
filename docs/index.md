# screeps-ok Doc Map

This page routes readers to the right document for the job. Most contributors
do not need every document in `docs/`.

## Start Here

- New to the repo: [`../README.md`](../README.md)
- Setting up or opening a PR: [`../CONTRIBUTING.md`](../CONTRIBUTING.md)

## Public Reference Docs

Use these when you are reading, contributing, or integrating with the suite.

### Understanding what the suite tests

- [`../behaviors.md`](../behaviors.md) — the canonical behavior catalog
- [`behavior-matrices.md`](behavior-matrices.md) — scope and source definitions
  for matrix-backed behavior families

### Writing canonical tests

- [`test-authoring.md`](test-authoring.md) — test-writing rules and invariants

### Building or integrating adapters

- [`adapter-guide.md`](adapter-guide.md) — practical implementation guide
- [`adapter-spec.md`](adapter-spec.md) — normative adapter contract

### Project and doc conventions

- [`style.md`](style.md) — visual and formatting conventions for public docs

### Generated reference outputs

- [`status.md`](status.md) — generated adapter status and parity dashboard
- `coverage.html` — generated coverage report for catalog IDs

## Maintainer/Internal Workflow Docs

These are useful for maintainers working section-by-section on the catalog and
test suite. They are not required reading for a normal contributor.

- [`catalog-review.md`](catalog-review.md) — running review history and findings
- [`section-review-prompt.md`](section-review-prompt.md) — internal prompt for
  reviewing one catalog section
- [`section-implementation-prompt.md`](section-implementation-prompt.md) —
  internal prompt for implementing one reviewed section

## How The Docs Fit Together

The shortest mental model is:

1. `README.md` explains what the project is and how to run it.
2. `CONTRIBUTING.md` explains how to work in the repo without surprises.
3. `behaviors.md` says what public behavior the suite owns.
4. `docs/behavior-matrices.md` narrows matrix-backed behavior families.
5. `docs/test-authoring.md` says how tests must express those behaviors.
6. `docs/adapter-guide.md` and `docs/adapter-spec.md` define how engines plug in.
7. `docs/status.md` and `docs/coverage.html` show the current generated state.
