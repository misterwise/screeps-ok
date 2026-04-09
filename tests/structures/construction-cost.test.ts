import { describe, test, expect,
	CONSTRUCTION_COST,
} from '../../src/index.js';
import { constructionCostCases } from '../support/matrices/construction-cost.js';

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
});
