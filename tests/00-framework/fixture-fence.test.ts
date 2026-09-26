import { describe, test, expect } from '../../src/index.js';

// Order matters: the second test runs on the worker the first one timed out on.
describe('fixture fence', () => {
	test.fails('a test that times out mid-tick is cut off', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.tick(1_000_000);
	}, 1_000);

	test('the next test\'s shard does not advance on its own', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const before = await shard.getGameTime();
		await new Promise(resolve => setTimeout(resolve, 1_000));
		expect(await shard.getGameTime()).toBe(before);
	});
});
