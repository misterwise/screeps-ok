import { defineConfig } from 'vitest/config';

const adapter = process.env.SCREEPS_OK_ADAPTER ?? '';
const reportName = (
	process.env.SCREEPS_OK_REPORT_NAME
	?? adapter.replace(/.*\//, '').replace(/\..*/, '')
) || 'results';

export default defineConfig({
	resolve: {
		// Prevent vitest from resolving xxscreeps .ts source via symlink
		// Force it to use the package exports (dist/)
		conditions: ['import', 'node'],
	},
	ssr: {
		external: ['xxscreeps'],
	},
	test: {
		testTimeout: 15000,
		fileParallelism: false,
		include: [
			'tests/**/*.test.ts',
			...(adapter.includes('xxscreeps') ? ['tests-xxscreeps/**/*.test.ts'] : []),
			...(adapter.includes('vanilla') ? ['tests-vanilla/**/*.test.ts'] : []),
		],
		server: {
			deps: {
				// Inline our adapter code but externalize xxscreeps itself
				inline: [/adapters/],
				external: [/xxscreeps/],
			},
		},
		reporters: [
			...(process.env.CI ? ['json'] : []),
			'default',
			'./src/reporters/parity-reporter.ts',
		],
		outputFile: process.env.CI
			? `reports/${reportName}.json`
			: undefined,
	},
});
