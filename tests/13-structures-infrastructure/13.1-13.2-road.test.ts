import { describe, test, expect, code,
	OK, MOVE, WORK, CARRY,
	STRUCTURE_ROAD, ROAD_HITS, ROAD_WEAROUT, TOP,
	CONSTRUCTION_COST, CONSTRUCTION_COST_ROAD_SWAMP_RATIO, CONSTRUCTION_COST_ROAD_WALL_RATIO,
	FIND_STRUCTURES,
} from '../../src/index.js';
import {
	TERRAIN_FIXTURE_ROOM,
	TERRAIN_FIXTURE_SPEC,
	TERRAIN_FIXTURE_LANDMARKS,
} from '../../src/terrain-fixture.js';

describe('StructureRoad', () => {
	// ── ROAD-HITS-001: completed-road hits scale by underlying terrain ──
	// Engine @screeps/engine/src/processor/intents/creeps/build.js:171-187 sets
	// a completed road's hits to `ROAD_HITS * CONSTRUCTION_COST_ROAD_*_RATIO`
	// based on the underlying terrain at the moment of completion, independent
	// of the site's stored progressTotal. Exercises the engine's completion
	// branch end-to-end via build() rather than the adapter's placeStructure
	// helper (which lets tests pre-set `hits` and bypass the scaling logic).

	const roadHitsTerrainCases = [
		{
			label: 'plain',
			landmark: 'plainOrigin' as const,
			ratio: 1,
			neighbor: [-1, 0] as [number, number],
		},
		{
			label: 'swamp',
			landmark: 'swampTile' as const,
			ratio: CONSTRUCTION_COST_ROAD_SWAMP_RATIO,
			neighbor: [-1, 0] as [number, number],
		},
		{
			label: 'wall',
			landmark: 'isolatedWallTile' as const,
			ratio: CONSTRUCTION_COST_ROAD_WALL_RATIO,
			neighbor: [0, 1] as [number, number],
		},
	];

	for (const { label, landmark, ratio, neighbor: [dx, dy] } of roadHitsTerrainCases) {
		test(`ROAD-HITS-001:${label} road built on ${label} initializes with ROAD_HITS × ${ratio}`, async ({ shard }) => {
			shard.requires('terrain', `custom terrain required for ${label}-tile road completion`);
			const [x, y] = TERRAIN_FIXTURE_LANDMARKS[landmark];
			await shard.createShard({
				players: ['p1'],
				rooms: [{
					name: TERRAIN_FIXTURE_ROOM, rcl: 2, owner: 'p1',
					terrain: TERRAIN_FIXTURE_SPEC,
				}],
			});
			// progressTotal for a road site scales by terrain ratio, so seed
			// progress at `scaled - 5` and let one build() with 5 energy close
			// the gap. The engine's completion branch reads terrain directly
			// and scales hits — stored progressTotal isn't consulted for hits.
			const scaledTotal = CONSTRUCTION_COST[STRUCTURE_ROAD] * ratio;
			const siteId = await shard.placeSite(TERRAIN_FIXTURE_ROOM, {
				pos: [x, y], owner: 'p1',
				structureType: STRUCTURE_ROAD,
				progress: scaledTotal - 5,
			});
			const creepId = await shard.placeCreep(TERRAIN_FIXTURE_ROOM, {
				pos: [x + dx, y + dy], owner: 'p1',
				body: [WORK, CARRY, MOVE],
				store: { energy: 5 },
			});

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${creepId}).build(Game.getObjectById(${siteId}))
			`);
			expect(rc).toBe(OK);
			await shard.tick();

			const site = await shard.getObject(siteId);
			expect(site).toBeNull();
			const structures = await shard.findInRoom(TERRAIN_FIXTURE_ROOM, FIND_STRUCTURES);
			const road = structures.find(
				s => s.structureType === STRUCTURE_ROAD && s.pos.x === x && s.pos.y === y,
			);
			expect(road).toBeDefined();
			const expectedHits = ROAD_HITS * ratio;
			expect(road!.hits).toBe(expectedHits);
			expect(road!.hitsMax).toBe(expectedHits);
		});
	}

	test('ROAD-WEAR-001 moving onto a road advances nextDecayTime by ROAD_WEAROUT * body.length', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const roadId = await shard.placeStructure('W1N1', {
			pos: [25, 24], structureType: STRUCTURE_ROAD,
			ticksToDecay: 1000,
		});
		// Creep with 3 body parts: [WORK, CARRY, MOVE]
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		await shard.tick();

		const roadBefore = await shard.expectStructure(roadId, STRUCTURE_ROAD);
		const ttdBefore = roadBefore.ticksToDecay;
		expect(ttdBefore).toBeGreaterThan(0);

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).move(TOP)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.pos.y).toBe(24);

		const roadAfter = await shard.expectStructure(roadId, STRUCTURE_ROAD);
		// Road wear advances decay timer by ROAD_WEAROUT * body.length.
		// runPlayer (1 tick) + tick() (1 tick) = 2 ticks elapsed.
		const expectedDecrease = ROAD_WEAROUT * 3 + 2;
		expect(roadAfter.ticksToDecay).toBe(ttdBefore - expectedDecrease);
	});

	test('ROAD-WEAR-002 road wear is applied in the same tick the creep moves onto the road', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const roadId = await shard.placeStructure('W1N1', {
			pos: [25, 24], structureType: STRUCTURE_ROAD,
			ticksToDecay: 1000,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE],
		});
		await shard.tick();

		const roadBefore = await shard.expectStructure(roadId, STRUCTURE_ROAD);
		const ttdBefore = roadBefore.ticksToDecay;

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).move(TOP)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.pos.y).toBe(24);

		const roadAfter = await shard.expectStructure(roadId, STRUCTURE_ROAD);
		// Wear (ROAD_WEAROUT * 1) + 2 ticks elapsed (runPlayer + tick).
		expect(roadAfter.ticksToDecay).toBe(ttdBefore - ROAD_WEAROUT * 1 - 2);
	});

	test('ROAD-WEAR-003 moving onto a wall-road applies the same ROAD_WEAROUT advance as plain-road', async ({ shard }) => {
		// Vanilla wall-roads share the wear code path with plain/swamp roads —
		// the wear branch in `@screeps/engine/src/processor/intents/creeps/move.js`
		// only keys off the presence of a road structure, not the underlying
		// terrain. Pair with ROAD-WEAR-001: same wear formula, different tile.
		shard.requires('terrain', 'custom terrain required for wall-road wear');
		const [wx, wy] = TERRAIN_FIXTURE_LANDMARKS.isolatedWallTile;
		await shard.createShard({
			players: ['p1'],
			rooms: [{
				name: TERRAIN_FIXTURE_ROOM, rcl: 1, owner: 'p1',
				terrain: TERRAIN_FIXTURE_SPEC,
			}],
		});
		// Place the wall-road with terrain-scaled hits (matches what BUILD
		// completion would produce) and a known decay anchor.
		const roadId = await shard.placeStructure(TERRAIN_FIXTURE_ROOM, {
			pos: [wx, wy], structureType: STRUCTURE_ROAD,
			hits: ROAD_HITS * CONSTRUCTION_COST_ROAD_WALL_RATIO,
			ticksToDecay: 1000,
		});
		const creepId = await shard.placeCreep(TERRAIN_FIXTURE_ROOM, {
			pos: [wx, wy + 1], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		await shard.tick();

		const roadBefore = await shard.expectStructure(roadId, STRUCTURE_ROAD);
		const ttdBefore = roadBefore.ticksToDecay;

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).move(TOP)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.pos.y).toBe(wy);

		const roadAfter = await shard.expectStructure(roadId, STRUCTURE_ROAD);
		// Wear (ROAD_WEAROUT * 3 body parts) + 2 ticks elapsed (runPlayer + tick).
		expect(roadAfter.ticksToDecay).toBe(ttdBefore - ROAD_WEAROUT * 3 - 2);
	});
});
