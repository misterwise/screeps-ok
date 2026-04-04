# screeps-ok documentation style

GitHub-flavored markdown has a limited palette. This document fixes a small
vocabulary of visual signals that every doc in this repo should reuse the same
way, so readers who scan multiple docs build consistent muscle memory.

If you are adding or editing a public doc under `docs/` or the root
(`README.md`, `behaviors.md`), follow this guide.

## Status icons

Use these in tables, inline, and section prefixes. The four categories should
cover every "where is this on the spectrum" question.

| Icon | Meaning |
| :-: | --- |
| 🟢 | Fully passing, canonical truth, vanilla-verified |
| 🟡 | Known but registered difference (parity gap, expected skip, pending matrix family) |
| 🔴 | Unexpected failure, regression, broken |
| ⚪ | No data yet, not measured, unknown |

Pick the icon that matches the semantic, not the color you want. If a status
does not fit any of these four, it probably needs a different sentence rather
than a new icon.

## GitHub alert blocks

Use alerts for callouts, not for body text. A good alert is one sentence plus
an optional follow-up; more than that belongs in prose.

| Syntax | Rendered as | Use for |
| --- | --- | --- |
| `> [!NOTE]` | Blue, informational | Background context, caveats, historical notes |
| `> [!TIP]` | Green, positive | A practical shortcut or recommendation |
| `> [!IMPORTANT]` | Purple, prominent | A hard rule or invariant the reader must know |
| `> [!WARNING]` | Yellow, cautionary | A foot-gun that will bite a reader who ignores it |
| `> [!CAUTION]` | Red, alarming | Deprecated, destructive, or dangerous behavior |

Do not nest alerts, do not stack more than one alert in a row, and do not use
them as decoration.

## Shields.io badges

Use badges at the top of user-facing docs (`README.md`, `docs/status.md`) to
give an at-a-glance signal. Avoid badges in the middle of body text.

Color conventions:

- `brightgreen` — clean pass counts, "all good"
- `yellow` — known gaps, warnings, expected failures
- `red` — unexpected failures, broken state
- `blue` — informational metadata (docs link, version, license)
- `lightgrey` — no data, not run yet

One badge per concept. If an adapter has both a clean-pass count and an
expected-failure count, render two badges side by side rather than stuffing
both numbers into one.

## Code fences

Every code block gets a language tag, always. This gives syntax highlighting
for free, which is the cheapest form of color in the docs.

- ```` ```typescript ```` — test bodies, adapter code, type examples
- ```` ```json ```` — `parity.json`, snapshots, config
- ```` ```bash ```` — commands and shell snippets
- ```` ```markdown ```` — meta-examples of markdown syntax
- ```` ```text ```` — when no language fits, prefer this over a bare fence

## A concrete example

```markdown
> [!IMPORTANT]
> Canonical tests must not read gameplay constants from the engine under
> test at runtime. Use `src/constants.ts` instead.

## Current adapter status

| | Adapter | Status |
| :-: | --- | --- |
| 🟢 | vanilla | 199 passing |
| 🟡 | xxscreeps | 183 passing, 11 expected-failure |
| ⚪ | rustscreeps | no report yet |

> [!TIP]
> Run `npm run status:refresh` locally to regenerate `docs/status.md` with
> your latest numbers before filing a PR.
```

This is the visual register the rest of the repo's public docs should match.
