import { describe, test, expect, code, OK, ERR_NOT_ENOUGH_ENERGY, MOVE, TOUGH, ATTACK, body, STRUCTURE_TOWER, STRUCTURE_ROAD } from '../../src/index.js';

describe('StructureTower', () => {
	const attackRangeCases = [
		{ range: 3, expectedDamage: 600 },
		{ range: 10, expectedDamage: 450 },
		{ range: 20, expectedDamage: 150 },
	] as const;

	for (const { range, expectedDamage } of attackRangeCases) {
		test(`TOWER-ATTACK-002 [range=${range}] tower.attack() deals the expected falloff damage`, async ({ shard }) => {
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [{ name: 'W1N1', rcl: 3, owner: 'p1' }],
			});
			const towerId = await shard.placeStructure('W1N1', {
				pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
				store: { energy: 1000 },
			});
			const targetId = await shard.placeCreep('W1N1', {
				pos: [25, 25 + range], owner: 'p2',
				body: body(9, TOUGH, MOVE),
			});

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${towerId}).attack(Game.getObjectById(${targetId}))
			`);
			expect(rc).toBe(OK);
			await shard.tick();

			const target = await shard.expectObject(targetId, 'creep');
			expect(target.hits).toBe(1000 - expectedDamage);
		});
	}

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

	const healRangeCases = [
		{ range: 3, expectedHeal: 400 },
		{ range: 10, expectedHeal: 300 },
		{ range: 20, expectedHeal: 100 },
	] as const;

	for (const { range, expectedHeal } of healRangeCases) {
		test(`TOWER-HEAL-002 [range=${range}] tower.heal() restores the expected falloff amount`, async ({ shard }) => {
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [
					{ name: 'W1N1', rcl: 3, owner: 'p1' },
					{ name: 'W2N1', rcl: 1, owner: 'p2' },
				],
			});
			const towerId = await shard.placeStructure('W1N1', {
				pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
				store: { energy: 1000 },
			});
			const targetId = await shard.placeCreep('W1N1', {
				pos: [25, 25 + range], owner: 'p1',
				body: body(10, TOUGH, MOVE),
			});
			const attackerId = await shard.placeCreep('W1N1', {
				pos: [24, 25 + range], owner: 'p2',
				body: body(20, ATTACK, MOVE),
			});

			const damageRc = await shard.runPlayer('p2', code`
				Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
			`);
			expect(damageRc).toBe(OK);
			await shard.tick();

			const injured = await shard.expectObject(targetId, 'creep');
			expect(injured.hits).toBe(500);

			const healRc = await shard.runPlayer('p1', code`
				Game.getObjectById(${towerId}).heal(Game.getObjectById(${targetId}))
			`);
			expect(healRc).toBe(OK);
			await shard.tick();

			const healed = await shard.expectObject(targetId, 'creep');
			expect(healed.hits).toBe(500 + expectedHeal);
		});
	}

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

	const repairRangeCases = [
		{ range: 3, expectedRepair: 800 },
		{ range: 10, expectedRepair: 600 },
		{ range: 20, expectedRepair: 200 },
	] as const;

	for (const { range, expectedRepair } of repairRangeCases) {
		test(`TOWER-REPAIR-002 [range=${range}] tower.repair() restores the expected falloff amount`, async ({ shard }) => {
			await shard.ownedRoom('p1', 'W1N1', 3);
			const towerId = await shard.placeStructure('W1N1', {
				pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
				store: { energy: 1000 },
			});
			const roadId = await shard.placeStructure('W1N1', {
				pos: [25, 25 + range], structureType: STRUCTURE_ROAD, hits: 100,
			});

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${towerId}).repair(Game.getObjectById(${roadId}))
			`);
			expect(rc).toBe(OK);
			await shard.tick();

			const road = await shard.expectStructure(roadId, STRUCTURE_ROAD);
			expect(road.hits).toBe(100 + expectedRepair);
		});
	}

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
