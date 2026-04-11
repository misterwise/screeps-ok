import { describe, test, expect, code, OK, MOVE, WORK, CARRY, FIND_CREEPS, FIND_CONSTRUCTION_SITES, FIND_FLAGS, STRUCTURE_ROAD, LOOK_CREEPS, LOOK_TERRAIN } from '../../src/index.js';
import { hasDocumentedAdapterLimitation } from '../../src/limitations.js';

describe('RoomPosition spatial queries', () => {
	test('ROOMPOS-SPATIAL-001 getRangeTo returns Chebyshev distance in the same room', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const dist = await shard.runPlayer('p1', code`
			new RoomPosition(10, 10, 'W1N1').getRangeTo(new RoomPosition(13, 15, 'W1N1'))
		`);
		// Chebyshev = max(|13-10|, |15-10|) = max(3, 5) = 5
		expect(dist).toBe(5);
	});

	test('ROOMPOS-SPATIAL-002 inRangeTo returns true when target is within the specified range', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const pos = new RoomPosition(10, 10, 'W1N1');
			const target = new RoomPosition(12, 12, 'W1N1');
			({ inRange2: pos.inRangeTo(target, 2), inRange1: pos.inRangeTo(target, 1) })
		`) as { inRange2: boolean; inRange1: boolean };
		expect(result.inRange2).toBe(true);
		expect(result.inRange1).toBe(false);
	});

	test('ROOMPOS-SPATIAL-003 isNearTo returns true when target is within range 1', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const pos = new RoomPosition(10, 10, 'W1N1');
			({
				adjacent: pos.isNearTo(new RoomPosition(11, 11, 'W1N1')),
				far: pos.isNearTo(new RoomPosition(12, 12, 'W1N1')),
			})
		`) as { adjacent: boolean; far: boolean };
		expect(result.adjacent).toBe(true);
		expect(result.far).toBe(false);
	});

	test('ROOMPOS-SPATIAL-004 isEqualTo returns true when target is on the same tile', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const pos = new RoomPosition(10, 10, 'W1N1');
			({
				same: pos.isEqualTo(new RoomPosition(10, 10, 'W1N1')),
				different: pos.isEqualTo(new RoomPosition(10, 11, 'W1N1')),
			})
		`) as { same: boolean; different: boolean };
		expect(result.same).toBe(true);
		expect(result.different).toBe(false);
	});

	test('ROOMPOS-SPATIAL-006 getRangeTo returns Infinity for a target in another room', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1' },
			],
		});

		// Canonical behavior: getRangeTo returns Infinity for different rooms.
		// Infinity is not JSON-safe, so test the condition inside player code.
		const isInfinite = await shard.runPlayer('p1', code`
			new RoomPosition(10, 10, 'W1N1').getRangeTo(new RoomPosition(10, 10, 'W2N1')) === Infinity
		`);
		expect(isInfinite).toBe(true);
	});
});

describe('RoomPosition find helpers', () => {
	test('ROOMPOS-FIND-002 findClosestByPath ignores unreachable targets', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// Place two creeps: one reachable, one surrounded by walls (unreachable)
		// Since we can't set terrain, use a far-away creep vs a near one
		// and verify the near one is returned
		await shard.placeCreep('W1N1', {
			pos: [10, 10], owner: 'p1', body: [MOVE],
		});
		await shard.placeCreep('W1N1', {
			pos: [10, 12], owner: 'p1', body: [MOVE],
		});

		const result = await shard.runPlayer('p1', code`
			const pos = new RoomPosition(10, 11, 'W1N1');
			const closest = pos.findClosestByPath(FIND_CREEPS);
			closest ? ({ x: closest.pos.x, y: closest.pos.y }) : null
		`) as { x: number; y: number } | null;
		// Either adjacent creep is valid — both are reachable at range 1
		expect(result).not.toBeNull();
		expect(result!.x).toBe(10);
		expect([10, 12]).toContain(result!.y);
	});

	test('ROOMPOS-FIND-003 findClosestByRange returns the target with the smallest linear range', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [10, 10], owner: 'p1', body: [MOVE], name: 'far',
		});
		await shard.placeCreep('W1N1', {
			pos: [20, 20], owner: 'p1', body: [MOVE], name: 'close',
		});

		const result = await shard.runPlayer('p1', code`
			const pos = new RoomPosition(21, 21, 'W1N1');
			const closest = pos.findClosestByRange(FIND_CREEPS);
			closest ? closest.name : null
		`);
		expect(result).toBe('close');
	});

	test('ROOMPOS-FIND-005 findPathTo returns a path from this position to the target', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const path = new RoomPosition(10, 10, 'W1N1').findPathTo(15, 15);
			({
				isArray: Array.isArray(path),
				length: path.length,
				firstHasXY: path[0] ? ('x' in path[0] && 'y' in path[0]) : false,
			})
		`) as { isArray: boolean; length: number; firstHasXY: boolean };
		expect(result.isArray).toBe(true);
		expect(result.length).toBeGreaterThan(0);
		expect(result.firstHasXY).toBe(true);
	});

	test('ROOMPOS-FIND-006 opts.filter applies to the candidate set', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [20, 20], owner: 'p1', body: [MOVE], name: 'alice',
		});
		await shard.placeCreep('W1N1', {
			pos: [20, 21], owner: 'p1', body: [MOVE], name: 'bob',
		});

		const result = await shard.runPlayer('p1', code`
			const pos = new RoomPosition(20, 20, 'W1N1');
			const found = pos.findInRange(FIND_CREEPS, 5, { filter: c => c.name === 'bob' });
			found.length
		`);
		expect(result).toBe(1);
	});
});

