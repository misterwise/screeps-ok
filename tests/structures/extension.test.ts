import { describe, test, expect, code } from '../../src/index.js';

describe('StructureExtension', () => {
	test('extensions contribute energy to spawn', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		// Spawn with 100 energy, extension with 50 = 150 total
		// MOVE(50) + MOVE(50) = 100 cost — should succeed
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: 'spawn', owner: 'p1',
			store: { energy: 100 },
		});
		await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: 'extension', owner: 'p1',
			store: { energy: 50 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([MOVE, MOVE], 'ExtTest')
		`);
		expect(rc).toBe(0);
	});
});
