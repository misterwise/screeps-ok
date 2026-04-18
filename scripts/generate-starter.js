// Regenerate `starter/xxscreeps/` from `adapters/xxscreeps/` with imports
// mechanically rewritten to use the published `'screeps-ok'` package name.
//
// `adapters/xxscreeps/` is this repo's CI fixture; it imports from the
// framework via relative paths (`../../src/*.js`). Published consumers
// don't have that layout — their copy lives outside the screeps-ok
// package, so the imports need to go through the package name.
//
// Parity gets the same base/overlay treatment: the canonical list ships
// inside the package at `parity/xxscreeps.json` (mirrored from the
// authoritative `adapters/xxscreeps/parity.json`), and the starter only
// includes a thin `parity.json` overlay that `extends` that base. When
// the consumer copies the starter into their adapter dir, they own only
// the overlay; the base updates with the next `npm update screeps-ok`.
//
// This script is the single source of truth for those rewrites. Run it
// after any change to `adapters/xxscreeps/` so the starter we ship stays
// in sync. CI should also run it and fail if the generated output
// diverges from what's checked in.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(repoRoot, 'adapters/xxscreeps');
const starterDst = join(repoRoot, 'starter/xxscreeps');
const parityDst = join(repoRoot, 'parity');

const tsFiles = ['index.ts', 'snapshots.ts', 'sandbox-runner.ts', 'engine-internals.ts'];

mkdirSync(starterDst, { recursive: true });
mkdirSync(parityDst, { recursive: true });

for (const name of tsFiles) {
	const input = readFileSync(join(src, name), 'utf8');
	const output = input.replace(/'\.\.\/\.\.\/src\/[^']+\.js'/g, "'screeps-ok'");
	writeFileSync(join(starterDst, name), output);
}

// Ship the canonical parity list as the base file inside the package.
copyFileSync(join(src, 'parity.json'), join(parityDst, 'xxscreeps.json'));

// Generate the consumer-facing overlay stub. Empty by design: any local
// additions or overrides go in `expected_failures` / `expected_passes`.
const overlay = {
	extends: 'screeps-ok/parity/xxscreeps.json',
	expected_failures: {},
	expected_passes: [],
};
writeFileSync(
	join(starterDst, 'parity.json'),
	JSON.stringify(overlay, null, '\t') + '\n',
);

console.log(`[generate-starter] wrote ${starterDst} and ${parityDst}/xxscreeps.json`);
