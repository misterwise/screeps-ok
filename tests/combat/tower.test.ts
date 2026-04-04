import { describe, test, expect, code, OK, ERR_NOT_ENOUGH_ENERGY, MOVE, TOUGH, body, STRUCTURE_TOWER, STRUCTURE_ROAD } from '../../src/index.js';

describe('StructureTower', () => {
	test('TOWER-ATTACK-002 [range<=5] tower.attack() deals 600 damage at range <=5', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 3, owner: 'p1' }],
		});
		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 1000 },
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 28], owner: 'p2', // range 3
			body: body(9, TOUGH, MOVE),
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${towerId}).attack(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const target = await shard.expectObject(targetId, 'creep');
		expect(target.hits).toBe(1000 - 600); // max damage at close range
	});

	test('TOWER-ATTACK-001 tower.attack() spends 10 energy in the same tick', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 3, owner: 'p1' }],
		});
		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 1000 },
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 28], owner: 'p2',
			body: body(9, TOUGH, MOVE),
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${towerId}).attack(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const tower = await shard.expectStructure(towerId, STRUCTURE_TOWER);
		expect(tower.store.energy).toBe(990);
	});

	test('TOWER-ATTACK-002 [range=20] tower.attack() deals the expected falloff damage beyond range 5', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 3, owner: 'p1' }],
		});
		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 1000 },
		});
		// Range 20 — well into falloff range
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 45], owner: 'p2',
			body: body(9, TOUGH, MOVE),
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${towerId}).attack(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const target = await shard.expectObject(targetId, 'creep');
		expect(target.hits).toBe(1000 - 150);
	});

	test('TOWER-HEAL-003 [friendly-creep] tower.heal() returns OK for an in-range friendly creep', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 3, owner: 'p1' }],
		});
		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 1000 },
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 28], owner: 'p1',
			body: body(9, TOUGH, MOVE),
		});

		const healRc = await shard.runPlayer('p1', code`
			Game.getObjectById(${towerId}).heal(Game.getObjectById(${targetId}))
		`);
		expect(healRc).toBe(OK);
	});

	test('TOWER-HEAL-001 tower.heal() spends 10 energy in the same tick', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 3, owner: 'p1' }],
		});
		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 1000 },
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 28], owner: 'p1',
			body: body(9, TOUGH, MOVE),
		});

		const healRc = await shard.runPlayer('p1', code`
			Game.getObjectById(${towerId}).heal(Game.getObjectById(${targetId}))
		`);
		expect(healRc).toBe(OK);
		await shard.tick();

		const tower = await shard.expectStructure(towerId, STRUCTURE_TOWER);
		expect(tower.store.energy).toBe(990);
	});

	test('TOWER-REPAIR-002 [range<=5] tower.repair() repairs 800 HP at range <=5', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 3);
		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 1000 },
		});
		const roadId = await shard.placeStructure('W1N1', {
			pos: [25, 28], structureType: STRUCTURE_ROAD, hits: 100,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${towerId}).repair(Game.getObjectById(${roadId}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const road = await shard.expectStructure(roadId, STRUCTURE_ROAD);
		expect(road.hits).toBe(900); // 100 + 800 repair at close range
	});

	test('TOWER-REPAIR-001 tower.repair() spends 10 energy in the same tick', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 3);
		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 1000 },
		});
		const roadId = await shard.placeStructure('W1N1', {
			pos: [25, 28], structureType: STRUCTURE_ROAD, hits: 100,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${towerId}).repair(Game.getObjectById(${roadId}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const tower = await shard.expectStructure(towerId, STRUCTURE_TOWER);
		expect(tower.store.energy).toBe(990);
	});

	test('tower.attack() returns ERR_NOT_ENOUGH_ENERGY without energy', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 3, owner: 'p1' }],
		});
		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			// no energy
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 28], owner: 'p2',
			body: [TOUGH, MOVE],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${towerId}).attack(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(ERR_NOT_ENOUGH_ENERGY);
	});
});
