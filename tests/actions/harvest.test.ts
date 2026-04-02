import { describe, test, expect, code, body, OK, ERR_NOT_IN_RANGE, ERR_NO_BODYPART, ERR_NOT_ENOUGH_RESOURCES, WORK, CARRY, MOVE } from '../../src/index.js';

describe('creep.harvest()', () => {
	test('harvests 2 energy per WORK part from adjacent source', async ({ shard }) => {
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
		expect(creep.store.energy).toBe(2); // 1 WORK = 2 energy/tick

		const source = await shard.expectObject(srcId, 'source');
		expect(source.energy).toBe(2998);
	});

	test('multiple WORK parts harvest proportionally', async ({ shard }) => {
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
		expect(creep.store.energy).toBe(6); // 3 WORK = 6 energy/tick
	});

	test('returns ERR_NOT_IN_RANGE when not adjacent', async ({ shard }) => {
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

	test('returns ERR_NO_BODYPART without WORK parts', async ({ shard }) => {
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

	test('cannot harvest from depleted source', async ({ shard }) => {
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

	test('harvest is capped by remaining source energy', async ({ shard }) => {
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

	test('harvest is capped by remaining carry capacity', async ({ shard }) => {
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
		expect(creep.store.energy).toBe(50);
	});
});
