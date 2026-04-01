// Post-install script: build xxscreeps from source
// xxscreeps is installed from git (upstream/main) and needs tsc compilation
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const xxscreepsDir = resolve('node_modules/xxscreeps');

if (!existsSync(xxscreepsDir)) {
	console.log('[screeps-ok] xxscreeps not installed, skipping build');
	process.exit(0);
}

if (existsSync(resolve(xxscreepsDir, 'dist/test/simulate.js'))) {
	console.log('[screeps-ok] xxscreeps already built');
	process.exit(0);
}

console.log('[screeps-ok] Building xxscreeps from source...');
try {
	// Run tsc from within xxscreeps directory so it uses xxscreeps's own
	// tsconfig and node_modules (avoids type conflicts with our deps)
	execSync('npx tsc --noEmitOnError false', {
		cwd: xxscreepsDir,
		stdio: 'inherit',
	});
	console.log('[screeps-ok] xxscreeps build complete');
} catch (err) {
	// tsc may exit with errors due to type issues but still emit JS
	// Check if the output exists
	if (existsSync(resolve(xxscreepsDir, 'dist/test/simulate.js'))) {
		console.log('[screeps-ok] xxscreeps build completed with warnings');
	} else {
		console.error('[screeps-ok] xxscreeps build failed:', err.message);
		process.exit(1);
	}
}
