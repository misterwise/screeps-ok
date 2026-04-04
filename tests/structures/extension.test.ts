import { describe, test, expect, code, STRUCTURE_EXTENSION } from '../../src/index.js';

describe('StructureExtension', () => {
	test('an active extension contributes exactly its stored energy to room.energyAvailable', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		await shard.placeStructure('W1N1', {
			pos: [25, 25],
			structureType: STRUCTURE_EXTENSION,
			owner: 'p1',
			store: { energy: 37 },
		});
		await shard.tick();

		const energyAvailable = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].energyAvailable
		`);

		expect(energyAvailable).toBe(37);
	});

	test('an active extension contributes exactly its energy capacity to room.energyCapacityAvailable', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		await shard.placeStructure('W1N1', {
			pos: [25, 25],
			structureType: STRUCTURE_EXTENSION,
			owner: 'p1',
			store: { energy: 0 },
		});
		await shard.tick();

		const energyCapacityAvailable = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].energyCapacityAvailable
		`);

		expect(energyCapacityAvailable).toBe(50);
	});
});
