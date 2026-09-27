// The static checks the pre-commit hook and CI both run, from the tree under
// check: typecheck, capability gates, catalog labels, doc references,
// engine-internals drift, the framework tests that boot no engine, and the
// generators whose output is committed.
// Callers compare the regenerated files with the committed ones.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = name => path.join(root, 'scripts', name);

// Framework tests that use the shard fixture boot an engine; CI's suite runs
// those. The rest run with no adapter, so none pays the engine's startup.
const frameworkDir = path.join(root, 'tests/00-framework');
const engineFreeTests = readdirSync(frameworkDir)
	.filter(name => name.endsWith('.test.ts'))
	.map(name => path.join(frameworkDir, name))
	.filter(file => !/from '\.\.\/\.\.\/src\/index\.js'/.test(readFileSync(file, 'utf8')));

const steps = [
	// The typecheck covers the starter, so it regenerates first.
	['starter', [script('generate-starter.js')]],
	['typecheck', [require.resolve('typescript/bin/tsc'), '--noEmit']],
	['capability gates', [script('validate-capabilities.js')]],
	['catalog labels', [script('validate-catalog.js')]],
	['doc references', [script('validate-docs.js')]],
	['engine-internals drift', engineInternalsDrift],
	['framework tests', [require.resolve('vitest/vitest.mjs'), 'run', ...engineFreeTests], { SCREEPS_OK_ADAPTER: 'none' }],
	['coverage', [script('generate-coverage.js')]],
	// Status reads the local full-run reports, which a fresh clone or CI lacks.
	...['vanilla', 'xxscreeps'].some(adapter => existsSync(path.join(root, 'reports', `${adapter}.json`)))
		? [['status', [script('generate-status.js')]]]
		: [],
];

const failed = [];
for (const [name, run, env] of steps) {
	const output = typeof run === 'function' ? run() : spawn(run, env);
	if (output === null) continue;
	failed.push(name);
	console.error(`check: ${name} failed\n${output}`);
}
if (failed.length > 0) {
	console.error(`check: ${failed.length} failed: ${failed.join(', ')}`);
	process.exit(1);
}

// Null on success, else the step's output.
function spawn(args, env) {
	const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', env: { ...process.env, ...env } });
	return result.status === 0 ? null : `${result.stdout}${result.stderr}`.trim();
}

// Engine `#` fields go through adapters/xxscreeps/engine-internals.ts
// (docs/xxscreeps-engine-internals-policy.md), except `#flushObjects` in the
// inlined createSimulation fork.
function engineInternalsDrift() {
	const dir = path.join(root, 'adapters/xxscreeps');
	const hits = [];
	for (const name of readdirSync(dir).filter(name => name.endsWith('.ts') && name !== 'engine-internals.ts')) {
		readFileSync(path.join(dir, name), 'utf8').split('\n').forEach((line, i) => {
			if (/['"]#[a-zA-Z_]/.test(line) && !line.includes('#flushObjects')) {
				hits.push(`adapters/xxscreeps/${name}:${i + 1}: ${line.trim()}`);
			}
		});
	}
	return hits.length === 0 ? null : hits.join('\n');
}
