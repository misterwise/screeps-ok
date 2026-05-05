import { describe, test, expect, code, body,
	OK, ERR_FULL, ERR_RCL_NOT_ENOUGH, ERR_INVALID_TARGET, ERR_INVALID_ARGS, ERR_NOT_OWNER,
	WORK, CARRY, MOVE, CLAIM,
	FIND_CONSTRUCTION_SITES, FIND_STRUCTURES,
	STRUCTURE_ROAD, STRUCTURE_TOWER, STRUCTURE_EXTENSION, STRUCTURE_SPAWN,
	STRUCTURE_CONTAINER, STRUCTURE_WALL, TERRAIN_WALL,
	MAX_CONSTRUCTION_SITES,
} from '../../src/index.js';
import { constructionSiteCreateValidationCases } from '../../src/matrices/construction-site-create-validation.js';
import { constructionSiteOverRuinCases } from '../../src/matrices/construction-site-over-ruin.js';

describe('room.createConstructionSite()', () => {
	test('CONSTRUCTION-SITE-001 creates a construction site via player code', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].createConstructionSite(30, 30, STRUCTURE_ROAD)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const sites = await shard.findInRoom('W1N1', FIND_CONSTRUCTION_SITES);
		const road = sites.find(s => s.structureType === STRUCTURE_ROAD && s.pos.x === 30 && s.pos.y === 30);
		expect(road).toBeDefined();
	});

	test('BUILD-004 construction site is removed when build progress reaches progressTotal', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [30, 30], owner: 'p1',
			body: body(5, WORK, 5, CARRY, MOVE),
			store: { energy: 250 },
		});
		const siteId = await shard.placeSite('W1N1', {
			pos: [30, 31], owner: 'p1',
			structureType: STRUCTURE_ROAD,
			progress: 275, // almost done, need 25 more
		});

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).build(Game.getObjectById(${siteId}))
		`);
		await shard.tick();

		const site = await shard.getObject(siteId);
		expect(site).toBeNull();
	});

	test('BUILD-004 completed construction site is replaced by the built structure on the same tile', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [30, 30], owner: 'p1',
			body: body(5, WORK, 5, CARRY, MOVE),
			store: { energy: 250 },
		});
		const siteId = await shard.placeSite('W1N1', {
			pos: [30, 31], owner: 'p1',
			structureType: STRUCTURE_ROAD,
			progress: 275,
		});

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).build(Game.getObjectById(${siteId}))
		`);
		await shard.tick();

		const structures = await shard.findInRoom('W1N1', FIND_STRUCTURES);
		const road = structures.find(s =>
			s.structureType === STRUCTURE_ROAD &&
			s.pos.x === 30 && s.pos.y === 31);
		expect(road).toBeDefined();
	});

	test('CONSTRUCTION-SITE-002 createConstructionSite returns ERR_FULL after MAX_CONSTRUCTION_SITES', async ({ shard }) => {
		// Engine rooms.js:1062 — owner site count + createdConstructionSites
		// >= MAX_CONSTRUCTION_SITES → ERR_FULL. Pre-place 100 sites then
		// attempt one more from player code.
		await shard.ownedRoom('p1');
		// 100 unique tiles in a 10x10 grid (10..19, 10..19).
		for (let i = 0; i < MAX_CONSTRUCTION_SITES; i++) {
			const x = 10 + (i % 10);
			const y = 10 + Math.floor(i / 10);
			await shard.placeSite('W1N1', {
				pos: [x, y], owner: 'p1', structureType: STRUCTURE_ROAD,
			});
		}

		const rc = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].createConstructionSite(30, 30, STRUCTURE_ROAD)
		`);
		expect(rc).toBe(ERR_FULL);
	});

	test('CONSTRUCTION-SITE-003 createConstructionSite returns ERR_RCL_NOT_ENOUGH for a structure unavailable at the room\'s RCL', async ({ shard }) => {
		// Engine rooms.js:1055 — checkControllerAvailability returns false
		// when CONTROLLER_STRUCTURES[type][rcl] is 0. RCL 1 → 0 towers.
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].createConstructionSite(25, 25, STRUCTURE_TOWER)
		`);
		expect(rc).toBe(ERR_RCL_NOT_ENOUGH);
	});

	test('CONSTRUCTION-SITE-004 a hostile creep moving onto a construction site destroys it', async ({ shard }) => {
		// Engine movement.js:225-231 — when a creep moves to a tile, any
		// constructionSite owned by another player is removed (and ~half the
		// progress is converted to dropped energy).
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 2, owner: 'p1' },
				{ name: 'W2N1', rcl: 2, owner: 'p2' },
			],
		});
		const siteId = await shard.placeSite('W1N1', {
			pos: [25, 26], owner: 'p1', structureType: STRUCTURE_ROAD,
		});
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p2',
			body: [MOVE], name: 'walker',
		});
		await shard.tick();

		// p2's creep moves onto the site at (25, 26).
		const moveRc = await shard.runPlayer('p2', code`
			Game.creeps['walker'].move(BOTTOM)
		`);
		expect(moveRc).toBe(OK);

		const site = await shard.getObject(siteId);
		expect(site).toBeNull();
	});

	test('CONSTRUCTION-SITE-005 a site placed under an already-standing hostile creep survives the next tick', async ({ shard }) => {
		// Engine movement.js destroys hostile sites only when a creep MOVES
		// onto the tile — a creep that is already there at site creation does
		// not trigger that path. checkConstructionSite ignores creeps, so the
		// placement is also legal.
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 2, owner: 'p1' },
				{ name: 'W2N1', rcl: 2, owner: 'p2' },
			],
		});
		// p2's creep stands at (25, 26) and never issues a move intent.
		await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: [MOVE], name: 'sitter',
		});

		const rc = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].createConstructionSite(25, 26, STRUCTURE_ROAD)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const sites = await shard.findInRoom('W1N1', FIND_CONSTRUCTION_SITES);
		const survivor = sites.find(s => s.pos.x === 25 && s.pos.y === 26);
		expect(survivor).toBeDefined();
		expect(survivor!.structureType).toBe(STRUCTURE_ROAD);
	});

	test('CONSTRUCTION-SITE-006 ConstructionSite.remove() deletes the site for the owner', async ({ shard }) => {
		// Engine remove-construction-site.js: site owned by user → bulk.remove.
		await shard.ownedRoom('p1');
		const siteId = await shard.placeSite('W1N1', {
			pos: [25, 25], owner: 'p1', structureType: STRUCTURE_ROAD,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${siteId}).remove()
		`);
		expect(rc).toBe(OK);

		const site = await shard.getObject(siteId);
		expect(site).toBeNull();
	});

	test('CONSTRUCTION-SITE-007 only one construction site can exist at a given position', async ({ shard }) => {
		// Engine utils.js:171 — checkConstructionSite returns false if any
		// existing constructionSite occupies the tile. Player-side check
		// surfaces ERR_INVALID_TARGET.
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		await shard.placeSite('W1N1', {
			pos: [25, 25], owner: 'p1', structureType: STRUCTURE_ROAD,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].createConstructionSite(25, 25, STRUCTURE_EXTENSION)
		`);
		expect(rc).toBe(ERR_INVALID_TARGET);
	});

	test('CONSTRUCTION-SITE-008 cannot place a non-road site on a wall terrain tile', async ({ shard }) => {
		// Engine utils.js:145-148 / 162-165 — checkConstructionSite returns
		// false if the tile is a wall, except for roads. Place a road on a
		// wall tile (allowed) and a non-road on the same tile (rejected).
		shard.requires('terrain', 'custom terrain required for wall placement check');
		const wx = 20, wy = 20;
		const terrain = new Array<0 | 1 | 2>(2500).fill(0);
		terrain[wy * 50 + wx] = TERRAIN_WALL;
		await shard.createShard({
			players: ['p1'],
			rooms: [{
				name: 'W1N1',
				rcl: 2,
				owner: 'p1',
				terrain,
			}],
		});

		const result = await shard.runPlayer('p1', code`({
			road: Game.rooms['W1N1'].createConstructionSite(${wx}, ${wy}, STRUCTURE_ROAD),
			extension: Game.rooms['W1N1'].createConstructionSite(${wx}, ${wy}, STRUCTURE_EXTENSION),
		})`) as { road: number; extension: number };
		expect(result.road).toBe(OK);
		expect(result.extension).toBe(ERR_INVALID_TARGET);
	});

	for (const { label, ruinType, placedType } of constructionSiteOverRuinCases) {
		test(`CONSTRUCTION-SITE-009 [${label}] a ruin does not block placing a construction site on its tile`, async ({ shard }) => {
			// Engine utils.js:172-184 — checkConstructionSite filters on
			// same-type structures and existing constructionSites but never on
			// ruins. The matrix asserts the ruin alone never contributes to
			// placement rejection, regardless of (ruinType, placedType).
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
			});
			await shard.placeRuin('W1N1', {
				pos: [25, 25],
				structureType: ruinType,
				ticksToDecay: 500,
			});
			await shard.tick();

			const rc = await shard.runPlayer('p1', code`
				Game.rooms['W1N1'].createConstructionSite(25, 25, ${placedType})
			`);
			expect(rc).toBe(OK);
			await shard.tick();

			const sites = await shard.findInRoom('W1N1', FIND_CONSTRUCTION_SITES);
			const site = sites.find(s => s.pos.x === 25 && s.pos.y === 25);
			expect(site).toBeDefined();
			expect(site!.structureType).toBe(placedType);
		});
	}

	test('CONSTRUCTION-SITE-010 createConstructionSite returns ERR_INVALID_ARGS for an unknown structure type', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});
		const invalidStructureType = STRUCTURE_ROAD.toUpperCase();

		const result = await shard.runPlayer('p1', code`({
			room: Game.rooms['W1N1'].createConstructionSite(25, 25, ${invalidStructureType}),
			roomPosition: new RoomPosition(26, 25, 'W1N1').createConstructionSite(${invalidStructureType}),
		})`) as { room: number; roomPosition: number };
		expect(result).toEqual({
			room: ERR_INVALID_ARGS,
			roomPosition: ERR_INVALID_ARGS,
		});
	});

	test('CONSTRUCTION-SITE-012 unowned room allows road and container, blocks other types with ERR_RCL_NOT_ENOUGH', async ({ shard }) => {
		// Engine utils.checkControllerAvailability (utils.js:338-353):
		// rcl resolves to 0 when controller has no user/owner. At rcl 0,
		// CONTROLLER_STRUCTURES.road = 2500 and .container = 5; every other
		// type is undefined or 0 → ERR_RCL_NOT_ENOUGH.
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1' },
			],
		});
		// A creep in W2N1 grants p1 vision so Game.rooms['W2N1'] is populated.
		await shard.placeCreep('W2N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE],
		});

		const result = await shard.runPlayer('p1', code`({
			road: Game.rooms['W2N1'].createConstructionSite(30, 30, STRUCTURE_ROAD),
			container: Game.rooms['W2N1'].createConstructionSite(31, 30, STRUCTURE_CONTAINER),
			wall: Game.rooms['W2N1'].createConstructionSite(32, 30, STRUCTURE_WALL),
			extension: Game.rooms['W2N1'].createConstructionSite(33, 30, STRUCTURE_EXTENSION),
			tower: Game.rooms['W2N1'].createConstructionSite(34, 30, STRUCTURE_TOWER),
			spawn: Game.rooms['W2N1'].createConstructionSite(35, 30, STRUCTURE_SPAWN),
		})`) as Record<string, number>;
		expect(result).toEqual({
			road: OK,
			container: OK,
			wall: ERR_RCL_NOT_ENOUGH,
			extension: ERR_RCL_NOT_ENOUGH,
			tower: ERR_RCL_NOT_ENOUGH,
			spawn: ERR_RCL_NOT_ENOUGH,
		});
	});

	test('CONSTRUCTION-SITE-013 a controller reserved by the caller behaves as rcl 0 — road and container only', async ({ shard }) => {
		// Engine rooms.js:1055-1061 only triggers ERR_NOT_OWNER for hostile
		// reservations. Self-reservations fall through to
		// checkControllerAvailability, which only credits a controller's
		// level when it has user/owner (utils.js:341), not a reservation.
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1' },
			],
		});
		const ctrlPos = await shard.getControllerPos('W2N1');
		await shard.placeCreep('W2N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: [CLAIM, CLAIM, MOVE],
			name: 'reserver',
		});
		await shard.tick();
		const reserveRc = await shard.runPlayer('p1', code`
			Game.creeps['reserver'].reserveController(Game.rooms['W2N1'].controller)
		`);
		expect(reserveRc).toBe(OK);
		await shard.tick();

		// Pre-touch the controller proxy before the placement calls — vanilla
		// lazily materializes controller.reservation on first proxy access
		// in a tick, and without the warm-up the first createConstructionSite
		// in the snippet can slip past the reservation gate.
		const result = await shard.runPlayer('p1', code`
			void Game.rooms['W2N1'].controller.reservation;
			({
				road: Game.rooms['W2N1'].createConstructionSite(30, 30, STRUCTURE_ROAD),
				container: Game.rooms['W2N1'].createConstructionSite(31, 30, STRUCTURE_CONTAINER),
				wall: Game.rooms['W2N1'].createConstructionSite(32, 30, STRUCTURE_WALL),
				tower: Game.rooms['W2N1'].createConstructionSite(34, 30, STRUCTURE_TOWER),
				spawn: Game.rooms['W2N1'].createConstructionSite(35, 30, STRUCTURE_SPAWN),
			})
		`) as Record<string, number>;
		expect(result).toEqual({
			road: OK,
			container: OK,
			wall: ERR_RCL_NOT_ENOUGH,
			tower: ERR_RCL_NOT_ENOUGH,
			spawn: ERR_RCL_NOT_ENOUGH,
		});
	});

	test('CONSTRUCTION-SITE-014 a controller reserved by another player returns ERR_NOT_OWNER for every type', async ({ shard }) => {
		// Engine rooms.js:1055-1061 returns ERR_NOT_OWNER when
		// controller.reservation.user differs from the caller's user, before
		// the rcl check runs. Even road/container — which would be allowed
		// in a fully unowned room — are rejected.
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
				{ name: 'W3N1' },
			],
		});
		const ctrlPos = await shard.getControllerPos('W3N1');
		await shard.placeCreep('W3N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p2',
			body: [CLAIM, CLAIM, MOVE],
			name: 'p2reserver',
		});
		await shard.placeCreep('W3N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE],
		});
		await shard.tick();
		const reserveRc = await shard.runPlayer('p2', code`
			Game.creeps['p2reserver'].reserveController(Game.rooms['W3N1'].controller)
		`);
		expect(reserveRc).toBe(OK);
		await shard.tick();

		// See CONSTRUCTION-SITE-013 for the pre-touch rationale.
		const result = await shard.runPlayer('p1', code`
			void Game.rooms['W3N1'].controller.reservation;
			({
				road: Game.rooms['W3N1'].createConstructionSite(20, 20, STRUCTURE_ROAD),
				container: Game.rooms['W3N1'].createConstructionSite(21, 20, STRUCTURE_CONTAINER),
				wall: Game.rooms['W3N1'].createConstructionSite(22, 20, STRUCTURE_WALL),
				tower: Game.rooms['W3N1'].createConstructionSite(24, 20, STRUCTURE_TOWER),
				spawn: Game.rooms['W3N1'].createConstructionSite(25, 20, STRUCTURE_SPAWN),
			})
		`) as Record<string, number>;
		expect(result).toEqual({
			road: ERR_NOT_OWNER,
			container: ERR_NOT_OWNER,
			wall: ERR_NOT_OWNER,
			tower: ERR_NOT_OWNER,
			spawn: ERR_NOT_OWNER,
		});
	});

	for (const row of constructionSiteCreateValidationCases) {
		test(`CONSTRUCTION-SITE-011:${row.label} createConstructionSite() validation returns the canonical code`, async ({ shard }) => {
			const blockers = new Set(row.blockers);
			const owner = blockers.has('not-owner') ? 'p2' : 'p1';
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [{ name: 'W1N1', rcl: blockers.has('rcl-or-structure-cap') ? 1 : 8, owner }],
			});
			if (owner === 'p2') {
				await shard.placeCreep('W1N1', { pos: [20, 20], owner: 'p1', body: [MOVE] });
			}
			if (blockers.has('site-cap-full')) {
				for (let i = 0; i < MAX_CONSTRUCTION_SITES; i++) {
					await shard.placeSite('W1N1', {
						pos: [10 + (i % 10), 10 + Math.floor(i / 10)],
						owner: 'p1',
						structureType: STRUCTURE_ROAD,
					});
				}
			}
			if (blockers.has('invalid-target')) {
				await shard.placeSite('W1N1', {
					pos: [25, 25],
					owner: 'p1',
					structureType: STRUCTURE_ROAD,
				});
			}
			if (blockers.has('invalid-args') && blockers.has('rcl-or-structure-cap')) {
				await shard.placeStructure('W1N1', {
					pos: [24, 25],
					structureType: STRUCTURE_SPAWN,
					owner,
				});
			}
			const structureType = blockers.has('invalid-args')
				? STRUCTURE_SPAWN
				: blockers.has('rcl-or-structure-cap')
					? STRUCTURE_TOWER
					: STRUCTURE_ROAD;
			const name = blockers.has('invalid-args') ? 'x'.repeat(101) : undefined;

			const rc = await shard.runPlayer('p1', code`
				Game.rooms['W1N1'].createConstructionSite(25, 25, ${structureType}, ${name})
			`);
			expect(rc).toBe(row.expectedRc);
		});
	}
});
