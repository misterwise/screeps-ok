import {
	describe, test, expect, code,
	OK, ERR_NOT_ENOUGH_ENERGY, ERR_NAME_EXISTS,
	WORK, CARRY, MOVE, BODYPART_COST,
	STRUCTURE_SPAWN, STRUCTURE_EXTENSION,
} from '../../src/index.js';

describe('StructureSpawn', () => {
	const workerBodyCost = BODYPART_COST[WORK] + BODYPART_COST[CARRY] + BODYPART_COST[MOVE];

	test('SPAWN-CREATE-004 spawnCreep succeeds when available energy exactly matches the summed BODYPART_COST', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: workerBodyCost },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([WORK, CARRY, MOVE], 'Worker1')
		`);
		expect(rc).toBe(OK);
	});

	test('SPAWN-CREATE-004 spawnCreep fails when available energy is 1 below the summed BODYPART_COST', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: workerBodyCost - 1 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([WORK, CARRY, MOVE], 'Worker1')
		`);
		expect(rc).toBe(ERR_NOT_ENOUGH_ENERGY);
	});

	test('SPAWN-CREATE-005 spawnCreep draws energy only from the listed energyStructures', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
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
			const spawn = Game.getObjectById(${spawnId});
			const selected = Game.getObjectById(${ext1});
			spawn.spawnCreep([MOVE], 'SelectedOnly', {
				energyStructures: [selected],
			})
		`);
		expect(rc).toBe(OK);

		await shard.tick();

		const spawn = await shard.expectStructure(spawnId, STRUCTURE_SPAWN);
		const selected = await shard.expectStructure(ext1, STRUCTURE_EXTENSION);
		const other = await shard.expectStructure(ext2, STRUCTURE_EXTENSION);
		expect(spawn.store.energy).toBe(300);
		expect(selected.store.energy ?? 0).toBe(0);
		expect(other.store.energy ?? 0).toBe(50);
	});

	test('SPAWN-CREATE-006 spawnCreep draws energy from listed energyStructures in listed order', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
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
			const spawn = Game.getObjectById(${spawnId});
			const first = Game.getObjectById(${ext1});
			const third = Game.getObjectById(${ext2});
			spawn.spawnCreep([WORK], 'OrderedDrain', {
				energyStructures: [first, spawn, third],
			})
		`);
		expect(rc).toBe(OK);

		await shard.tick();

		const first = await shard.expectStructure(ext1, STRUCTURE_EXTENSION);
		const spawn = await shard.expectStructure(spawnId, STRUCTURE_SPAWN);
		const third = await shard.expectStructure(ext2, STRUCTURE_EXTENSION);
		expect(first.store.energy ?? 0).toBe(0);
		expect(spawn.store.energy).toBe(250);
		expect(third.store.energy ?? 0).toBe(50);
	});

	test('SPAWN-CREATE-007 spawnCreep returns ERR_NOT_ENOUGH_ENERGY when the selected energy sources cannot pay the spawn cost', async ({ shard }) => {
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

	test('SPAWN-CREATE-008 spawnCreep returns ERR_NAME_EXISTS for duplicate name', async ({ shard }) => {
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

	test('SPAWN-CREATE-010 spawnCreep(..., { dryRun: true }) does not consume energy or create a creep', async ({ shard }) => {
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
