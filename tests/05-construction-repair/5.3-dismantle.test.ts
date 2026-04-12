import { describe, test, expect, code, OK, ERR_NOT_IN_RANGE, ERR_NO_BODYPART,
	WORK, CARRY, MOVE, STRUCTURE_WALL, STRUCTURE_RAMPART,
	DISMANTLE_POWER, DISMANTLE_COST } from '../../src/index.js';

describe('creep.dismantle()', () => {
	test('DISMANTLE-001 removes DISMANTLE_POWER HP per WORK part from structure', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, MOVE],
		});
		const wallId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_WALL,
			owner: 'p1', hits: 1000,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).dismantle(Game.getObjectById(${wallId}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const wall = await shard.expectObject(wallId, 'structure');
		expect(wall.hits).toBe(1000 - DISMANTLE_POWER);
	});

	test('DISMANTLE-002 energy gain is floor(damage * DISMANTLE_COST)', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, WORK, CARRY, MOVE],
		});
		const wallId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_WALL,
			owner: 'p1', hits: 1000,
		});

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).dismantle(Game.getObjectById(${wallId}))
		`);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		// floor(2 * DISMANTLE_POWER * DISMANTLE_COST) = floor(100 * 0.005) = 0
		expect(creep.store?.energy ?? 0).toBe(Math.floor(2 * DISMANTLE_POWER * DISMANTLE_COST));
	});

	test('DISMANTLE-003 returns ERR_NOT_IN_RANGE', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [10, 10], owner: 'p1',
			body: [WORK, MOVE],
		});
		const wallId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_WALL,
			owner: 'p1', hits: 1000,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).dismantle(Game.getObjectById(${wallId}))
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});

	test('DISMANTLE-004 damage is redirected to a rampart on the target tile', async ({ shard }) => {
		// Engine dismantle.js:33-36: if a rampart sits on the target's tile,
		// the processor reassigns `target = rampart` before applying damage —
		// the same redirect attack.js performs. So a wall under a rampart is
		// untouched, and the rampart absorbs DISMANTLE_POWER per WORK.
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, MOVE],
		});
		const wallId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_WALL,
			owner: 'p1', hits: 1000,
		});
		const rampartId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_RAMPART,
			owner: 'p1', hits: 5000,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).dismantle(Game.getObjectById(${wallId}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const wall = await shard.expectObject(wallId, 'structure');
		const rampart = await shard.expectObject(rampartId, 'structure');
		expect(wall.hits).toBe(1000); // wall untouched
		expect(rampart.hits).toBe(5000 - DISMANTLE_POWER);
	});

	test('DISMANTLE-005 returns ERR_NO_BODYPART when the creep has no WORK parts', async ({ shard }) => {
		// Engine creeps.js:988 — body part check before target validation.
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
		});
		const wallId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_WALL,
			owner: 'p1', hits: 1000,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).dismantle(Game.getObjectById(${wallId}))
		`);
		expect(rc).toBe(ERR_NO_BODYPART);
	});
});
