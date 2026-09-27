import { describe, test, expect, code,
	OK, ERR_RCL_NOT_ENOUGH,
	BODYPART_HITS, MOVE,
	STRUCTURE_TOWER, STRUCTURE_ROAD, STRUCTURE_CONTAINER,
} from '../../src/index.js';

describe('Structure isActive()', () => {
	test('STRUCTURE-ACTIVE-002 inactive structures reject gated gameplay actions', async ({ shard }) => {
		// Place a tower at RCL 2 (towers require RCL 3) and verify a gated action rejects.
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 100 },
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2', body: [MOVE], name: 'InactiveTowerTarget',
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const tower = Game.getObjectById(${towerId});
			({
				active: tower.isActive(),
				rc: tower.attack(Game.getObjectById(${targetId})),
			})
		`) as { active: boolean; rc: number };
		expect(result).toEqual({ active: false, rc: ERR_RCL_NOT_ENOUGH });

		const target = await shard.expectObject(targetId, 'creep');
		expect(target.hits).toBe(BODYPART_HITS);
	});

	test('STRUCTURE-ACTIVE-004 unowned structures with no controller limit return true from isActive', async ({ shard }) => {
		// Roads and containers have no controller structure limit.
		await shard.ownedRoom('p1', 'W1N1', 1);
		const roadId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_ROAD,
		});
		const containerId = await shard.placeStructure('W1N1', {
			pos: [26, 25], structureType: STRUCTURE_CONTAINER,
		});
		await shard.tick();

		// A controller is owned but has no CONTROLLER_STRUCTURES entry (game/structures.js:112).
		const results = await shard.runPlayer('p1', code`
			({
				road: Game.getObjectById(${roadId}).isActive(),
				container: Game.getObjectById(${containerId}).isActive(),
				controller: Game.rooms.W1N1.controller.isActive(),
			})
		`);
		expect(results).toEqual({ road: true, container: true, controller: true });
	});
});
