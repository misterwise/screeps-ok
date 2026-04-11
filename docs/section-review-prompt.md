# Section Review Prompt

Use this prompt to review one section of `behaviors.md` at a time. Replace
`{N}` with the section number.

---

## Prompt

Review section {N} of `/Users/mrwise/Coding/Screeps/screeps-ok/behaviors.md`
for catalog quality and test coverage. Follow these steps exactly.

### Step 1 — Read the section

Read section {N} from `behaviors.md` (the `## {N}.` heading through to the
next `## ` heading).

### Step 2 — Identify potential cross-section duplicates

For every entry in section {N}, check whether another section already owns that
behavior. Common overlap areas:

- Boost effects → section 8 (`BOOST-*`)
- Road wear → 13.2 (`ROAD-WEAR-*`)
- Construction costs → 15.3 (`CONSTRUCTION-COST-*`)
- Power creep actions → 19.2 (`POWERCREEP-MOVE-*`, `POWERCREEP-ACTION-*`)
- Store/capacity → 23 (`STORE-*`)
- Structure limits → 6.10 (`CTRL-STRUCTLIMIT-*`)

**You must read the actual text of every entry you claim is a duplicate.**
Do not rely on memory or assumption. Use Grep to find the claimed duplicate
by ID, then Read the surrounding lines to compare. Only mark as duplicate if
the two entries describe the same observable outcome.

### Step 3 — Assess each entry against catalog rules

For each entry, verify:

1. **Testable**: Describes one public, deterministic, directly testable
   behavior with one clear interpretation.
2. **Distinct**: Not redundant with another entry in the same section.
   Side-effect vs return-code entries for the same API call are distinct
   (this is a standard catalog pattern).
3. **Correctly classified**: `behavior` for single-rule, `matrix` for entries
   expanding into generated families from a table/data source.
4. **Correctly scoped**: Belongs in this section, not another.
5. **Not editorial**: Not a framework limitation, inferred algorithm, or
   umbrella statement.

### Step 4 — Measure test coverage

Run this command to find which section {N} catalog IDs appear in test files:

```bash
# Extract section {N} IDs from behaviors.md and check against test files
node -e "
const fs = require('fs');
const path = require('path');
const bmd = fs.readFileSync('behaviors.md', 'utf8');
const lines = bmd.split('\n');
let facet = '', inSec = false;
const entries = [];
for (const line of lines) {
  if (/^## {N}\./.test(line)) inSec = true;
  else if (/^## \d+\./.test(line) && inSec) inSec = false;
  if (!inSec) continue;
  const fm = line.match(/^### (\d+\.\d+) (.+)/);
  if (fm) { facet = fm[1] + ' ' + fm[2]; continue; }
  const im = line.match(/^- \[.\] \x60([A-Z][A-Z0-9_-]+-\d{3})\x60/);
  if (im) entries.push({ id: im[1], facet });
}
const testIdRe = /\b([A-Z]+-(?:[A-Z]+-)?[0-9]{3})\b/g;
const testedIds = new Set();
function walk(dir) {
  for (const e of fs.readdirSync(dir, {withFileTypes:true})) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.name.endsWith('.test.ts')) {
      for (const m of fs.readFileSync(full,'utf8').matchAll(testIdRe)) testedIds.add(m[1]);
    }
  }
}
walk('tests');
for (const {id, facet} of entries) {
  const status = testedIds.has(id) ? '✓' : '✗';
  console.log(status + ' ' + id.padEnd(25) + facet);
}
const tested = entries.filter(e => testedIds.has(e.id)).length;
console.log('\n' + tested + '/' + entries.length + ' tested');
"
```

### Step 5 — Report findings

Produce a report with these sections:

```
## Section {N}: {title}

### Quality issues
- List each entry to drop, merge, reclassify, or relocate
- For each, state the reason and cite the duplicate ID if applicable
- If none: "No issues found."

### Changes applied
- List each edit made to behaviors.md (drops, merges, renumbers, added
  coverage notes)
- If no changes needed: "None."

### Test coverage
| Facet | Tested | Total | Untested IDs |
|---|---|---|---|
| ... | ... | ... | ... |

**{tested}/{total} tested ({pct}%)**
```

### Step 6 — Apply changes

If any entries should be dropped, merged, reclassified, or relocated:
1. Edit `behaviors.md` to apply the changes.
2. Add Coverage Notes explaining where dropped entries are owned.
3. Renumber within the affected prefix if gaps were created.
4. Re-run the coverage check to confirm the final count.

### Step 7 — Update tracking

Append findings to `/Users/mrwise/Coding/Screeps/screeps-ok/docs/catalog-review.md`
using the report format from Step 5.
