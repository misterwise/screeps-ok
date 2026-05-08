import { describe, test, expect, STRUCTURE_EXTRACTOR } from '../../src/index.js';

describe('StructureExtractor cooldown property', () => {
	test('EXTRACTOR-001 cooldown returns 0 when no cooldown is active', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 6, owner: 'p1' }],
		});
		const extractorId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_EXTRACTOR, owner: 'p1',
		});
		await shard.tick();

		const extractor = await shard.expectStructure(extractorId, STRUCTURE_EXTRACTOR);
		expect(extractor.cooldown).toBe(0);
	});

	test('EXTRACTOR-002 cooldown decreases by 1 each tick until reaching 0', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 6, owner: 'p1' }],
		});
		const extractorId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_EXTRACTOR, owner: 'p1',
			cooldown: 3,
		});
		await shard.tick();

		const after1 = await shard.expectStructure(extractorId, STRUCTURE_EXTRACTOR);
		expect(after1.cooldown).toBe(2);

		await shard.tick();
		const after2 = await shard.expectStructure(extractorId, STRUCTURE_EXTRACTOR);
		expect(after2.cooldown).toBe(1);

		await shard.tick();
		const after3 = await shard.expectStructure(extractorId, STRUCTURE_EXTRACTOR);
		expect(after3.cooldown).toBe(0);
	});
});
