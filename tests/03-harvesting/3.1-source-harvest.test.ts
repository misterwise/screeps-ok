import { describe, test, expect, code, body,
	OK, ERR_NOT_OWNER, ERR_NOT_IN_RANGE, ERR_NO_BODYPART, ERR_NOT_ENOUGH_RESOURCES,
	ERR_BUSY, ERR_INVALID_TARGET,
	WORK, CARRY, MOVE,
	HARVEST_POWER, CARRY_CAPACITY, ENERGY_DECAY, FIND_DROPPED_RESOURCES,
	RESOURCE_ENERGY, STRUCTURE_SPAWN, STRUCTURE_CONTAINER,
} from '../../src/index.js';

describe('creep.harvest()', () => {
	test('HARVEST-001 harvest deposits HARVEST_POWER energy per WORK part into the creep store', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 26], energy: 3000, energyCapacity: 3000,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${srcId}))
		`);
		expect(rc).toBe(OK);

		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy).toBe(HARVEST_POWER);
	});

	test('HARVEST-009 harvest reduces source energy by the harvested amount', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 26], energy: 3000, energyCapacity: 3000,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${srcId}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const source = await shard.expectObject(srcId, 'source');
		expect(source.energy).toBe(3000 - HARVEST_POWER);
	});

	test('HARVEST-001 multiple WORK parts harvest proportionally', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: body(3, WORK, CARRY, MOVE),
		});
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 26], energy: 3000, energyCapacity: 3000,
		});

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${srcId}))
		`);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy).toBe(3 * HARVEST_POWER);
	});

	test('HARVEST-002 returns ERR_NOT_IN_RANGE when not adjacent', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [10, 10], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		const srcId = await shard.placeSource('W1N1', {
			pos: [20, 20],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${srcId}))
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});

	test('HARVEST-007 harvest() requires range 1: diagonal-adjacent OK, distance 2 returns ERR_NOT_IN_RANGE', async ({ shard }) => {
		// Boundary test for adjacency (range=1 inclusive). HARVEST-001/-005
		// cover orthogonal-adjacent; HARVEST-002 covers the far case (distance 10).
		// HARVEST-007 asserts the exact boundary: diagonal (Chebyshev 1) works,
		// orthogonal distance 2 (Chebyshev 2) fails.
		await shard.ownedRoom('p1');
		const diagCreep = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		const diagSrc = await shard.placeSource('W1N1', {
			pos: [26, 26], energy: 3000, energyCapacity: 3000,
		});
		const farCreep = await shard.placeCreep('W1N1', {
			pos: [30, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		const farSrc = await shard.placeSource('W1N1', {
			pos: [32, 25], energy: 3000, energyCapacity: 3000,
		});

		const result = await shard.runPlayer('p1', code`
			({
				diagonal: Game.getObjectById(${diagCreep}).harvest(Game.getObjectById(${diagSrc})),
				farOrthogonal: Game.getObjectById(${farCreep}).harvest(Game.getObjectById(${farSrc})),
			})
		`) as { diagonal: number; farOrthogonal: number };

		expect(result.diagonal).toBe(OK);
		expect(result.farOrthogonal).toBe(ERR_NOT_IN_RANGE);
	});

	test('HARVEST-008 harvest() returns OK on success', async ({ shard }) => {
		// Contract test: the canonical success return code is exactly OK (0),
		// not some other truthy value. HARVEST-001 uses this indirectly to gate
		// yield assertions; HARVEST-008 isolates the return-code contract.
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 26], energy: 3000, energyCapacity: 3000,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${srcId}))
		`);

		expect(rc).toBe(OK);
		expect(rc).toBe(0);
	});

	test('HARVEST-003 returns ERR_NO_BODYPART without WORK parts', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE], // no WORK
		});
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 26],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${srcId}))
		`);
		expect(rc).toBe(ERR_NO_BODYPART);
	});

	test('HARVEST-004 cannot harvest from depleted source', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 26], energy: 0, energyCapacity: 3000,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${srcId}))
		`);
		expect(rc).toBe(ERR_NOT_ENOUGH_RESOURCES);
	});

	test('HARVEST-014 harvest is capped by remaining source energy', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: body(5, WORK, 2, CARRY, MOVE),
		});
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 26], energy: 3, energyCapacity: 3000,
		});

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${srcId}))
		`);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy).toBe(3); // capped at source energy, not 5*2=10

		const source = await shard.expectObject(srcId, 'source');
		expect(source.energy).toBe(0);
	});

	test('HARVEST-005 successful harvest(source) increases store.energy by the harvested amount', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, WORK, CARRY, MOVE],
		});
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 26], energy: 3000, energyCapacity: 3000,
		});

		const storeBefore = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).store.energy
		`) as number;

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${srcId}))
		`);
		expect(rc).toBe(OK);

		const storeAfter = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).store.energy
		`) as number;
		expect(storeAfter).toBe(storeBefore + 2 * HARVEST_POWER);
	});

	test('HARVEST-006 harvest can exceed free carry capacity and drops overflow as a resource', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// 25 WORK = 50 energy/tick, 1 CARRY (50 capacity) with 5 already stored → 45 free.
		// Harvest produces 50, overflow = 5 dropped on the tile.
		// In-tick decay reduces the pile by ceil(5/ENERGY_DECAY) = 1.
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: body(25, WORK, CARRY, MOVE),
			store: { energy: 5 },
		});
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 26], energy: 3000, energyCapacity: 3000,
		});

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${srcId}))
		`);

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy).toBe(CARRY_CAPACITY);

		const source = await shard.expectObject(srcId, 'source');
		expect(source.energy).toBe(3000 - 25 * HARVEST_POWER);

		const drops = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		const pile = drops.find(r => r.pos.x === 25 && r.pos.y === 25);
		expect(pile).toBeDefined();
		expect(pile!.resourceType).toBe(RESOURCE_ENERGY);
		const overflow = 25 * HARVEST_POWER - (CARRY_CAPACITY - 5);
		expect(pile!.amount).toBe(overflow - Math.ceil(overflow / ENERGY_DECAY));
	});

	test('HARVEST-010 harvest returns ERR_NOT_OWNER when room controller is owned by another player', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const creepId = await shard.placeCreep('W2N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		const srcId = await shard.placeSource('W2N1', {
			pos: [25, 26], energy: 3000, energyCapacity: 3000,
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${srcId}))
		`);
		expect(rc).toBe(ERR_NOT_OWNER);
	});

	test('HARVEST-011 harvest returns ERR_NOT_OWNER on unowned creep', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p2',
			body: [WORK, CARRY, MOVE],
		});
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 26], energy: 3000, energyCapacity: 3000,
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${srcId}))
		`);
		expect(rc).toBe(ERR_NOT_OWNER);
	});

	test('HARVEST-012 harvest returns ERR_BUSY while the creep is spawning', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 1);
		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 26], energy: 3000, energyCapacity: 3000,
		});
		await shard.tick();

		const spawnRc = await shard.runPlayer('p1', code`
			const spawns = Object.values(Game.spawns);
			spawns[0].spawnCreep([WORK, CARRY, MOVE], 'Harvester')
		`);
		expect(spawnRc).toBe(OK);

		const rc = await shard.runPlayer('p1', code`
			const c = Game.creeps['Harvester'];
			c ? c.harvest(Game.getObjectById(${srcId})) : -99
		`);
		expect(rc).toBe(ERR_BUSY);
	});

	test('HARVEST-013 harvest returns ERR_INVALID_TARGET for omitted or non-harvestable targets', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		const containerId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_CONTAINER,
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			({
				omitted: creep.harvest(),
				undefinedArg: creep.harvest(undefined),
				nullArg: creep.harvest(null),
				plainObject: creep.harvest({}),
				container: creep.harvest(Game.getObjectById(${containerId})),
			})
		`) as Record<string, number>;
		expect(result.omitted).toBe(ERR_INVALID_TARGET);
		expect(result.undefinedArg).toBe(ERR_INVALID_TARGET);
		expect(result.nullArg).toBe(ERR_INVALID_TARGET);
		expect(result.plainObject).toBe(ERR_INVALID_TARGET);
		expect(result.container).toBe(ERR_INVALID_TARGET);
	});
});
