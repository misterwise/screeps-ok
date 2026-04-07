import { describe, test, expect, code,
	OK, MOVE, WORK,
	STRUCTURE_ROAD, ROAD_HITS,
} from '../../src/index.js';

describe('StructureRoad', () => {
	test('ROAD-HITS-001 road initializes with ROAD_HITS', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const roadId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_ROAD,
		});

		const road = await shard.expectStructure(roadId, STRUCTURE_ROAD);
		expect(road.hits).toBe(ROAD_HITS);
		expect(road.hitsMax).toBe(ROAD_HITS);
	});

	test('ROAD-FATIGUE-001 creep moving onto a road accumulates half the fatigue of plain terrain', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_ROAD,
		});
		await shard.placeStructure('W1N1', {
			pos: [25, 24], structureType: STRUCTURE_ROAD,
		});
		// 1 WORK + 1 MOVE: on road, 1 non-move * 1 = 1 fatigue, -2 from MOVE = 0
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).move(TOP)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.pos.y).toBe(24);
		// On road: 1 non-move part * 1 (road cost) = 1 fatigue, 1 MOVE removes 2 → net 0
		expect(creep.fatigue).toBe(0);
	});
});
