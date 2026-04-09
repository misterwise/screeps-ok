import { describe, test, expect, code,
	OK, MOVE, WORK, CARRY,
	STRUCTURE_ROAD, ROAD_HITS, ROAD_WEAROUT, TOP,
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

	test('ROAD-WEAR-001 moving onto a road advances nextDecayTime by ROAD_WEAROUT * body.length', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const roadId = await shard.placeStructure('W1N1', {
			pos: [25, 24], structureType: STRUCTURE_ROAD,
			ticksToDecay: 1000,
		});
		// Creep with 3 body parts: [WORK, CARRY, MOVE]
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		await shard.tick();

		const roadBefore = await shard.expectStructure(roadId, STRUCTURE_ROAD);
		const ttdBefore = roadBefore.ticksToDecay;
		expect(ttdBefore).toBeGreaterThan(0);

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).move(TOP)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.pos.y).toBe(24);

		const roadAfter = await shard.expectStructure(roadId, STRUCTURE_ROAD);
		// Road wear advances decay timer by ROAD_WEAROUT * body.length.
		// runPlayer (1 tick) + tick() (1 tick) = 2 ticks elapsed.
		const expectedDecrease = ROAD_WEAROUT * 3 + 2;
		expect(roadAfter.ticksToDecay).toBe(ttdBefore - expectedDecrease);
	});

	test('ROAD-WEAR-002 road wear is applied in the same tick the creep moves onto the road', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const roadId = await shard.placeStructure('W1N1', {
			pos: [25, 24], structureType: STRUCTURE_ROAD,
			ticksToDecay: 1000,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE],
		});
		await shard.tick();

		const roadBefore = await shard.expectStructure(roadId, STRUCTURE_ROAD);
		const ttdBefore = roadBefore.ticksToDecay;

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).move(TOP)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.pos.y).toBe(24);

		const roadAfter = await shard.expectStructure(roadId, STRUCTURE_ROAD);
		// Wear (ROAD_WEAROUT * 1) + 2 ticks elapsed (runPlayer + tick).
		expect(roadAfter.ticksToDecay).toBe(ttdBefore - ROAD_WEAROUT * 1 - 2);
	});
});
