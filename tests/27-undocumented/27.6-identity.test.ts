import { describe, test, expect, code, MOVE, STRUCTURE_SPAWN } from '../../src/index.js';

describe('Undocumented API Surface — within-tick object identity', () => {
	test('UNDOC-IDENTITY-001 Game.creeps[name] returns the same reference within a tick', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE], name: 'scout',
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const a = Game.creeps['scout'];
			const b = Game.creeps['scout'];
			({ same: a === b, defined: a !== undefined })
		`) as { same: boolean; defined: boolean };

		expect(result.defined).toBe(true);
		expect(result.same).toBe(true);
	});

	test('UNDOC-IDENTITY-002 Game.rooms[name] returns the same reference within a tick', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const name = Object.keys(Game.rooms)[0];
			const a = Game.rooms[name];
			const b = Game.rooms[name];
			({ same: a === b, defined: a !== undefined })
		`) as { same: boolean; defined: boolean };

		expect(result.defined).toBe(true);
		expect(result.same).toBe(true);
	});

	test('UNDOC-IDENTITY-003 Game.getObjectById and Room.find return the same structure reference within a tick', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const room = Game.rooms[Object.keys(Game.rooms)[0]];
			const spawn = room.find(FIND_MY_SPAWNS)[0];
			const byId = Game.getObjectById(spawn.id);
			const againByFind = room.find(FIND_MY_SPAWNS)[0];
			({
				byIdSame: spawn === byId,
				findAgainSame: spawn === againByFind,
				defined: spawn !== undefined,
			})
		`) as { byIdSame: boolean; findAgainSame: boolean; defined: boolean };

		expect(result.defined).toBe(true);
		expect(result.byIdSame).toBe(true);
		expect(result.findAgainSame).toBe(true);
	});

	test('UNDOC-IDENTITY-004 ad-hoc property assigned to a game object is readable via a later same-tick lookup', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE], name: 'scout',
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			Game.creeps['scout']._cachedPlan = 'explore-nw';
			const laterLookup = Game.creeps['scout'];
			({ cached: laterLookup._cachedPlan })
		`) as { cached: unknown };

		expect(result.cached).toBe('explore-nw');
	});

	test('UNDOC-IDENTITY-005 ad-hoc properties assigned in one tick are NOT present on the object in a subsequent tick', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE], name: 'scout',
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.creeps['scout']._cachedPlan = 'explore-nw';
			'ok'
		`);

		const result = await shard.runPlayer('p1', code`
			({ cached: Game.creeps['scout']._cachedPlan })
		`) as { cached: unknown };

		expect(result.cached).toBeUndefined();
	});
});
