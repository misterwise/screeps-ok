import { describe, test, expect, code } from '../../src/index.js';

describe('source regeneration', () => {
	test('SOURCE-REGEN-002 depleted source regenerates to full capacity after ENERGY_REGEN_TIME ticks', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 25],
			energy: 0,
			energyCapacity: 3000,
			ticksToRegeneration: 300,
		});

		// After 299 ticks, source should still be depleted
		await shard.tick(299);
		const before = await shard.expectObject(srcId, 'source');
		expect(before.energy).toBe(0);

		// On tick 300, source should regenerate
		await shard.tick(1);
		const after = await shard.expectObject(srcId, 'source');
		expect(after.energy).toBe(3000);
	}, 30000);
});
