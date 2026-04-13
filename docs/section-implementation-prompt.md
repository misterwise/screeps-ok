# Section Implementation Prompt

> [!NOTE]
> Maintainer/internal workflow document. This prompt is for maintainers doing
> section-by-section implementation work after catalog review.

Use this prompt to implement tests for one section of `behaviors.md` after
its catalog review is complete. Replace `{N}` with the section number.

This prompt assumes the catalog has already been reviewed (see
`docs/section-review-prompt.md`) and `docs/catalog-review.md` lists the
untested IDs for section {N}.

---

## Prompt

Implement tests for the untested behaviors in section {N} of
`/Users/mrwise/Coding/Screeps/screeps-ok/behaviors.md`.

The goal is to test the **catalog rule** with **high confidence that the
test matches actual vanilla behaviour**, not the test framework or any
specific adapter.

### Step 1 — Load only what you need

Read in this order, stopping as soon as you have enough:

1. `docs/catalog-review.md` — find the section {N} block. The Test
   coverage table lists the untested IDs.
2. `behaviors.md` section {N} — read only the entries listed as untested.
3. The matching test directory (`tests/{NN}-{name}/`) — pick one existing
   test in the same facet to copy the shape from.

Do not read `docs/test-authoring.md`, `docs/adapter-spec.md`, or any
catalog-review history unless you have a specific question those answer.

### Step 2 — Write the tests

For each untested ID:

- **Match the catalog rule literally.** If the rule says "returns
  `ERR_NO_PATH` when no path exists", test exactly that.
- **One catalog ID, one test.** Title each test with the ID as the first
  token (`'MOVE-BASIC-010 ...'`) so coverage scanning picks it up.
- **Assert exact outcomes** (return code AND resulting state where both
  matter). No qualitative assertions like "moved correctly".
- **Use the smallest world setup that proves the rule.** Default to
  `await shard.ownedRoom('p1')` unless you actually need terrain or a
  second player.
- **Capability gates:** if the test needs a capability the adapter may
  not support, call `shard.requires('capability', 'why')` at the top.
- **Documented adapter limitations:** if the test needs a known-broken
  framework feature, gate the test with
  `hasDocumentedAdapterLimitation('limitName')` (see
  `src/limitations.ts`).

### Step 3 — Verify against vanilla source before declaring catalog
inaccuracy

If a test fails on vanilla, **do not assume the catalog is wrong**.
Investigate in this order:

1. **Test setup.** Common setup gotchas:
   - `FIND_EXIT_LEFT[0]` etc. return the corner tile `(0, 0)`. Filter
     to `e.y > 5 && e.y < 44` (or equivalent) for exits whose adjacent
     "inside" tile is not also at edge.
   - `shard.runPlayer()` advances exactly 1 tick. An extra
     `await shard.tick()` between `placeCreep` and the test action
     changes the assertion baseline.
   - Vanilla damages body parts in body order from index 0. To deal
     exactly 100 damage to the front part, use 10× `RANGED_ATTACK`.
   - Default room layouts are sparse: one controller at `(1,1)`, plain
     terrain unless the test overrides it, and no ambient sources/minerals.
     `moveTo` paths may detour;
     prefer Chebyshev-distance assertions over exact-direction
     assertions when the catalog rule is direction-agnostic.

2. **Vanilla engine source.** The authoritative reference lives in
   `node_modules/@screeps/engine/src/`. Grep for the exact behavior:
   - Movement / fatigue / pull / cross-room:
     `src/processor/intents/movement.js`,
     `src/processor/intents/creeps/_add-fatigue.js`
   - Per-creep tick logic: `src/processor/intents/creeps/tick.js`
   - Public creep API: `src/game/creeps.js`
   - Public room API: `src/game/rooms.js`
   - Driver / runtime / pathfinder cache:
     `node_modules/@screeps/driver/lib/runtime/make.js` (this is the
     `staticTerrainData` lazy-load that powers `vanillaTerrainPathfinder`)
   - World setup / terrain:
     `node_modules/screeps-server-mockup/src/world.js`
   - Vanilla adapter wiring: `adapters/vanilla/index.ts`

3. **Only after both setup and source are checked**, declare the
   catalog inaccurate. Then bring the finding back to the user with
   the source file and line number cited.

### Step 4 — When the catalog is inaccurate

The user prefers option (b) — rewrite the entry to match what vanilla
actually does. Drop the entry only when there is no interesting,
testable behaviour to keep.

You must:

- Cite the vanilla source file and line that establishes the actual
  behaviour.
- Confirm with the user before editing `behaviors.md` for catalog
  drops or rewrites.
- After approval: edit `behaviors.md`, fix-up any renumbering, write
  the matching test, and add a Coverage Note explaining the change.

### Step 5 — When the framework is broken

If a test fails because the adapter has a real bug (not a catalog
issue):

- **Stop investigating internals after one or two reasonable
  attempts.** Do not rabbit-hole into `@screeps/driver` rewrites.
- Write a contract test under `tests/00-adapter-contract/` that
  captures the bug (failing on the broken adapter, passing on the
  good one if applicable).
- Add a documented limitation to `src/limitations.ts` with a
  detailed comment explaining: where the cache lives, why it's
  stale, what gets observed, and what would be required to fix.
- Gate the broken test on the new limitation so the suite stays
  green.
- Surface the finding to the user. Do not attempt a deep framework
  fix unless explicitly asked.

### Step 6 — Run the tests efficiently

- **Capture once, grep many.** Use `npm run test ... 2>&1 | tee
  /tmp/run.log` and grep the file. Do not re-run the suite to look at
  different parts of its output.
- **Filter by name.** `npm run test {adapter} -- {file} -t
  "test name pattern"` runs only matching tests.
- **Run only what you changed.** Run a single file (or a single test
  via `-t`) until it's green. Run the whole section once at the end.
- **Run on both adapters.** xxscreeps and vanilla often disagree.
  The catalog should be source-of-truth for both, so a passing
  xxscreeps run is not enough.

### Step 7 — Document and finish

When all section {N} tests pass on both adapters (or are gated on
capability/limitation), update `docs/catalog-review.md`:

- Replace the section {N} Test coverage table with the new tally.
- Add an "Implementation details and findings" subsection that
  records:
  - Catalog edits (drops, rewrites, promotions to `verified_vanilla`)
  - Test setup gotchas worth remembering
  - Any framework findings + new limitations
  - The final adapter pass/skip/fail counts

Then mark the task done and surface a one-paragraph summary to the
user including: tests added, catalog edits, framework findings.

---

## Token-saving rules

- **Do not re-read** files you read in a previous turn unless the file
  changed. If you compacted, re-read only the specific entry/test/file
  you need now.
- **Do not run the full test suite** to verify a single test. Use
  vitest's file + `-t` filters.
- **Do not investigate internals** beyond what's needed to answer
  "is this catalog rule correct?" The framework is allowed to be
  imperfect; document and skip.
- **Do not delegate understanding to subagents.** When a fix is
  obvious from a diff or a few lines of source, just do it inline.
- **One question at a time.** When you need user direction, ask one
  specific question with options, not a survey.

## Files you will probably touch

- `behaviors.md` — only for catalog rewrites/drops, after user approval
- `docs/catalog-review.md` — section {N} block + findings
- `tests/{NN}-{name}/` — new and modified test files
- `src/limitations.ts` — only if adding a new framework limitation
- `tests/00-adapter-contract/` — only if capturing a framework bug
