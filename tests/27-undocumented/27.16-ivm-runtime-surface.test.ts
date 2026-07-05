import { describe, test, expect, code } from '../../src/index.js';

// This came up as an error running a real bot on an experimental screeps engine — the
// engine did not provide `Game.cpu.getHeapStatistics()`. No screeps-ok suite covers it;
// this test is meant to cover that gap.
describe('IVM-RUNTIME-001: Game.cpu.getHeapStatistics exposes a V8 heap-stats object', () => {
	test('getHeapStatistics is callable and returns numeric heap fields', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			(function () {
				const isFn = typeof Game.cpu.getHeapStatistics === 'function';
				if (!isFn) return { isFn: false };
				const s = Game.cpu.getHeapStatistics();
				return {
					isFn: true,
					isObject: typeof s === 'object' && s !== null,
					limitIsNumber: typeof s.heap_size_limit === 'number',
					limitPositive: s.heap_size_limit > 0,
					usedIsNumber: typeof s.used_heap_size === 'number',
					usedWithinLimit: s.used_heap_size >= 0 && s.used_heap_size <= s.heap_size_limit,
				};
			})()
		`) as Record<string, unknown>;

		expect(result.isFn).toBe(true);
		expect(result.isObject).toBe(true);
		expect(result.limitIsNumber).toBe(true);
		expect(result.limitPositive).toBe(true);
		expect(result.usedIsNumber).toBe(true);
		expect(result.usedWithinLimit).toBe(true);
	});
});
