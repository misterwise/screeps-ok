import { describe, test, expect, code, body,
	OK, ERR_RCL_NOT_ENOUGH, ERR_INVALID_ARGS, ERR_NOT_OWNER,
	WORK, CARRY, MOVE, CLAIM,
	FIND_CONSTRUCTION_SITES, FIND_STRUCTURES, FIND_MY_CONSTRUCTION_SITES,
	FIND_MY_STRUCTURES, FIND_MY_SPAWNS, LOOK_STRUCTURES,
	STRUCTURE_ROAD, STRUCTURE_TOWER, STRUCTURE_EXTENSION, STRUCTURE_SPAWN,
	STRUCTURE_CONTAINER, STRUCTURE_WALL, TERRAIN_WALL,
	MAX_CONSTRUCTION_SITES, CONSTRUCTION_COST, BUILD_POWER,
} from '../../src/index.js';
import { constructionSiteCreateValidationCases } from '../../src/matrices/construction-site-create-validation.js';
import { constructionSiteOverRuinCases } from '../../src/matrices/construction-site-over-ruin.js';
import { constructionSiteOverStructureCases } from '../../src/matrices/construction-site-over-structure.js';
import { staleReceiverCases } from '../../src/matrices/stale-receiver.js';
import { reserveRoom } from '../intent-validation-helpers.js';

const STRUCTURE_TYPES_UNOWNED = new Set<string>([STRUCTURE_ROAD, STRUCTURE_CONTAINER]);

const staleConstructionSiteRemoveCase = staleReceiverCases.find(row => row.key === 'constructionSiteRemove')!;

