import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const defaultAdapter = path.join(projectRoot, 'adapters/xxscreeps/index.ts');
const adapter = process.env.SCREEPS_OK_ADAPTER || defaultAdapter;
// When run from a consumer's node_modules, write reports to the consumer's cwd
// so their CI can collect them. Falls back to our own reports/ during local dev.
const reportsDir = process.env.SCREEPS_OK_PROJECT_ROOT
	? path.join(process.env.SCREEPS_OK_PROJECT_ROOT, 'reports')
	: path.join(projectRoot, 'reports');

// Make the default visible to test code when vitest is invoked directly
if (!process.env.SCREEPS_OK_ADAPTER) {
	process.env.SCREEPS_OK_ADAPTER = defaultAdapter;
}
const reportName = (
	process.env.SCREEPS_OK_REPORT_NAME
	?? adapter.replace(/.*\//, '').replace(/\..*/, '')
) || 'results';

export default defineConfig({
	resolve: {
		// Prevent vitest from resolving xxscreeps .ts source via symlink
		// Force it to use the package exports (dist/)
		conditions: ['import', 'node'],
		// Keep symlinked paths as-is so the externalize regex below still
		// matches in consumers where xxscreeps is self-linked into their own
		// node_modules/.
		preserveSymlinks: true,
	},
	ssr: {
		external: ['xxscreeps'],
	},
	test: {
		testTimeout: 15000,
		// Both built-in adapters are parallel-safe: vanilla boots one mockup
		// server per worker fork on a dynamically-probed port under a
		// pid+port-keyed tmp root, and xxscreeps gets a per-process database
		// lock from register-loader.ts so each fork hosts its own in-memory
		// local:// stores. Unknown custom adapters stay serial by default.
		fileParallelism: adapter.includes('vanilla') || adapter.includes('xxscreeps'),
		// Each vanilla worker runs 3 engine subprocesses (storage, runner,
		// processor); cap the fork count so a full run doesn't oversubscribe
		// dev machines or CI runners with few cores.
		maxWorkers: Math.min(6, os.availableParallelism()),
		// Reusing workers across files lets xxscreeps load the engine once per
		// fork instead of once per file (measured 4x). Vanilla measured slightly
		// slower without isolation, so it keeps the default fresh-fork-per-file.
		isolate: !adapter.includes('xxscreeps'),
		// xxscreeps' mods-resolution overhaul serves the engine's virtual
		// `xxscreeps:mods/*` modules via a `register()`-based Node loader; load
		// it before any test pulls the engine in.
		setupFiles: adapter.includes('xxscreeps')
			? [path.join(projectRoot, 'adapters/xxscreeps/register-loader.ts')]
			: [],
		include: [
			'tests/**/*.test.ts',
			...(adapter.includes('xxscreeps') ? ['tests-xxscreeps/**/*.test.ts'] : []),
			...(adapter.includes('vanilla') ? ['tests-vanilla/**/*.test.ts'] : []),
		],
		server: {
			deps: {
				// Inline our adapter code but externalize xxscreeps itself.
				// Two externalize patterns cover the layouts we support:
				//  - stable npm install:   node_modules/xxscreeps/...
				//  - self-link (consumer): <project>/dist/<subdir>/... after
				//    vite resolves the node_modules/xxscreeps -> .. symlink.
				inline: [/adapters/],
				external: [
					// Engine's virtual `xxscreeps:mods/*` modules, served by the
					// register-loader at Node level (see setupFiles below).
					/^xxscreeps:/,
					// Install-tree layout (our own CI): node_modules/xxscreeps/...
					/node_modules\/(?:@[^/]+\/)?xxscreeps\//,
					// Workspace self-link layout (consumer runs our suite inside
					// their own xxscreeps checkout). Vite follows the
					// node_modules/xxscreeps → .. symlink to the consumer's
					// repo root, so the realpath is <root>/dist/<subdir>/...
					// We externalize by xxscreeps's known top-level dist dirs
					// rather than path prefix, which we can't anticipate.
					/\/dist\/(?:backend|config|driver|engine|functional|game|mods|schema|scripts|utility|test)\//,
				],
			},
		},
		reporters: [
			...(process.env.CI ? ['json'] : []),
			'default',
			'./src/reporters/parity-reporter.ts',
		],
		outputFile: process.env.CI
			? path.join(reportsDir, `${reportName}.json`)
			: undefined,
	},
});
