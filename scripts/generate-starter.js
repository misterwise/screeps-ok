// Regenerate `starter/xxscreeps/` from `adapters/xxscreeps/` with imports
// mechanically rewritten to use the published `'screeps-ok'` package name.
//
// `adapters/xxscreeps/` is this repo's CI fixture; it imports from the
// framework via relative paths (`../../src/*.js`). Published consumers
// don't have that layout — their copy lives outside the screeps-ok
// package, so the imports need to go through the package name.
//
// This script is the single source of truth for that rewrite. Run it after
// any change to `adapters/xxscreeps/` so the starter we ship stays in sync.
// CI should also run it and fail if the generated output diverges from
// what's checked in.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(repoRoot, 'adapters/xxscreeps');
const dst = join(repoRoot, 'starter/xxscreeps');

const tsFiles = ['index.ts', 'snapshots.ts', 'sandbox-runner.ts', 'engine-internals.ts'];
const literalFiles = ['parity.json'];

mkdirSync(dst, { recursive: true });

for (const name of tsFiles) {
	const input = readFileSync(join(src, name), 'utf8');
	const output = input.replace(/'\.\.\/\.\.\/src\/[^']+\.js'/g, "'screeps-ok'");
	writeFileSync(join(dst, name), output);
}

for (const name of literalFiles) {
	copyFileSync(join(src, name), join(dst, name));
}

console.log(`[generate-starter] wrote ${dst}`);
