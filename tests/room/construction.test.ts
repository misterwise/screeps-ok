import { describe, test, expect, code, OK, WORK, CARRY, MOVE, FIND_CONSTRUCTION_SITES, FIND_STRUCTURES, STRUCTURE_ROAD, body } from '../../src/index.js';

describe('room.createConstructionSite()', () => {
	test('creates a construction site via player code', async ({ shard }) => {
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
		const road = sites.find((s: any) => s.kind === 'site' && s.structureType === 'road');
		expect(road).toBeDefined();
	});

	test('build completes when progress reaches progressTotal', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		// Road costs 300 progress. 5 WORK = 25 energy/tick → 5 ticks * 5 build = 25/tick
		// Wait, build is 5 per WORK per tick. So 5 WORK = 25 progress/tick. 300/25 = 12 ticks.
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

		// Site should be gone, replaced by a road structure
		const site = await shard.getObject(siteId);
		expect(site).toBeNull(); // construction complete

		const structures = await shard.findInRoom('W1N1', FIND_STRUCTURES);
		const road = structures.find((s: any) =>
			s.kind === 'structure' && s.structureType === 'road' &&
			s.pos.x === 30 && s.pos.y === 31);
		expect(road).toBeDefined();
	});
});
