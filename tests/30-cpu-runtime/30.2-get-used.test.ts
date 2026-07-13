/**
 * 30.2 Used CPU
 *
 * Surface contract only: the meter's absolute values are engine-specific
 * (vanilla meters CPU time, xxscreeps meters wall time). The entries pin
 * shape and internal consistency — finite non-negative, and monotonic
 * within a tick.
 */
import { describe, test, expect, code } from '../../src/index.js';

describe('CPU & Runtime — used CPU', () => {
	test('CPU-USED-001 getUsed is callable and returns a finite non-negative number', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const isFn = typeof Game.cpu.getUsed === 'function';
			const used = isFn ? Game.cpu.getUsed() : null;
			({
				isFn,
				isNumber: typeof used === 'number',
				isFinite: Number.isFinite(used),
				nonNegative: typeof used === 'number' && used >= 0,
			})
		`) as Record<string, boolean>;

		expect(result.isFn).toBe(true);
		expect(result.isNumber).toBe(true);
		expect(result.isFinite).toBe(true);
		expect(result.nonNegative).toBe(true);
	});

	test('CPU-USED-002 getUsed is monotonic within a tick and increases after busy work', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const before = Game.cpu.getUsed();
			let acc = 0;
			for (let i = 0; i < 2e6; i++) acc += Math.sqrt(i);
			const after = Game.cpu.getUsed();
			({
				nonDecreasing: after >= before,
				increased: after > before,
				workDone: acc > 0,
			})
		`) as Record<string, boolean>;

		expect(result.workDone).toBe(true);
		expect(result.nonDecreasing).toBe(true);
		expect(result.increased).toBe(true);
	});
});
