/**
 * 30.1 Heap Statistics
 *
 * Surface contract only: heap metric values are engine-specific and
 * deliberately excluded (behaviors.md Summary non-goals). The entry pins
 * method presence, field shape, and internal consistency.
 */
import { describe, test, expect, code } from '../../src/index.js';

describe('CPU & Runtime — heap statistics', () => {
	test('CPU-HEAP-001 getHeapStatistics is callable and returns numeric heap fields', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const isFn = typeof Game.cpu.getHeapStatistics === 'function';
			const stats = isFn ? Game.cpu.getHeapStatistics() : null;
			({
				isFn,
				isObject: typeof stats === 'object' && stats !== null,
				limitIsNumber: stats ? typeof stats.heap_size_limit === 'number' : false,
				limitPositive: stats ? stats.heap_size_limit > 0 : false,
				usedIsNumber: stats ? typeof stats.used_heap_size === 'number' : false,
				usedWithinLimit: stats ? stats.used_heap_size >= 0 && stats.used_heap_size <= stats.heap_size_limit : false,
			})
		`) as Record<string, boolean>;

		expect(result.isFn).toBe(true);
		expect(result.isObject).toBe(true);
		expect(result.limitIsNumber).toBe(true);
		expect(result.limitPositive).toBe(true);
		expect(result.usedIsNumber).toBe(true);
		expect(result.usedWithinLimit).toBe(true);
	});
});
