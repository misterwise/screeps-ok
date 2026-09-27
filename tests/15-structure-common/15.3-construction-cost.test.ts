import { describe, test, expect, code,
	OK, CONSTRUCTION_COST, STRUCTURE_ROAD,
	CONSTRUCTION_COST_ROAD_SWAMP_RATIO, CONSTRUCTION_COST_ROAD_WALL_RATIO,
	FIND_CONSTRUCTION_SITES, TERRAIN_SWAMP, TERRAIN_WALL, STRUCTURE_EXTRACTOR, RESOURCE_HYDROGEN,
} from '../../src/index.js';
import { constructionCostCases } from '../../src/matrices/construction-cost.js';

// ── CONSTRUCTION-COST-001: canonical cost table ─────────────
// The player creates each site, so the engine sets its progressTotal
// (create-construction-site.js:35-45).

describe('Construction costs', () => {
	for (const { structureType, expectedCost, capability } of constructionCostCases) {
		test(`CONSTRUCTION-COST-001:${structureType} costs ${expectedCost}`, async ({ shard }) => {
			if (capability) shard.requires(capability);
			await shard.ownedRoom('p1', 'W1N1', 8);
			// An extractor site needs a mineral under it.
			if (structureType === STRUCTURE_EXTRACTOR) {
				await shard.placeMineral('W1N1', { pos: [25, 25], mineralType: RESOURCE_HYDROGEN });
			}

			const rc = await shard.runPlayer('p1', code`
				Game.rooms.W1N1.createConstructionSite(25, 25, ${structureType})
			`);
			expect(rc).toBe(OK);
			const sites = await shard.findInRoom('W1N1', FIND_CONSTRUCTION_SITES);
			expect(sites.map(site => [site.structureType, site.progressTotal])).toEqual([[structureType, expectedCost]]);
		});
	}

	// ── CONSTRUCTION-COST-003: road site progressTotal scales by terrain ratio ──
	// Engine @screeps/engine/src/game/rooms.js createConstructionSite scales
	// a road site's cost by the terrain ratio: wall → 150×, swamp → 5×, plain → 1×.
	// Must place via the player API (createConstructionSite) — the adapter's
	// placeSite helper hardcodes the base cost and would bypass the scaling.

	const roadTerrainCases = [
		{ label: 'wall', pos: [20, 20], terrain: TERRAIN_WALL, ratio: CONSTRUCTION_COST_ROAD_WALL_RATIO },
		{ label: 'swamp', pos: [21, 20], terrain: TERRAIN_SWAMP, ratio: CONSTRUCTION_COST_ROAD_SWAMP_RATIO },
	] as const;

	for (const { label, pos, terrain: terrainMask, ratio } of roadTerrainCases) {
		test(`CONSTRUCTION-COST-003:${label} road site progressTotal is ${label === 'wall' ? CONSTRUCTION_COST_ROAD_WALL_RATIO : CONSTRUCTION_COST_ROAD_SWAMP_RATIO}× base cost`, async ({ shard }) => {
			shard.requires('terrain', `custom terrain required for ${label}-tile road cost`);
			const [x, y] = pos;
			const terrain = new Array<0 | 1 | 2>(2500).fill(0);
			terrain[y * 50 + x] = terrainMask;
			await shard.createShard({
				players: ['p1'],
				rooms: [{
					name: 'W1N1', rcl: 2, owner: 'p1',
					terrain,
				}],
			});

			const rc = await shard.runPlayer('p1', code`
				Game.rooms['W1N1'].createConstructionSite(${x}, ${y}, STRUCTURE_ROAD)
			`);
			expect(rc).toBe(OK);

			const sites = await shard.findInRoom('W1N1', FIND_CONSTRUCTION_SITES);
			const site = sites.find(s => s.pos.x === x && s.pos.y === y);
			expect(site).toBeDefined();
			expect(site!.progressTotal).toBe(CONSTRUCTION_COST[STRUCTURE_ROAD] * ratio);
		});
	}
});
