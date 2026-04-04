import {
	describe, test, expect, code,
	OK, ERR_NOT_ENOUGH_ENERGY, ERR_NAME_EXISTS,
	WORK, CARRY, MOVE,
	STRUCTURE_SPAWN, STRUCTURE_EXTENSION,
} from '../../src/index.js';

describe('StructureSpawn', () => {
	test('spawnCreep returns OK with a valid body and sufficient selected energy', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([WORK, CARRY, MOVE], 'Worker1')
		`);
		expect(rc).toBe(OK);
	});

	test('spawnCreep returns ERR_NOT_ENOUGH_ENERGY when the selected energy sources cannot pay the spawn cost', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 0 },
		});
		const ext1 = await shard.placeStructure('W1N1', {
			pos: [26, 25], structureType: STRUCTURE_EXTENSION, owner: 'p1',
			store: { energy: 50 },
		});
		const ext2 = await shard.placeStructure('W1N1', {
			pos: [27, 25], structureType: STRUCTURE_EXTENSION, owner: 'p1',
			store: { energy: 50 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep(
				[WORK, CARRY, MOVE],
				'Worker1',
				{ energyStructures: [Game.getObjectById(${ext1}), Game.getObjectById(${ext2})] }
			)
		`);
		expect(rc).toBe(ERR_NOT_ENOUGH_ENERGY);
	});

	test('spawnCreep returns ERR_NAME_EXISTS for duplicate name', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 600 },
		});

		// Place a creep with the name we'll try to spawn
		await shard.placeCreep('W1N1', {
			pos: [20, 20], owner: 'p1',
			body: [MOVE], name: 'DuplicateName',
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([MOVE], 'DuplicateName')
		`);
		expect(rc).toBe(ERR_NAME_EXISTS);
	});

	test('spawnCreep(..., { dryRun: true }) does not consume energy or create a creep', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 200 },
		});

		const result = await shard.runPlayer('p1', code`
			const spawn = Game.getObjectById(${spawnId});
			const rc = spawn.spawnCreep([WORK, CARRY, MOVE], 'DryRunWorker', { dryRun: true });
			({
				rc,
				energy: spawn.store.energy,
				hasCreep: !!Game.creeps['DryRunWorker'],
			})
		`) as { rc: number; energy: number; hasCreep: boolean };

		expect(result).toEqual({
			rc: OK,
			energy: 200,
			hasCreep: false,
		});
	});
});
