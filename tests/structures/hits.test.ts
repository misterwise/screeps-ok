import { describe, test, expect,
	STRUCTURE_TERMINAL, STRUCTURE_FACTORY, STRUCTURE_NUKER, STRUCTURE_POWER_SPAWN,
	STRUCTURE_OBSERVER,
} from '../../src/index.js';
import { requireCapability } from '../support/policy.js';
import { structureHitsCases } from '../support/matrices/structure-hits.js';

// Minimum RCL to place each structure type.
const minRcl: Record<string, number> = {
	spawn: 1, extension: 2, road: 1, constructedWall: 2, rampart: 2,
	link: 5, storage: 4, tower: 3, observer: 8, powerSpawn: 8,
	extractor: 6, lab: 6, terminal: 6, container: 1, nuker: 8, factory: 7,
};

// Capability required to place each structure type.
const requiredCap: Record<string, string | undefined> = {
	terminal: 'market',
	factory: 'factory',
	nuker: 'nuke',
	powerSpawn: 'powerCreeps',
	observer: 'observer',
};

describe('Structure hits', () => {
	for (const { structureType, expectedHits } of structureHitsCases) {
		test(`STRUCT-HITS-001:${structureType} initializes with ${expectedHits} hits`, async ({ shard, skip }) => {
			const cap = requiredCap[structureType];
			if (cap) requireCapability(shard, skip, cap as any);

			const rcl = minRcl[structureType] ?? 1;
			await shard.ownedRoom('p1', 'W1N1', rcl);
			const id = await shard.placeStructure('W1N1', {
				pos: [25, 25], structureType, owner: 'p1',
			});

			const struct = await shard.expectObject(id, 'structure');
			expect(struct.hits).toBe(expectedHits);
		});
	}
});
