import { describe, test, expect, code } from '../../src/index.js';

describe('source regeneration', () => {
	test('source regenerates to full after ENERGY_REGEN_TIME (300) ticks', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1' }],
		});
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 25],
			energy: 0,
			energyCapacity: 3000,
		});

		await shard.tick(300);

		const source = await shard.getObject(srcId);
		if (source?.kind === 'source') {
			expect(source.energy).toBe(3000);
		}
	});

	test('partially depleted source still regenerates at 300 tick intervals', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1' }],
		});
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 25],
			energy: 1000,
			energyCapacity: 3000,
		});

		// After 300 ticks, source should be back to full
		await shard.tick(300);

		const source = await shard.getObject(srcId);
		if (source?.kind === 'source') {
			expect(source.energy).toBe(3000);
		}
	});
});
