import { describe, test, expect, code,
	OK, CONSTRUCTION_COST, STRUCTURE_ROAD,
	CONSTRUCTION_COST_ROAD_SWAMP_RATIO, CONSTRUCTION_COST_ROAD_WALL_RATIO,
	FIND_CONSTRUCTION_SITES, TERRAIN_SWAMP, TERRAIN_WALL,
} from '../../src/index.js';
import { constructionCostCases } from '../../src/matrices/construction-cost.js';

// Capability required to place each structure type as a construction site.
const siteCap: Record<string, string | undefined> = {
	terminal: 'market',
	factory: 'factory',
	nuker: 'nuke',
	powerSpawn: 'powerCreeps',
};

// ── CONSTRUCTION-COST-001: canonical cost table ─────────────
// Matrix-backed: each buildable structure's CONSTRUCTION_COST entry is checked
// against the canonical @screeps/common value (which the matrix sources from).

describe('Construction costs', () => {
	for (const { structureType, expectedCost } of constructionCostCases) {
		test(`CONSTRUCTION-COST-001:${structureType} costs ${expectedCost}`, async ({ shard }) => {
			const cap = siteCap[structureType];
			if (cap) shard.requires(cap as any);

			await shard.ownedRoom('p1', 'W1N1', 8);
			const siteId = await shard.placeSite('W1N1', {
				pos: [25, 25], owner: 'p1',
				structureType,
			});

			const site = await shard.expectObject(siteId, 'site');
			expect(site.progressTotal).toBe(expectedCost);
		});
	}

	test('CONSTRUCTION-COST-002 construction site progressTotal equals its structure construction cost', async ({ shard }) => {
		// Use a specific type (extension, cost=3000) to verify progressTotal
		// matches the canonical CONSTRUCTION_COST entry.
		await shard.ownedRoom('p1', 'W1N1', 2);
		const siteId = await shard.placeSite('W1N1', {
			pos: [25, 25], owner: 'p1',
			structureType: 'extension',
		});

		const site = await shard.expectObject(siteId, 'site');
		expect(site.progressTotal).toBe(CONSTRUCTION_COST['extension']);
	});

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
			await shard.tick();

			const sites = await shard.findInRoom('W1N1', FIND_CONSTRUCTION_SITES);
			const site = sites.find(s => s.pos.x === x && s.pos.y === y);
			expect(site).toBeDefined();
			expect(site!.progressTotal).toBe(CONSTRUCTION_COST[STRUCTURE_ROAD] * ratio);
		});
	}
});
