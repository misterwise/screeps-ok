# Reframe `expected` as canonical — review plan

Today's catalog has a hidden asymmetry: `expect(...)` values are usually "what vanilla does," with `adapters/xxscreeps/parity.json` as the escape hatch for deviations. If vanilla is buggy, the test silently encodes the bug. This plan audits and fixes that asymmetry so vanilla bugs become first-class, trackable entries — symmetric to xxscreeps gaps.

Last refreshed: 2026-04-14.

## The asymmetry today

- `adapters/xxscreeps/parity.json` — 53 declared deviations from vanilla.
- `adapters/vanilla/parity.json` — does not exist. Vanilla is implicitly the oracle.
- `docs/xxscreeps-parity-gaps.md` — root-cause analysis for every xxscreeps gap.
- `docs/vanilla-bugs.md` — does not exist.

Evidence the asymmetry is real, not just structural: reading through `xxscreeps-parity-gaps.md`, at least a handful of entries (e.g. `lab-cooldown-no-decrement`, `extractor-cooldown-off-by-one`) show xxscreeps getting the **intent** right but the **arithmetic** off-by-one because vanilla's existing behavior is itself a tick-boundary artifact. Not all 53 are clear-cut "xxscreeps wrong, vanilla right." Some are "both wrong, spec says X, vanilla happens to align with X by accident, xxscreeps doesn't."

## Architectural benefit

The catalog becomes a **spec**, not a snapshot of one implementation. Concrete wins:

- A new adapter author reads the suite as "what a Screeps-compatible engine must do," not "what vanilla happens to do."
- Vanilla bugs become first-class, publicly trackable, and filable upstream with a screeps-ok test id.
- The ecosystem gets a third column — `canonical` behavior — distinct from either implementation. If both engines pass, canonical is confirmed; if both fail, the spec itself is undefined and the test is wrong.
- Composable with `vanilla-next` (see sibling plan): a documented vanilla bug that's fixed on master flips from "expected-fail on vanilla, pass on vanilla-next" → readiness signal for the next npm release.

## Design: no test API change

Recommended approach: **symmetric `parity.json`** on the vanilla side. Zero test-authoring API churn. Vanilla gets the same mechanism xxscreeps already has.

Rejected alternatives:

- **Per-test `canonical(value, { vanilla: ..., xxscreeps: ... })` helper.** High churn; every `expect(...)` site touched; readability drops; adds a third expected value to maintain.
- **Parallel "canonical expected" snapshot file.** Another artifact to generate, another source of truth, another thing to regenerate on behavior changes.
- **Docs-only source of truth.** Screeps docs are incomplete on edge cases; tests need a concrete expected. We'd still need an oracle for the unspecified corners.

The parity-file approach reuses `src/reporters/parity-reporter.ts` and `scripts/parity-report.js` exactly — both already treat the adapter name as a parameter.

## Source-of-truth hierarchy

When `expect(x)` disagrees with vanilla's observed behavior, a test author needs a citable reason. Proposed hierarchy, most authoritative first:

1. **Explicit value in `src/constants.ts`** or a direct arithmetic derivation from it. `CREEP_LIFE_TIME = 1500`, so after 1499 ticks a creep must have `ticksToLive === 1`. No engine gets a vote.
2. **`docs.screeps.com` API page**. If the documented return is `ERR_INVALID_TARGET`, vanilla returning `ERR_FULL` is a vanilla bug.
3. **Engine agreement**. If vanilla and xxscreeps return the same value, treat as canonical by default — it's a rebuttable presumption.
4. **Documented intent in engine source comments**, either `@screeps/engine` or `xxscreeps`. Useful tiebreaker when docs are silent.
5. **Community/forum consensus**. Screeps forum "bug report" threads, Slack/Discord archives, widely-used bot codebases. Last resort — cite a URL.

