import { resolve } from 'node:path';
import { test as base, describe, expect } from 'vitest';
import type { ScreepsOkAdapter } from './adapter.js';

type AdapterFactory = { createAdapter(): Promise<ScreepsOkAdapter> };

let adapterModule: AdapterFactory | undefined;

async function getAdapterModule(): Promise<AdapterFactory> {
	if (!adapterModule) {
		const adapterPath = process.env.SCREEPS_OK_ADAPTER;
		if (!adapterPath) {
			throw new Error(
				'SCREEPS_OK_ADAPTER env var not set. Point it at an adapter module ' +
				'(e.g., SCREEPS_OK_ADAPTER=./adapters/xxscreeps/index.ts)'
			);
		}
		// Resolve relative to project root, not to vite-node internals
		const absPath = resolve(process.cwd(), adapterPath);
		adapterModule = await import(absPath) as AdapterFactory;
	}
	return adapterModule;
}

export const test = base.extend<{ shard: ScreepsOkAdapter }>({
	// eslint-disable-next-line no-empty-pattern
	shard: async ({}, use) => {
		const mod = await getAdapterModule();
		const adapter = await mod.createAdapter();
		await use(adapter);
		await adapter.teardown();
	},
});

export { describe, expect };
