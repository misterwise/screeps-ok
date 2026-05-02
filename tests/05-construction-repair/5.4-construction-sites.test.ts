import { describe, test, expect, code, body,
	OK, ERR_FULL, ERR_RCL_NOT_ENOUGH, ERR_INVALID_TARGET, ERR_INVALID_ARGS,
	WORK, CARRY, MOVE,
	FIND_CONSTRUCTION_SITES, FIND_STRUCTURES,
	STRUCTURE_ROAD, STRUCTURE_TOWER, STRUCTURE_EXTENSION, TERRAIN_WALL,
	MAX_CONSTRUCTION_SITES,
} from '../../src/index.js';
import { constructionSiteOverRuinCases } from '../../src/matrices/construction-site-over-ruin.js';
import {
	TERRAIN_FIXTURE_ROOM,
	TERRAIN_FIXTURE_SPEC,
	TERRAIN_FIXTURE_LANDMARKS,
} from '../../src/terrain-fixture.js';

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
		// Uses the adapter's pre-loaded terrain fixture room so the vanilla
		// runner's cached staticTerrainData already contains the wall tile
		// (see adapters/vanilla/index.ts PRELOAD_ROOMS and
		// src/terrain-fixture.ts isolatedWallTile). xxscreeps still skips
		// via the terrain capability gate.
		shard.requires('terrain', 'custom terrain required for wall placement check');
		const [wx, wy] = TERRAIN_FIXTURE_LANDMARKS.isolatedWallTile;
		await shard.createShard({
			players: ['p1'],
			rooms: [{
				name: TERRAIN_FIXTURE_ROOM,
				rcl: 2,
				owner: 'p1',
				terrain: TERRAIN_FIXTURE_SPEC,
			}],
		});

		const result = await shard.runPlayer('p1', code`({
			road: Game.rooms[${TERRAIN_FIXTURE_ROOM}].createConstructionSite(${wx}, ${wy}, STRUCTURE_ROAD),
			extension: Game.rooms[${TERRAIN_FIXTURE_ROOM}].createConstructionSite(${wx}, ${wy}, STRUCTURE_EXTENSION),
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
});
