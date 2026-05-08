import {
	describe, test, expect, code,
	OK,
	MOVE,
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
});
