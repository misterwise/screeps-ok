import { describe, test, expect, code, OK, CARRY, MOVE, STRUCTURE_CONTAINER } from '../../src/index.js';

describe('StructureContainer', () => {
	test('CONTAINER-003 a hostile creep adjacent to a container can withdraw from it', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_CONTAINER,
			store: { energy: 100 },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: [CARRY, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p2', code`
			Game.getObjectById(${creepId}).withdraw(Game.getObjectById(${containerId}), RESOURCE_ENERGY, 30)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy).toBe(30);

		const container = await shard.expectStructure(containerId, STRUCTURE_CONTAINER);
		expect(container.store.energy).toBe(70);
	});
});
