import { describe, test, expect, code, body,
	OK, ERR_NOT_IN_RANGE, ERR_NO_BODYPART,
	WORK, CARRY, MOVE, STRUCTURE_WALL, STRUCTURE_RAMPART,
	FIND_DROPPED_RESOURCES, RESOURCE_ENERGY,
	DISMANTLE_POWER, DISMANTLE_COST, ENERGY_DECAY } from '../../src/index.js';

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

	test('DISMANTLE-006 dismantle() has Chebyshev range 1 — adjacent only', async ({ shard }) => {
		// Engine creeps.js:1033 — `target.pos.isNearTo(this.pos)` is Chebyshev 1.
		// Adjacent wall returns OK; a wall two tiles away returns ERR_NOT_IN_RANGE.
		await shard.ownedRoom('p1');
		const nearCreep = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, MOVE],
		});
		const farCreep = await shard.placeCreep('W1N1', {
			pos: [10, 10], owner: 'p1',
			body: [WORK, MOVE],
		});
		const adjacentWall = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_WALL, owner: 'p1', hits: 1000,
		});
		const range2Wall = await shard.placeStructure('W1N1', {
			pos: [12, 12], structureType: STRUCTURE_WALL, owner: 'p1', hits: 1000,
		});

		const result = await shard.runPlayer('p1', code`({
			rangeOne: Game.getObjectById(${nearCreep}).dismantle(Game.getObjectById(${adjacentWall})),
			rangeTwo: Game.getObjectById(${farCreep}).dismantle(Game.getObjectById(${range2Wall})),
		})`) as { rangeOne: number; rangeTwo: number };
		expect(result.rangeOne).toBe(OK);
		expect(result.rangeTwo).toBe(ERR_NOT_IN_RANGE);
	});

	test('DISMANTLE-007 structure is destroyed when dismantling reduces hits to 0', async ({ shard }) => {
		// Engine dismantle.js:52 → _damage.js:46-52 — when target.hits reaches 0,
		// the structure processor runs _destroy. A wall at DISMANTLE_POWER hits is
		// removed by a single-WORK creep in one tick.
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, MOVE],
		});
		const wallId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_WALL,
			owner: 'p1', hits: DISMANTLE_POWER,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).dismantle(Game.getObjectById(${wallId}))
		`);
		expect(rc).toBe(OK);

		const wall = await shard.getObject(wallId);
		expect(wall).toBeNull();
	});

	test('DISMANTLE-008 overflow energy from dismantle is dropped at the creep\'s tile', async ({ shard }) => {
		// Engine dismantle.js:47-50 — if gained energy makes usedSpace exceed
		// storeCapacity, the overflow is dropped via _create-energy at the creep's
		// tile. 45 WORK + 5 CARRY: storeCapacity 250, pre-loaded 245. Wall at
		// 5000 hits → amount = 2250, energyGain = floor(2250 × 0.005) = 11.
		// Store fills to 256, overflow 6 drops; in-tick decay reduces pile by 1.
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: body(45, WORK, 5, CARRY),
			store: { energy: 245 },
		});
		const wallId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_WALL,
			owner: 'p1', hits: 5000,
		});

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).dismantle(Game.getObjectById(${wallId}))
		`);

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy).toBe(250); // filled to exactly storeCapacity

		const damage = 45 * DISMANTLE_POWER;
		const gained = Math.floor(damage * DISMANTLE_COST);
		const overflow = 245 + gained - 250;
		const drops = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		const pile = drops.find(r => r.pos.x === 25 && r.pos.y === 25);
		expect(pile).toBeDefined();
		expect(pile!.resourceType).toBe(RESOURCE_ENERGY);
		expect(pile!.amount).toBe(overflow - Math.ceil(overflow / ENERGY_DECAY));

		const wall = await shard.expectObject(wallId, 'structure');
		expect(wall.hits).toBe(5000 - damage);
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
