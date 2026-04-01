import { defineConfig } from 'vitest/config';

const adapter = process.env.SCREEPS_OK_ADAPTER ?? '';

export default defineConfig({
	test: {
		include: [
			'tests/**/*.test.ts',
			...(adapter.includes('xxscreeps') ? ['tests-xxscreeps/**/*.test.ts'] : []),
			...(adapter.includes('vanilla') ? ['tests-vanilla/**/*.test.ts'] : []),
		],
		pool: 'threads',
		reporters: process.env.CI ? ['json', 'default'] : ['default'],
		outputFile: process.env.CI
			? `reports/${adapter.replace(/.*\//, '').replace(/\..*/, '')}.json`
			: undefined,
	},
});
