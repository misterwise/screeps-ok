import { describe, test, expect, code } from '../../src/index.js';

describe('source regeneration', () => {
	test('depleted source regenerates after ENERGY_REGEN_TIME ticks', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1' }],
		});
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 25],
			energy: 0,
			energyCapacity: 3000,
			ticksToRegeneration: 300,
		});

		// After 299 ticks, source should still be depleted
		await shard.tick(299);
		const before = await shard.getObject(srcId);
		if (before?.kind === 'source') {
			expect(before.energy).toBe(0);
		}

		// On tick 300, source should regenerate
		await shard.tick(1);
		const after = await shard.getObject(srcId);
		if (after?.kind === 'source') {
			expect(after.energy).toBe(3000);
		}
	});
});
