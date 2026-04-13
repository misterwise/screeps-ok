import { describe, test, expect, code,
	OK, MOVE, WORK,
	STRUCTURE_ROAD, TOP,
} from '../../src/index.js';

describe('Road fatigue', () => {
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

	test('ROAD-FATIGUE-002 a road on swamp reduces the fatigue multiplier to 1', async ({ shard }) => {
		shard.requires('terrain', 'swamp tile required for swamp-road fatigue assertion');
		// [25, 24] = swamp, everything else plain.
		const terrain = new Array(2500).fill(0);
		terrain[24 * 50 + 25] = 2;
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1', terrain }],
		});
		await shard.placeStructure('W1N1', {
			pos: [25, 24], structureType: STRUCTURE_ROAD,
		});
		// 3 weighted parts (3 WORK) + 1 MOVE.
		// Without the road, swamp would generate 3 * 10 = 30 fatigue.
		// With the road, the multiplier is 1: 3 * 1 = 3 fatigue.
		// 1 MOVE part reduces by 2 → final = 1.
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [WORK, WORK, WORK, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).move(TOP)
		`);
		expect(rc).toBe(OK);

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.pos.y).toBe(24);
		expect(creep.fatigue).toBe(1);
	});
});
