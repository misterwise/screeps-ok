import { describe, test, expect, code, OK, ERR_NOT_ENOUGH_ENERGY, MOVE, TOUGH, ATTACK, body, STRUCTURE_TOWER, STRUCTURE_ROAD } from '../../src/index.js';
import { towerAttackRangeCases, towerHealRangeCases, towerRepairRangeCases } from '../support/matrices/tower-range.js';

describe('StructureTower', () => {
	for (const { range, expectedAmount } of towerAttackRangeCases) {
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
			expect(target.hits).toBe(1000 - expectedAmount);
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

	for (const { range, expectedAmount } of towerHealRangeCases) {
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
			expect(healed.hits).toBe(500 + expectedAmount);
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

	for (const { range, expectedAmount } of towerRepairRangeCases) {
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
			expect(road.hits).toBe(100 + expectedAmount);
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

	test('TOWER-ATTACK-004 tower.attack() returns ERR_NOT_ENOUGH_ENERGY when stored energy is below TOWER_ENERGY_COST', async ({ shard }) => {
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
