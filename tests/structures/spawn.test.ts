import { describe, test, expect, code } from '../../src/index.js';

describe('StructureSpawn', () => {
	test('spawnCreep returns OK with valid body and energy', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: 'spawn', owner: 'p1',
			store: { energy: 300 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([WORK, CARRY, MOVE], 'Worker1')
		`);
		expect(rc).toBe(0); // OK
	});

	test('spawnCreep returns ERR_NOT_ENOUGH_ENERGY without sufficient energy', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		// Spawn with only 50 energy — WORK(100)+CARRY(50)+MOVE(50) costs 200
		// Total available energy in room must be < 200
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: 'spawn', owner: 'p1',
			store: { energy: 50 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([WORK, CARRY, MOVE], 'Worker1')
		`);
		// Note: spawn draws from all extensions + spawn. If addBot created a spawn
		// with default energy, total might exceed 200. This test may need adjustment
		// per adapter if addBot contributes extra energy.
		expect(rc).toBe(-6); // ERR_NOT_ENOUGH_ENERGY
	});

	test('spawnCreep returns ERR_NAME_EXISTS for duplicate name', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: 'spawn', owner: 'p1',
			store: { energy: 600 },
		});

		// Place a creep with the name we'll try to spawn
		await shard.placeCreep('W1N1', {
			pos: [20, 20], owner: 'p1',
			body: ['move'], name: 'DuplicateName',
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([MOVE], 'DuplicateName')
		`);
		expect(rc).toBe(-3); // ERR_NAME_EXISTS
	});

	test('spawnCreep body part costs: WORK=100, CARRY=50, MOVE=50', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});

		// WORK(100) + CARRY(50) + MOVE(50) = 200
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: 'spawn', owner: 'p1',
			store: { energy: 200 },
		});
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([WORK, CARRY, MOVE], 'TestExact')
		`);
		expect(rc).toBe(0); // exactly enough
	});
});