// Every type in CONSTRUCTION_COST, one per tile along y = 30; at rcl 0 only roads and containers are allowed.
const placeEveryType = Object.keys(CONSTRUCTION_COST).map((type, i) => [type, 10 + i]);
const rclZeroResults = Object.keys(CONSTRUCTION_COST)
	.map(type => [type, type === STRUCTURE_ROAD || type === STRUCTURE_CONTAINER ? OK : ERR_RCL_NOT_ENOUGH]);

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

	test('BUILD-004 a site that reaches progressTotal becomes its structure on the same tile', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [30, 30], owner: 'p1',
			body: body(5, WORK, 5, CARRY, MOVE),
			store: { energy: 250 },
		});
		// One build of five WORK parts short of done.
		const siteId = await shard.placeSite('W1N1', {
			pos: [30, 31], owner: 'p1',
			structureType: STRUCTURE_ROAD,
			progress: CONSTRUCTION_COST[STRUCTURE_ROAD] - 5 * BUILD_POWER,
		});

		expect(await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).build(Game.getObjectById(${siteId}))
		`)).toBe(OK);

		expect(await shard.getObject(siteId)).toBeNull();
		const structures = await shard.findInRoom('W1N1', FIND_STRUCTURES);
		expect(structures.filter(s => s.pos.x === 30 && s.pos.y === 31).map(s => s.kind === 'structure' && s.structureType))
			.toEqual([STRUCTURE_ROAD]);
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

	test(`${staleConstructionSiteRemoveCase.catalogId}:${staleConstructionSiteRemoveCase.label} stale cached ConstructionSite.remove() throws a runtime error`, async ({ shard }) => {
		await shard.ownedRoom('p1');
		const siteId = await shard.placeSite('W1N1', {
			pos: [25, 25], owner: 'p1', structureType: STRUCTURE_ROAD,
		});

		const rc = await shard.runPlayer('p1', code`
			const site = Game.getObjectById(${siteId});
			globalThis.__screepsOkStaleConstructionSite = site;
			site.remove()
		`);
		expect(rc).toBe(OK);
		const site = await shard.getObject(siteId);
		expect(site).toBeNull();

		// Matrix asserts that stale receiver access is *blocked* by a runtime
		// error. Vanilla blocks via missing-id; xxscreeps would block via its
		// released-object check. xxscreeps's ConstructionSite.remove() bypasses
		// that check and silently returns OK — that's the parity bug this row
		// catches.
		const err = await shard.expectRunPlayerError('p1', code`
			globalThis.__screepsOkStaleConstructionSite.remove()
		`, 'runtime');
		expect(err.errorKind).toBe('runtime');
	});

	test('CONSTRUCTION-SITE-008 a road site can be placed on a wall terrain tile', async ({ shard }) => {
		// Engine utils.js:145-148 / 162-165 — checkConstructionSite rejects a
		// wall tile except for roads; CONSTRUCTION-SITE-011:wallTerrain owns the
		// rejection.
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

		const rc = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].createConstructionSite(${wx}, ${wy}, STRUCTURE_ROAD)
		`);
		expect(rc).toBe(OK);
	});

	for (const { label, ruinType, placedType } of constructionSiteOverRuinCases) {
		test(`CONSTRUCTION-SITE-009:${label} a ruin does not block placing a construction site on its tile`, async ({ shard }) => {
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

	for (const { label, existingType, placedType, expectedRc } of constructionSiteOverStructureCases) {
		test(`CONSTRUCTION-SITE-017:${label} structure under construction-site placement obeys road/rampart stacking`, async ({ shard }) => {
			// Engine utils.js:181-184 — a placed site is rejected when an existing
			// non-road/non-rampart structure with a CONSTRUCTION_COST type occupies
			// the tile and the placed type is also non-road/non-rampart. Road and
			// rampart short-circuit on either side, so they stack with anything.
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
			});
			await shard.placeStructure('W1N1', {
				pos: [25, 25],
				structureType: existingType,
				...(STRUCTURE_TYPES_UNOWNED.has(existingType) ? {} : { owner: 'p1' }),
			});

			const rc = await shard.runPlayer('p1', code`
				Game.rooms['W1N1'].createConstructionSite(25, 25, ${placedType})
			`);
			expect(rc).toBe(expectedRc);
			await shard.tick();

			const sites = await shard.findInRoom('W1N1', FIND_CONSTRUCTION_SITES);
			const site = sites.find(s => s.pos.x === 25 && s.pos.y === 25);
			if (expectedRc === OK) {
				expect(site).toBeDefined();
				expect(site!.structureType).toBe(placedType);
				const structures = await shard.findInRoom('W1N1', FIND_STRUCTURES);
				const existing = structures.find(s =>
					s.structureType === existingType &&
					s.pos.x === 25 && s.pos.y === 25);
				expect(existing).toBeDefined();
			} else {
				expect(site).toBeUndefined();
			}
		});
	}

	test('CONSTRUCTION-SITE-010 RoomPosition.createConstructionSite returns ERR_INVALID_ARGS for an unknown structure type', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});
		const invalidStructureType = STRUCTURE_ROAD.toUpperCase();

		const rc = await shard.runPlayer('p1', code`
			new RoomPosition(26, 25, 'W1N1').createConstructionSite(${invalidStructureType})
		`);
		expect(rc).toBe(ERR_INVALID_ARGS);
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

		const result = await shard.runPlayer('p1', code`
			${placeEveryType}.map(([type, x]) => [type, Game.rooms['W2N1'].createConstructionSite(x, 30, type)])
		`);
		expect(result).toEqual(rclZeroResults);
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
			${placeEveryType}.map(([type, x]) => [type, Game.rooms['W2N1'].createConstructionSite(x, 30, type)])
		`);
		expect(result).toEqual(rclZeroResults);
	});

	test('CONSTRUCTION-SITE-016 over-cap construction sites still complete; no build-time gate', async ({ shard }) => {
		// Counter to engine issue #59: build progress accumulates and surplus
		// sites complete normally even when sites + active > CONTROLLER_STRUCTURES
		// for the structure type. RCL 1 has CONTROLLER_STRUCTURES.extension = 0,
		// so any extension site is over-cap; placeSite bypasses the placement-time
		// check that CONSTRUCTION-SITE-011:rclOrStructureCap covers.
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		// Five short of done: one build of five WORK parts crosses progressTotal.
		const siteId = await shard.placeSite('W1N1', {
			pos: [25, 25], owner: 'p1',
			structureType: STRUCTURE_EXTENSION,
			progress: CONSTRUCTION_COST[STRUCTURE_EXTENSION] - 5,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: body(5, WORK, 5, CARRY, MOVE),
			store: { energy: 250 },
		});

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).build(Game.getObjectById(${siteId}))
		`);
		await shard.tick();

		// Site disappeared and an extension structure was created at the tile.
		const site = await shard.getObject(siteId);
		expect(site).toBeNull();

		const structures = await shard.findInRoom('W1N1', FIND_STRUCTURES);
		const extension = structures.find(s =>
			s.structureType === STRUCTURE_EXTENSION &&
			s.pos.x === 25 && s.pos.y === 25);
		expect(extension).toBeDefined();
	});

	for (const row of constructionSiteCreateValidationCases) {
		test(`CONSTRUCTION-SITE-011:${row.label} createConstructionSite() validation returns the canonical code`, async ({ shard }) => {
			const blockers = shard.validationBlockers(row);
			if (blockers.has('wall-terrain')) shard.requires('terrain', 'custom terrain walls the target tile');
			const owner = blockers.has('not-owner') ? 'p2' : 'p1';
			const reserved = blockers.has('hostile-reservation');
			// A spawn name another create took this tick, in a room where that create succeeds.
			const nameCreated = blockers.has('name-created-this-tick');
			const spawnName = nameCreated || blockers.has('name-taken') ? 'NewSpawn' : undefined;
			const terrain = blockers.has('wall-terrain')
				? Array.from({ length: 2500 }, (_, i) => i === 25 * 50 + 25 ? TERRAIN_WALL : 0)
				: undefined;
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [{
					name: 'W1N1',
					// A reserved room has no owner.
					...(reserved ? {} : { rcl: blockers.has('rcl-or-structure-cap') ? 1 : 8, owner }),
					...(terrain ? { terrain } : {}),
				}, ...(nameCreated ? [{ name: 'W2N1', rcl: 8, owner: 'p1' }] : [])],
			});
			if (owner === 'p2' || reserved) {
				await shard.placeCreep('W1N1', { pos: [20, 20], owner: 'p1', body: [MOVE] });
			}
			if (reserved) await reserveRoom(shard, 'p2', 'W1N1');
			if (blockers.has('name-taken')) {
				await shard.placeSite('W1N1', { pos: [10, 40], owner: 'p1', structureType: STRUCTURE_SPAWN, name: spawnName });
			}
			if (blockers.has('site-cap-full')) {
				// The create that takes the name counts toward the cap too.
				for (let i = 0; i < MAX_CONSTRUCTION_SITES - (nameCreated ? 1 : 0); i++) {
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
			const spawnType = blockers.has('invalid-args') || spawnName !== undefined;
			if (spawnType && blockers.has('rcl-or-structure-cap')) {
				await shard.placeStructure('W1N1', {
					pos: [24, 25],
					structureType: STRUCTURE_SPAWN,
					owner,
				});
			}
			const structureType = blockers.has('invalid-type') ? STRUCTURE_ROAD.toUpperCase()
				: spawnType ? STRUCTURE_SPAWN
				: blockers.has('rcl-or-structure-cap') ? STRUCTURE_TOWER
				// A road may sit on a wall (CONSTRUCTION-SITE-008).
				: blockers.has('wall-terrain') ? STRUCTURE_EXTENSION
				: STRUCTURE_ROAD;
			const name = blockers.has('invalid-args') ? 'x'.repeat(101) : spawnName;
			const x = blockers.has('invalid-coords') ? -1 : 25;

			// See CONSTRUCTION-SITE-013 for the pre-touch.
			const result = await shard.runPlayer('p1', code`
				if (${reserved}) void Game.rooms['W1N1'].controller.reservation;
				const first = ${nameCreated} ? Game.rooms['W2N1'].createConstructionSite(25, 25, STRUCTURE_SPAWN, ${name}) : null;
				({ first, rc: Game.rooms['W1N1'].createConstructionSite(${x}, 25, ${structureType}, ${name}) })
			`);
			expect(result).toEqual({ first: nameCreated ? OK : null, rc: row.expectedRc });
		});
	}

	// A site carries the built structure's structureType, so an engine that keys
	// its structure collections on that field hands the bot a site with no store,
	// no isActive, no spawnCreep. Every structure-scoped lookup must exclude it.
	test('CONSTRUCTION-SITE-019 a construction site never surfaces through a structure-scoped lookup', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		await shard.placeSite('W1N1', { pos: [25, 25], owner: 'p1', structureType: STRUCTURE_SPAWN, name: 'SiteSpawn' });
		await shard.placeSite('W1N1', { pos: [26, 25], owner: 'p1', structureType: STRUCTURE_EXTENSION });
		await shard.tick();

		// The room's controller is itself a structure, so count only the two
		// types the sites impersonate.
		const result = await shard.runPlayer('p1', code`
			(function () {
				const rm = Game.rooms['W1N1'];
				const lookalike = function (s) {
					return s.structureType === ${STRUCTURE_SPAWN} || s.structureType === ${STRUCTURE_EXTENSION};
				};
				return {
					sites: rm.find(${FIND_MY_CONSTRUCTION_SITES}).length,
					structures: rm.find(${FIND_STRUCTURES}, { filter: lookalike }).length,
					myStructures: rm.find(${FIND_MY_STRUCTURES}, { filter: lookalike }).length,
					mySpawns: rm.find(${FIND_MY_SPAWNS}).length,
					lookStructures: rm.lookForAt(${LOOK_STRUCTURES}, 25, 25).length
						+ rm.lookForAt(${LOOK_STRUCTURES}, 26, 25).length,
					gameStructures: Object.values(Game.structures).filter(lookalike).length,
					gameSpawn: typeof Game.spawns['SiteSpawn'],
				};
			})()
		`) as Record<string, number | string>;

		expect(result).toEqual({
			sites: 2,
			structures: 0,
			myStructures: 0,
			mySpawns: 0,
			lookStructures: 0,
			gameStructures: 0,
			gameSpawn: 'undefined',
		});
	});
});
