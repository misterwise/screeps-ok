/**
 * 29.4 CPU Shard Limits
 *
 * Read-side and synchronous error-branch coverage for
 * `Game.cpu.shardLimits` and `Game.cpu.setShardLimits`. The 12-hour
 * cooldown branch (`CPU-SHARD-004`) needs a wall-clock time-skip hook
 * the harness doesn't expose, so it's deferred.
 *
 * Gated on `cpuShardLimits`: skips on xxscreeps (no implementation) and
 * on vanilla until a verified run flips the capability flag to true.
 */
import { describe, test, expect, code, ERR_INVALID_ARGS, OK } from '../../src/index.js';

describe('CPU shard limits', () => {
	test('CPU-SHARD-001 Game.cpu.shardLimits maps shard names to non-negative integers', async ({ shard }) => {
		shard.requires('cpuShardLimits');
		await shard.ownedRoom('p1');
		await shard.tick();

		const limits = await shard.runPlayer('p1', code`
			Game.cpu.shardLimits || null
		`) as Record<string, unknown> | null;
		expect(limits).not.toBeNull();
		expect(typeof limits).toBe('object');
		const entries = Object.entries(limits!);
		expect(entries.length).toBeGreaterThan(0);
		for (const [key, value] of entries) {
			expect(typeof key).toBe('string');
			expect(typeof value).toBe('number');
			expect(Number.isInteger(value)).toBe(true);
			expect(value as number).toBeGreaterThanOrEqual(0);
		}
	});

	test('CPU-SHARD-002 sum of shardLimits values equals the daily allowance', async ({ shard }) => {
		shard.requires('cpuShardLimits');
		await shard.ownedRoom('p1');
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			Game.cpu.shardLimits
				? ({
					sum: Object.values(Game.cpu.shardLimits).reduce((a, b) => a + b, 0),
					limit: Game.cpu.limit,
				})
				: null
		`) as { sum: number; limit: number } | null;
		expect(result).not.toBeNull();
		// Daily allowance == sum across all shards. On a single-shard
		// world Game.cpu.limit reflects this shard's slice; the sum
		// across shardLimits must equal it.
		expect(result!.sum).toBe(result!.limit);
	});

	test('CPU-SHARD-003 setShardLimits sync error branches', async ({ shard }) => {
		shard.requires('cpuShardLimits');
		await shard.ownedRoom('p1');
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const original = Object.assign({}, Game.cpu.shardLimits);
			const shardNames = Object.keys(original);
			const sum = Object.values(original).reduce((a, b) => a + b, 0);

			// Build inputs.
			// Sum-mismatch: keep keys, halve sum.
			const sumMismatch = {};
			shardNames.forEach((s, i) => { sumMismatch[s] = i === 0 ? Math.max(0, sum - 1) : original[s]; });

			// Unknown-shard: drop one known key, add a fake one preserving sum.
			const unknown = Object.assign({}, original);
			delete unknown[shardNames[0]];
			unknown['shard_does_not_exist_999'] = original[shardNames[0]];

			// Negative value: keep one shard, push another to negative; still sum-mismatch
			// but the negative-value branch is the more specific error.
			const negative = Object.assign({}, original);
			negative[shardNames[0]] = -1;

			// Non-integer value.
			const nonInteger = Object.assign({}, original);
			nonInteger[shardNames[0]] = (original[shardNames[0]] || 0) + 0.5;

			({
				sumMismatch: Game.cpu.setShardLimits(sumMismatch),
				unknown: Game.cpu.setShardLimits(unknown),
				negative: Game.cpu.setShardLimits(negative),
				nonInteger: Game.cpu.setShardLimits(nonInteger),
			})
		`) as Record<string, number>;

		expect(result.sumMismatch).toBe(ERR_INVALID_ARGS);
		expect(result.unknown).toBe(ERR_INVALID_ARGS);
		expect(result.negative).toBe(ERR_INVALID_ARGS);
		expect(result.nonInteger).toBe(ERR_INVALID_ARGS);
	});
});
