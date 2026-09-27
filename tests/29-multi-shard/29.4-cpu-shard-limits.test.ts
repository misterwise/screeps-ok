/**
 * 29.4 CPU Shard Limits
 *
 * `Game.cpu.shardLimits` and `Game.cpu.setShardLimits`, as the API
 * documentation states them.
 *
 * Gated on `cpuShardLimits`: the open-source engine doesn't seed
 * `Game.cpu.shardLimits`, so both reference adapters skip these.
 */
import { describe, test, expect, code, ERR_BUSY, ERR_INVALID_ARGS, OK } from '../../src/index.js';

describe('CPU shard limits', () => {
	test('CPU-SHARD-001 Game.cpu.shardLimits keys this shard to Game.cpu.limit', async ({ shard }) => {
		shard.requires('cpuShardLimits');
		await shard.ownedRoom('p1');
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			({ own: Game.cpu.shardLimits[Game.shard.name], limit: Game.cpu.limit })
		`) as { own: number; limit: number };
		expect(result.own).toBe(result.limit);
	});

	test('CPU-SHARD-003 setShardLimits rejects limits that change the total', async ({ shard }) => {
		shard.requires('cpuShardLimits');
		await shard.ownedRoom('p1');
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const limits = Object.assign({}, Game.cpu.shardLimits);
			limits[Game.shard.name] += 1;
			Game.cpu.setShardLimits(limits)
		`);
		expect(rc).toBe(ERR_INVALID_ARGS);
	});

	test('CPU-SHARD-004 setShardLimits succeeds once, then is busy', async ({ shard }) => {
		shard.requires('cpuShardLimits');
		await shard.ownedRoom('p1');
		await shard.tick();

		const setSame = code`Game.cpu.setShardLimits(Object.assign({}, Game.cpu.shardLimits))`;
		expect(await shard.runPlayer('p1', setSame)).toBe(OK);
		expect(await shard.runPlayer('p1', setSame)).toBe(ERR_BUSY);
	});
});
