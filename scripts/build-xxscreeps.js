// Post-install helper: prepare xxscreeps JavaScript output when available.
// Native addons are built explicitly via `npm run setup:xxscreeps`.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);
const xxscreepsDir = resolve('node_modules/xxscreeps');
const minNodeMajor = 24;
const tscBin = require.resolve('typescript/bin/tsc');

if (!existsSync(xxscreepsDir)) {
	console.log('[screeps-ok] xxscreeps not installed, skipping build');
	process.exit(0);
}

const nodeMajor = Number.parseInt(process.versions.node.split('.')[0] ?? '', 10);
if (!Number.isFinite(nodeMajor) || nodeMajor < minNodeMajor) {
	console.log(
		`[screeps-ok] Skipping xxscreeps postinstall build on ${process.version}. ` +
		`Use Node ${minNodeMajor}+ and run npm install again for a supported environment.`,
	);
	process.exit(0);
}

if (
	existsSync(resolve(xxscreepsDir, 'dist/test/simulate.js')) &&
	existsSync(resolve(xxscreepsDir, 'dist/config/mods.static/constants.js'))
) {
	console.log('[screeps-ok] xxscreeps JavaScript build already present');
	process.exit(0);
}

console.log('[screeps-ok] Building xxscreeps JavaScript output...');
try {
	// Run the root project's TypeScript compiler from within xxscreeps so it
	// uses xxscreeps's tsconfig without depending on nested devDependencies.
	execFileSync(process.execPath, [tscBin, '--noEmitOnError', 'false'], {
		cwd: xxscreepsDir,
		stdio: 'inherit',
	});
	runGeneratedModsBootstrap();
	console.log('[screeps-ok] xxscreeps JavaScript build complete');
	console.log('[screeps-ok] Run npm run setup:xxscreeps to build the path-finder native addon');
} catch (err) {
	// tsc may exit with errors due to type issues but still emit JS
	// Check if the output exists
	if (
		existsSync(resolve(xxscreepsDir, 'dist/test/simulate.js')) &&
		existsSync(resolve(xxscreepsDir, 'dist/config/mods.static/constants.js'))
	) {
		console.log('[screeps-ok] xxscreeps JavaScript build completed with warnings');
		console.log('[screeps-ok] Run npm run setup:xxscreeps to build the path-finder native addon');
	} else {
		console.error('[screeps-ok] xxscreeps build failed:', err.message);
		process.exit(1);
	}
}

function runGeneratedModsBootstrap() {
	execFileSync(process.execPath, ['dist/config/mods/index.js'], {
		cwd: xxscreepsDir,
		stdio: 'inherit',
	});
}
