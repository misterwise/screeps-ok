import { describe, test, expect, code, body, OK, ERR_NOT_IN_RANGE, ERR_NO_BODYPART, ERR_NOT_ENOUGH_RESOURCES, WORK, CARRY, MOVE, HARVEST_POWER, CARRY_CAPACITY } from '../../src/index.js';

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

	test('HARVEST-005 harvest reduces source energy by the harvested amount', async ({ shard }) => {
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

	test('HARVEST-001 harvest is capped by remaining source energy', async ({ shard }) => {
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

	test('HARVEST-006 harvest is capped by remaining carry capacity', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// 5 WORK = 10 energy/tick, but only 1 CARRY (50 capacity) with 45 already stored
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: body(5, WORK, CARRY, MOVE),
			store: { energy: 45 },
		});
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 26], energy: 3000, energyCapacity: 3000,
		});

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${srcId}))
		`);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		// Harvest produces 10 but only 5 capacity remaining → gets 5? Or gets 10 and overflows?
		// In Screeps, harvest fills up to capacity — capped at free capacity
		expect(creep.store.energy).toBe(CARRY_CAPACITY);
	});
});
