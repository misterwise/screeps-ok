// Post-install helper: prepare xxscreeps JavaScript output when available.
// Native addons are built explicitly via `npm run setup:xxscreeps`.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const xxscreepsDir = resolve('node_modules/xxscreeps');
const minNodeMajor = 24;

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

if (existsSync(resolve(xxscreepsDir, 'dist/test/simulate.js'))) {
	console.log('[screeps-ok] xxscreeps JavaScript build already present');
	process.exit(0);
}

console.log('[screeps-ok] Building xxscreeps JavaScript output...');
try {
	// Run tsc from within xxscreeps directory so it uses xxscreeps's own
	// tsconfig and node_modules (avoids type conflicts with our deps)
	execSync('npx tsc --noEmitOnError false', {
		cwd: xxscreepsDir,
		stdio: 'inherit',
	});
	console.log('[screeps-ok] xxscreeps JavaScript build complete');
	console.log('[screeps-ok] Run npm run setup:xxscreeps to build the path-finder native addon');
} catch (err) {
	// tsc may exit with errors due to type issues but still emit JS
	// Check if the output exists
	if (existsSync(resolve(xxscreepsDir, 'dist/test/simulate.js'))) {
		console.log('[screeps-ok] xxscreeps JavaScript build completed with warnings');
		console.log('[screeps-ok] Run npm run setup:xxscreeps to build the path-finder native addon');
	} else {
		console.error('[screeps-ok] xxscreeps build failed:', err.message);
		process.exit(1);
	}
}
