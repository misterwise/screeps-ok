import {
	describe, test, expect, code,
	CARRY, MOVE, RESOURCE_ENERGY, STRUCTURE_CONTAINER, STRUCTURE_SPAWN,
} from '../../src/index.js';

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

	test('UNDOC-CTOR-001 new Creep(id) exposes the same public fields as Game.getObjectById(id)', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE], name: 'ctorCreep',
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const expected = Game.getObjectById(${creepId});
			const actual = new Creep(${creepId});
			({
				actual: {
					id: actual.id,
					name: actual.name,
					x: actual.pos.x,
					y: actual.pos.y,
					roomName: actual.pos.roomName,
					owner: actual.owner.username,
				},
				expected: {
					id: expected.id,
					name: expected.name,
					x: expected.pos.x,
					y: expected.pos.y,
					roomName: expected.pos.roomName,
					owner: expected.owner.username,
				},
			})
		`) as { actual: object; expected: object };

		expect(result.actual).toEqual(result.expected);
	});

	test('UNDOC-CTOR-002 new Source(id) exposes the same public fields as Game.getObjectById(id)', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const sourceId = await shard.placeSource('W1N1', {
			pos: [20, 20], energy: 3000, energyCapacity: 3000,
		});

		const result = await shard.runPlayer('p1', code`
			const expected = Game.getObjectById(${sourceId});
			const actual = new Source(${sourceId});
			({
				actual: {
					id: actual.id,
					x: actual.pos.x,
					y: actual.pos.y,
					roomName: actual.pos.roomName,
					energy: actual.energy,
					energyCapacity: actual.energyCapacity,
				},
				expected: {
					id: expected.id,
					x: expected.pos.x,
					y: expected.pos.y,
					roomName: expected.pos.roomName,
					energy: expected.energy,
					energyCapacity: expected.energyCapacity,
				},
			})
		`) as { actual: object; expected: object };

		expect(result.actual).toEqual(result.expected);
	});

	test('UNDOC-CTOR-003 new Structure(id) exposes the same public fields as Game.getObjectById(id)', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const structureId = await shard.placeStructure('W1N1', {
			pos: [24, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const expected = Game.getObjectById(${structureId});
			const actual = new Structure(${structureId});
			({
				actual: {
					id: actual.id,
					x: actual.pos.x,
					y: actual.pos.y,
					roomName: actual.pos.roomName,
					structureType: actual.structureType,
				},
				expected: {
					id: expected.id,
					x: expected.pos.x,
					y: expected.pos.y,
					roomName: expected.pos.roomName,
					structureType: expected.structureType,
				},
			})
		`) as { actual: object; expected: object };

		expect(result.actual).toEqual(result.expected);
	});

	test('UNDOC-CTOR-004 new Resource(id) exposes the same public fields as Game.getObjectById(id)', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [CARRY, MOVE], name: 'dropper',
			store: { energy: 10 },
		});
		await shard.tick();
		await shard.runPlayer('p1', code`
			Game.creeps.dropper.drop(RESOURCE_ENERGY)
		`);
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const expected = Game.rooms.W1N1.find(FIND_DROPPED_RESOURCES)[0];
			const actual = new Resource(expected.id);
			({
				actual: {
					id: actual.id,
					x: actual.pos.x,
					y: actual.pos.y,
					roomName: actual.pos.roomName,
					resourceType: actual.resourceType,
					amount: actual.amount,
				},
				expected: {
					id: expected.id,
					x: expected.pos.x,
					y: expected.pos.y,
					roomName: expected.pos.roomName,
					resourceType: expected.resourceType,
					amount: expected.amount,
				},
			})
		`) as { actual: object; expected: object };

		expect(result.actual).toEqual(result.expected);
	});

	test('UNDOC-CTOR-005 new ConstructionSite(id) exposes the same public fields as Game.getObjectById(id)', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});

		await shard.runPlayer('p1', code`
			Game.rooms.W1N1.createConstructionSite(26, 25, STRUCTURE_CONTAINER)
		`);
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const expected = Game.rooms.W1N1.find(FIND_CONSTRUCTION_SITES)[0];
			const actual = new ConstructionSite(expected.id);
			({
				actual: {
					id: actual.id,
					x: actual.pos.x,
					y: actual.pos.y,
					roomName: actual.pos.roomName,
					structureType: actual.structureType,
				},
				expected: {
					id: expected.id,
					x: expected.pos.x,
					y: expected.pos.y,
					roomName: expected.pos.roomName,
					structureType: expected.structureType,
				},
			})
		`) as { actual: object; expected: object };

		expect(result.actual).toEqual(result.expected);
	});

	test('UNDOC-CTOR-006 new Mineral(id) exposes the same public fields as Game.getObjectById(id)', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const mineralId = await shard.placeMineral('W1N1', {
			pos: [23, 24], mineralType: 'H', mineralAmount: 50000,
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const expected = Game.getObjectById(${mineralId});
			const actual = new Mineral(${mineralId});
			({
				actual: {
					id: actual.id,
					x: actual.pos.x,
					y: actual.pos.y,
					roomName: actual.pos.roomName,
					mineralType: actual.mineralType,
					mineralAmount: actual.mineralAmount,
				},
				expected: {
					id: expected.id,
					x: expected.pos.x,
					y: expected.pos.y,
					roomName: expected.pos.roomName,
					mineralType: expected.mineralType,
					mineralAmount: expected.mineralAmount,
				},
			})
		`) as { actual: object; expected: object };

		expect(result.actual).toEqual(result.expected);
	});

	test('UNDOC-CTOR-007 new Tombstone(id) exposes the same public fields as Game.getObjectById(id)', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const tombstoneId = await shard.placeTombstone('W1N1', {
			pos: [24, 24],
			creepName: 'fallen',
			store: { [RESOURCE_ENERGY]: 25 },
			ticksToDecay: 400,
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const expected = Game.getObjectById(${tombstoneId});
			const actual = new Tombstone(${tombstoneId});
			({
				actual: {
					id: actual.id,
					x: actual.pos.x,
					y: actual.pos.y,
					roomName: actual.pos.roomName,
					deathTime: actual.deathTime,
					ticksToDecay: actual.ticksToDecay,
					energy: actual.store.getUsedCapacity(RESOURCE_ENERGY),
				},
				expected: {
					id: expected.id,
					x: expected.pos.x,
					y: expected.pos.y,
					roomName: expected.pos.roomName,
					deathTime: expected.deathTime,
					ticksToDecay: expected.ticksToDecay,
					energy: expected.store.getUsedCapacity(RESOURCE_ENERGY),
				},
			})
		`) as { actual: object; expected: object };

		expect(result.actual).toEqual(result.expected);
	});

	test('UNDOC-CTOR-008 new Ruin(id) exposes the same public fields as Game.getObjectById(id)', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const ruinId = await shard.placeRuin('W1N1', {
			pos: [25, 24],
			structureType: STRUCTURE_CONTAINER,
			store: { [RESOURCE_ENERGY]: 75 },
			ticksToDecay: 400,
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const expected = Game.getObjectById(${ruinId});
			const actual = new Ruin(${ruinId});
			({
				actual: {
					id: actual.id,
					x: actual.pos.x,
					y: actual.pos.y,
					roomName: actual.pos.roomName,
					structureType: actual.structureType,
					destroyTime: actual.destroyTime,
					ticksToDecay: actual.ticksToDecay,
					energy: actual.store.getUsedCapacity(RESOURCE_ENERGY),
				},
				expected: {
					id: expected.id,
					x: expected.pos.x,
					y: expected.pos.y,
					roomName: expected.pos.roomName,
					structureType: expected.structureType,
					destroyTime: expected.destroyTime,
					ticksToDecay: expected.ticksToDecay,
					energy: expected.store.getUsedCapacity(RESOURCE_ENERGY),
				},
			})
		`) as { actual: object; expected: object };

		expect(result.actual).toEqual(result.expected);
	});
});