Tests whose expected value doesn't fit tiers 1–3 must cite the tier and URL in a comment above the `expect`. We don't need to retro-annotate all 1214 — only where the expected is non-obvious or disputed.

## The audit (the real work)

The schema change is mechanical. The audit is weeks of work. Structure it as three passes, increasing depth.

### Pass 1 — reframe the existing 53 xxscreeps gaps (2–3 days)

For each entry in `adapters/xxscreeps/parity.json` + `docs/xxscreeps-parity-gaps.md`, answer one question: **is vanilla actually right?**

Tiered outcomes:

- **Vanilla canonical** (expected majority): no change, xxscreeps-side gap stays.
- **Vanilla wrong, xxscreeps right**: move the entry. Delete from xxscreeps side, add to vanilla side with a flipped `actual`/`expected`. The test's `expect(...)` value needs updating to match the canonical behavior, which will flip the pass/fail columns for both adapters.
- **Both wrong**: spec-land. Rare but possible. The test is broken; fix the expected, both adapters now fail, both get a gap entry pointing at the same canonical value.

Starting suspects (initial smell, not a conclusion):

- `extractor-cooldown-off-by-one` + `lab-cooldown-no-decrement` — the memo explicitly notes both engines disagree on tick-boundary semantics and vanilla's constants have inconsistent conventions (`EXTRACTOR_COOLDOWN` vs `REACTION_TIME`). Worth checking whether vanilla's behavior matches the documented constant or is a historical accident.
- `eventlog-attack-missing` — is the eventLog carry-over behavior documented, or is vanilla's cross-tick persistence just how LokiJS happened to serialize?
- `rawmemory-set-no-eager-limit-check` — the memo notes vanilla throws from `flush()` *after* user code returns, so the user-code `try/catch` can never see it. Is "throw during `set()`" the canonical behavior or the xxscreeps author's judgement call?

Deliverable: annotated audit log in `docs/vanilla-bugs-audit.md` (or inline as a section of this plan). For each of the 53, a one-line verdict + evidence.

### Pass 2 — triangulate Tier-C tests (1 week)

Any test that (a) passes on vanilla, (b) is skipped or capability-gated on xxscreeps, and (c) has a non-obvious expected value — re-verify against docs. Mechanics:

1. Grep for tests whose expected values look empirical (hard-coded tick counts, resource math with magic numbers).
2. For each, find the docs URL for the relevant API. If the documented behavior disagrees with the test, flag.
3. Budget: ~10 minutes per suspicious test × ~200 candidates = ~4 person-days.

This is where the bulk of undiscovered vanilla bugs hide.

### Pass 3 — import community bug reports (ongoing)

Mine `screeps/engine` GitHub issues + Screeps forum "bug" tag for reports that aren't covered by a screeps-ok test yet. Each is a candidate:

1. Can it be reproduced with the catalog harness?
2. Is there an existing test that asserts the buggy vanilla behavior?
3. If yes to (2): update the expected, add a gap entry.
4. If no to (2): write a new test asserting canonical, file the gap entry.

Treat as a grep-triage loop rather than an audit with a fixed end date. Worth running once per release cycle.

## Concrete steps

1. **Schema prep** (0.5 day, low risk)
   - Create `adapters/vanilla/parity.json` with `{ "expected_failures": {} }`.
   - Create `docs/vanilla-bugs.md` skeleton matching `xxscreeps-parity-gaps.md` structure.
   - Verify `scripts/generate-status.js` treats both adapters' parity files symmetrically. Today it calls `loadParityFile(adapter)` generically (`scripts/generate-status.js:43`), so the machinery already works; just need to confirm the status-page rendering doesn't hardcode "xxscreeps" anywhere that should be parameterized. (Quick grep.)
   - Confirm `src/reporters/parity-reporter.ts` likewise treats adapter name as a parameter, not `xxscreeps` specifically.

