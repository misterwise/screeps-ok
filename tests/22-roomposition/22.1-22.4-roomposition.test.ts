import { describe, test, expect, code, OK, MOVE, WORK, CARRY, FIND_CREEPS, FIND_CONSTRUCTION_SITES, FIND_FLAGS, STRUCTURE_ROAD, STRUCTURE_SPAWN, LOOK_CREEPS, LOOK_TERRAIN } from '../../src/index.js';
import { body } from '../../src/helpers/body.js';

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
		await shard.placeCreep('W1N1', {
			pos: [20, 10], owner: 'p1', body: [MOVE], name: 'blocked',
		});
		await shard.placeCreep('W1N1', {
			pos: [35, 10], owner: 'p1', body: [MOVE], name: 'reachable',
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const pos = new RoomPosition(10, 10, 'W1N1');
			const closest = pos.findClosestByPath(FIND_CREEPS, {
				costCallback(roomName, matrix) {
					matrix = matrix || new PathFinder.CostMatrix();
					for (let x = 19; x <= 21; x++) {
						for (let y = 9; y <= 11; y++) {
							matrix.set(x, y, 255);
						}
					}
					return matrix;
				},
			});
			closest ? closest.name : null
		`);
		expect(result).toBe('reachable');
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

	test('ROOMPOS-FIND-007 findClosestByPath returns null when no reachable target exists', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [20, 20], owner: 'p1', body: [MOVE], name: 'blocked',
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const pos = new RoomPosition(10, 10, 'W1N1');
			pos.findClosestByPath(FIND_CREEPS, {
				costCallback(roomName, matrix) {
					matrix = matrix || new PathFinder.CostMatrix();
					for (let x = 19; x <= 21; x++) {
						for (let y = 19; y <= 21; y++) {
							matrix.set(x, y, 255);
						}
					}
					return matrix;
				},
			})
		`);
		expect(result).toBeNull();
	});

	test('ROOMPOS-FIND-009 findClosestByPath honors costCallback when it walls off the cheapest route', async ({ shard }) => {
		await shard.ownedRoom('p1');

		// target1 is 3 tiles north, target2 is 5 tiles south. costCallback
		// walls row y=4 across the room interior, sealing off target1. With
		// costCallback honored, only target2 remains reachable; ignoring it
		// would let the closer target1 win.
		const result = await shard.runPlayer('p1', code`
			const origin = new RoomPosition(5, 5, 'W1N1');
			const target1 = new RoomPosition(5, 2, 'W1N1');
			const target2 = new RoomPosition(5, 10, 'W1N1');
			const closest = origin.findClosestByPath([target1, target2], {
				costCallback(roomName, matrix) {
					matrix = matrix || new PathFinder.CostMatrix();
					for (let x = 2; x <= 47; x++) {
						matrix.set(x, 4, 255);
					}
					return matrix;
				},
			});
			closest ? { x: closest.x, y: closest.y, roomName: closest.roomName } : null
		`) as { x: number; y: number; roomName: string } | null;

		expect(result).toEqual({ x: 5, y: 10, roomName: 'W1N1' });
	});

	test('ROOMPOS-FIND-011 findPathTo passes opts through cross-room exit selection so the path does not dead-end at a wall', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p1' },
				{ name: 'W1N0', rcl: 1, owner: 'p1' },
				{ name: 'W2N0', rcl: 1, owner: 'p1' },
			],
		});

		// Origin is in W1N1 mid-room. Target is in W2N1 mid-room. costCallback
		// walls off the east strip of W1N1 (cols 45..49) so the natural east
		// exit is unreachable. A complete path must instead route up to W1N0,
		// across to W2N0, and down to W2N1 — only possible if findExitTo
		// receives the same opts as the path-computation step.
		const result = await shard.runPlayer('p1', code`
			const origin = new RoomPosition(25, 25, 'W1N1');
			const target = new RoomPosition(25, 25, 'W2N1');
			const path = origin.findPathTo(target, {
				maxOps: 20000,
				costCallback(roomName, matrix) {
					matrix = matrix || new PathFinder.CostMatrix();
					if (roomName === 'W1N1') {
						for (let x = 45; x <= 49; x++) {
							for (let y = 0; y <= 49; y++) {
								matrix.set(x, y, 255);
							}
						}
					}
					return matrix;
				},
			});
			const last = path.length ? path[path.length - 1] : null;
			({
				length: path.length,
				lastX: last ? last.x : null,
				lastY: last ? last.y : null,
			})
		`) as { length: number; lastX: number | null; lastY: number | null };

		// A complete path that follows opts ends on a boundary tile of W1N1
		// (the alternate exit). A path that dead-ends at the cost-matrix wall
		// stops at x=44 with no boundary tile in sight.
		expect(result.length).toBeGreaterThan(0);
		const onBoundary = (
			result.lastX === 0 || result.lastX === 49
			|| result.lastY === 0 || result.lastY === 49
		);
		expect(onBoundary).toBe(true);
	});

	test('ROOMPOS-FIND-010 findClosestByPath range option uses goal range', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const origin = new RoomPosition(10, 10, 'W1N1');
			const target = new RoomPosition(30, 10, 'W1N1');
			const closest = origin.findClosestByPath([target], {
				range: 5,
				costCallback(roomName, matrix) {
					matrix = matrix || new PathFinder.CostMatrix();
					for (let x = 26; x <= 34; x++) {
						for (let y = 6; y <= 14; y++) {
							matrix.set(x, y, 255);
						}
					}
					return matrix;
				},
			});
			closest ? { x: closest.x, y: closest.y, roomName: closest.roomName } : null
		`) as { x: number; y: number; roomName: string } | null;

		expect(result).toEqual({ x: 30, y: 10, roomName: 'W1N1' });
	});

	test('ROOMPOS-FIND-008 findClosestByRange returns null when the candidate set is empty', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const pos = new RoomPosition(25, 25, 'W1N1');
			pos.findClosestByRange(FIND_CREEPS)
		`);
		expect(result).toBeNull();
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
	test('ROOMPOS-ACTION-002 createFlag returns the flag name and creates the flag at the RoomPosition coordinates', async ({ shard }) => {
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
		const road = sites.find(s => s.structureType === STRUCTURE_ROAD && s.pos.x === 30 && s.pos.y === 30);
		expect(road).toBeDefined();
	});

	test('ROOMPOS-ACTION-003 createConstructionSite passes name through to the site and the completed structure', async ({ shard }) => {
		// Engine @screeps/engine/src/game/rooms.js — pos.createConstructionSite is
		// a thin wrapper that forwards (structureType, name) to Room.createConstructionSite.
		// For STRUCTURE_SPAWN the engine stores the name on the site and on the
		// resulting structure when the build completes (build.js:121).
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});

		const rc = await shard.runPlayer('p1', code`
			new RoomPosition(30, 30, 'W1N1').createConstructionSite(STRUCTURE_SPAWN, 'TestSpawn')
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		// SiteSnapshot does not expose `name`; query via runPlayer.
		const siteName = await shard.runPlayer('p1', code`
			const site = Game.rooms['W1N1'].find(FIND_CONSTRUCTION_SITES)
				.find(s => s.structureType === STRUCTURE_SPAWN);
			site ? site.name : null
		`);
		expect(siteName).toBe('TestSpawn');

		// Verify the name passes through to the structure on completion. Reload
		// the test world with a near-complete site (placed via fixture spec) so
		// one tick of build finishes it and we observe the resulting spawn.
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const siteId = await shard.placeSite('W1N1', {
			pos: [25, 25], owner: 'p1',
			structureType: STRUCTURE_SPAWN,
			progress: 14995,
			name: 'TestSpawn',
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: body(2, WORK, CARRY, MOVE),
			store: { energy: 50 },
		});

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).build(Game.getObjectById(${siteId}))
		`);
		await shard.tick();

		const completedSpawnName = await shard.runPlayer('p1', code`
			const spawn = Game.rooms['W1N1'].lookForAt(LOOK_STRUCTURES, 25, 25)
				.find(s => s.structureType === STRUCTURE_SPAWN);
			spawn ? spawn.name : null
		`);
		expect(completedSpawnName).toBe('TestSpawn');
	});
});
