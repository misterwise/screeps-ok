import {
	describe, test, expect, code,
	OK,
	MOVE, BODYPART_COST,
	STRUCTURE_SPAWN,
	TOP, BOTTOM, LEFT,
} from '../../src/index.js';

describe('Spawning duration and direction', () => {
	test('SPAWN-TIMING-007 spawning.setDirections replaces the current direction array', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		await shard.tick();

		const started = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([MOVE, MOVE, MOVE], 'DirectionReplace', {
				directions: [TOP, BOTTOM],
			})
		`);
		expect(started).toBe(OK);

		await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawning.setDirections([BOTTOM, TOP])
		`);

		const beforeSecondSet = await shard.runPlayer('p1', code`
			const spawn = Game.getObjectById(${spawnId});
			const before = spawn.spawning.directions;
			spawn.spawning.setDirections([LEFT]);
			before
		`) as number[];
		expect(beforeSecondSet).toEqual([BOTTOM, TOP]);

		const directions = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawning.directions
		`) as number[];
		expect(directions).toEqual([LEFT]);
	});

	test('SPAWN-TIMING-008 spawning.cancel() returns OK, clears the spawn next tick, and does not refund the energy', async ({ shard }) => {
		// Engine structures.js:1327 pushes a cancelSpawning intent; the processor
		// (spawns/cancel-spawning.js) deletes the half-built creep and nulls
		// `spawning`. The energy was spent when spawning started and stays spent.
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		await shard.tick();

		const started = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([MOVE, MOVE, MOVE], 'Cancelled')
		`);
		expect(started).toBe(OK);
		const cost = 3 * BODYPART_COST[MOVE];

		const cancelled = await shard.runPlayer('p1', code`
			(function () {
				const spawn = Game.getObjectById(${spawnId});
				return {
					energy: spawn.store.energy,
					spawningName: spawn.spawning.name,
					rc: spawn.spawning.cancel(),
				};
			})()
		`) as { energy: number; spawningName: string; rc: number };
		// A spawn below capacity in a room below SPAWN_ENERGY_CAPACITY regenerates
		// 1 energy per tick, starting on the spawn tick itself.
		expect(cancelled.spawningName).toBe('Cancelled');
		expect(cancelled.rc).toBe(OK);
		expect(cancelled.energy).toBe(300 - cost + 1);

		const after = await shard.runPlayer('p1', code`
			(function () {
				const spawn = Game.getObjectById(${spawnId});
				return {
					spawning: spawn.spawning,
					creep: typeof Game.creeps['Cancelled'],
					energy: spawn.store.energy,
				};
			})()
		`) as { spawning: unknown; creep: string; energy: number };
		expect(after.spawning).toBe(null);
		expect(after.creep).toBe('undefined');
		// One more tick of regen and nothing else: a refund would add the cost.
		expect(after.energy).toBe(300 - cost + 2);
	});
});