2. **Conventions update** (0.5 day)
   - `docs/test-authoring.md`: new section on the source-of-truth hierarchy. Rule of thumb: if both engines agree on an expected value, no citation needed; if you're overriding one, cite tier + URL.
   - `.agent/conventions/catalog-discipline.md` (agent-only): same guidance plus "never flip an expected to match vanilla's observed behavior without verifying against docs/constants first."
   - `CONTRIBUTING.md` if it exists, otherwise defer.

3. **Pass 1 audit** (2–3 days)
   - Triage all 53 existing xxscreeps gaps through the three-tier lens above.
   - Produce `docs/vanilla-bugs-audit.md` with per-gap verdicts.
   - For each "vanilla wrong" verdict, flip the test's expected + move the parity entry.
   - `npm run parity` until green. Unexpected-passes on xxscreeps for tests where canonical now matches xxscreeps should auto-close xxscreeps gaps — expected outcome.

4. **Pass 2 triangulation** (1 week)
   - Grep for empirical-looking expected values. Start with `07-combat`, `08-boosts`, `24-intent-resolution` — historically the murkiest sections.
   - Spot-check one test per catalog section per day; don't big-bang.
   - Log findings in `docs/vanilla-bugs-audit.md` cumulatively.

5. **Pass 3 onboarding** (ongoing)
   - Add a checklist item to the release cadence: "Scanned upstream issues since last release?"
   - Once `vanilla-next` exists (sibling plan), reports can be cross-referenced with head behavior.

6. **Documentation** (half day)
   - Update `docs/status.md` generator to surface `vanilla` gaps alongside xxscreeps gaps, with the same color vocabulary.
   - README badge changes: `vanilla X passing / Y expected-fail` replaces the current fully-passing claim.
   - Close the loop in `docs/adapter-spec.md`: note that `expected` is canonical, not vanilla-shaped, and that every adapter — including vanilla — may declare parity gaps.

## Tradeoffs

- **Perceived regression on first gap-land**. Shipping this starts vanilla's badge at "Y expected-fail" instead of "fully passing." Some reviewers will read that as regression. Mitigate with a clear README note: "Vanilla isn't getting worse; we're recognizing bugs that were previously invisible."
- **Pass 1 is reversible-ish**. If an audit verdict turns out wrong, flip it back. Parity entries aren't load-bearing in the test runtime — they only affect reporter classification.
- **Authority gap on disputed behavior**. Some tests encode folk-knowledge with no citable source. Allow "folk-knowledge" as an oracle tier, require a forum URL, don't demand docs-only. The dissent cost is lower than the benefit of flagging the murk.
- **Authoring cost creep**. Requiring oracle citations on every new test raises authoring friction. Counter: only require citations when the expected value isn't derivable from constants or docs. If `expect(creep.ticksToLive).toBe(1499)` — no citation. If `expect(getEventLog()).toEqual([...something subtle...])` — cite.

## Out of scope

- **Rewriting tests to a docs-driven structure**. The current test layout is fine; this is about the `expected` values, not the test harness.
- **Automatic docs scraping**. Tempting, but docs.screeps.com isn't structured enough to auto-compare. Manual audit only.
- **Changing how `parity.json` integrates with vitest**. The existing mechanism works; keep it.
- **Adding a "canonical oracle" adapter**. No — there's no implementation of canonical behavior to run. Canonical is a property of the test, not an adapter.

## Success criteria

- `adapters/vanilla/parity.json` exists and is non-empty within 2 weeks (means at least one vanilla bug is surfaced).
- Every parity entry cites an upstream issue or a docs URL.
- Status dashboard shows vanilla and xxscreeps in symmetric columns.
- First vanilla bug filed upstream references a screeps-ok test id in the repro.
- No test gets its expected value flipped without an oracle citation.

## Companion

See `docs/vanilla-next-adapter-plan.md` — the two plans compose. Canonical gaps on vanilla that are fixed on master become the cross-reference that tells us when to close them.
