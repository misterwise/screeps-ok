import { describe, test, expect, code,
	SOURCE_ENERGY_CAPACITY,
} from '../../src/index.js';

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
	}, 120000);

	test('SOURCE-REGEN-001 source energyCapacity in an owned room equals SOURCE_ENERGY_CAPACITY', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 25],
		});

		const src = await shard.expectObject(srcId, 'source');
		expect(src.energyCapacity).toBe(SOURCE_ENERGY_CAPACITY);
	});

	test('SOURCE-REGEN-003 a source below full capacity exposes ticksToRegeneration', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 25],
			energy: 0,
			energyCapacity: 3000,
			ticksToRegeneration: 300,
		});

		const src = await shard.expectObject(srcId, 'source');
		expect(src.energy).toBe(0);
		expect(src.ticksToRegeneration).toBeGreaterThan(0);
	});

	test('SOURCE-REGEN-004 ticksToRegeneration decreases by 1 each tick', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 25],
			energy: 0,
			energyCapacity: 3000,
			ticksToRegeneration: 300,
		});
		await shard.tick();

		const before = await shard.expectObject(srcId, 'source');
		const ttrBefore = before.ticksToRegeneration;
		expect(ttrBefore).toBeGreaterThan(0);

		await shard.tick(3);

		const after = await shard.expectObject(srcId, 'source');
		expect(after.ticksToRegeneration).toBe(ttrBefore - 3);
	});
});