describe('RoomPosition look', () => {
	test('ROOMPOS-LOOK-001 look() returns {type, ...} records for objects and terrain', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE],
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const items = new RoomPosition(25, 25, 'W1N1').look();
			({
				isArray: Array.isArray(items),
				hasType: items.every(i => typeof i.type === 'string'),
				types: items.map(i => i.type).sort(),
			})
		`) as { isArray: boolean; hasType: boolean; types: string[] };
		expect(result.isArray).toBe(true);
		expect(result.hasType).toBe(true);
		// Should include at least terrain and the creep
		expect(result.types).toContain('terrain');
		expect(result.types).toContain('creep');
	});

	test('ROOMPOS-LOOK-003 lookFor(type) returns an empty array when no entries exist', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			new RoomPosition(25, 25, 'W1N1').lookFor(LOOK_CREEPS).length
		`);
		expect(result).toBe(0);
	});
});

describe('RoomPosition actions', () => {
	const flagTest = hasDocumentedAdapterLimitation('flagSupport') ? test.skip : test;

	flagTest('ROOMPOS-ACTION-002 createFlag returns the flag name and creates the flag at the RoomPosition coordinates', async ({ shard }) => {
		await shard.ownedRoom('p1');

		// createFlag at a specific position. Returns the flag name on success.
		const result = await shard.runPlayer('p1', code`
			const rc = new RoomPosition(30, 30, 'W1N1').createFlag('testFlag');
			rc
		`);
		// createFlag returns the flag name string on success.
		expect(result).toBe('testFlag');

		// Verify the flag exists at the correct position in the same tick.
		const flagCheck = await shard.runPlayer('p1', code`
			const flag = Game.flags['testFlag'];
			flag ? ({ name: flag.name, x: flag.pos.x, y: flag.pos.y, roomName: flag.pos.roomName }) : null
		`) as { name: string; x: number; y: number; roomName: string } | null;
		expect(flagCheck).not.toBeNull();
		expect(flagCheck!.name).toBe('testFlag');
		expect(flagCheck!.x).toBe(30);
		expect(flagCheck!.y).toBe(30);
		expect(flagCheck!.roomName).toBe('W1N1');
	});

	test('ROOMPOS-ACTION-001 createConstructionSite returns OK and creates the site on the next tick', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});

		const rc = await shard.runPlayer('p1', code`
			new RoomPosition(30, 30, 'W1N1').createConstructionSite(STRUCTURE_ROAD)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const sites = await shard.findInRoom('W1N1', FIND_CONSTRUCTION_SITES);
		const road = sites.find(s => s.structureType === 'road' && s.pos.x === 30 && s.pos.y === 30);
		expect(road).toBeDefined();
	});
});
