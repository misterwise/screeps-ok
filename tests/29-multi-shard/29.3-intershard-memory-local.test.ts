/**
 * 29.3 InterShardMemory — local half
 *
 * The local half of `InterShardMemory` is single-shard observable: a
 * round-trip of `setLocal` / `getLocal`.
 *
 * `getRemote` requires a second shard and is gated on `multiShard`
 * (`ISM-005`); not covered here.
 *
 * Gated on `interShardMemory`. Neither reference engine ships the module
 * (open-source vanilla has none), so both skip these.
 */
import { describe, test, expect, code } from '../../src/index.js';

describe('InterShardMemory — local segment', () => {
	test('ISM-002 setLocal(s) round-trips through getLocal() on the same tick', async ({ shard }) => {
		shard.requires('interShardMemory');
		await shard.ownedRoom('p1');
		await shard.tick();

		const payload = 'hello shard0';
		const got = await shard.runPlayer('p1', code`
			InterShardMemory.setLocal(${payload});
			InterShardMemory.getLocal()
		`);
		expect(got).toBe(payload);
	});
});
