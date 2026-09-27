import { describe, expect, test } from 'vitest';
import type { TickOptions } from '../../src/adapter.js';
import { fenceShard } from '../../src/fixture.js';

// Ticks every millisecond and checks its signal between ticks, as an adapter must.
function fakeShard() {
	let time = 0;
	return {
		async tick(count = 1, options?: TickOptions) {
			for (let i = 0; i < count; i++) {
				options?.signal?.throwIfAborted();
				await new Promise(resolve => setTimeout(resolve, 1));
				time++;
			}
		},
		getGameTime: () => time,
	};
}

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('fixture fence', () => {
	test('closing aborts an in-flight tick(n) between ticks and waits for it', async () => {
		const shard = fakeShard();
		const fence = fenceShard(shard);
		const settled = fence.fenced.tick(1_000_000).then(() => 'resolved', (err: Error) => err.message);
		await pause(10);
		await fence.close();
		expect(await settled).toMatch(/its test ended/);
		const time = shard.getGameTime();
		expect(time).toBeGreaterThan(0);
		await pause(10);
		expect(shard.getGameTime()).toBe(time);
	});

	test('a call after closing throws', async () => {
		const fence = fenceShard(fakeShard());
		await fence.close();
		expect(() => fence.fenced.getGameTime()).toThrow(/called after its test ended/);
	});

	test('a test\'s own signal still aborts its tick', async () => {
		const fence = fenceShard(fakeShard());
		const own = new AbortController();
		const run = fence.fenced.tick(1_000_000, { signal: own.signal });
		await pause(10);
		own.abort(new Error('own'));
		await expect(run).rejects.toThrow('own');
		await fence.close();
	});
});
