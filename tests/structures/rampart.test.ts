import { describe, test, expect, STRUCTURE_RAMPART } from '../../src/index.js';
import { rampartHitsMaxCases } from '../support/matrices/rampart-hitsmax.js';

describe('StructureRampart', () => {
	for (const { rcl, expectedHitsMax } of rampartHitsMaxCases) {
		test(`RAMPART-DECAY-003 [rcl=${rcl}] owned rampart hitsMax matches the canonical table`, async ({ shard }) => {
			await shard.ownedRoom('p1', 'W1N1', rcl);
			const rampartId = await shard.placeStructure('W1N1', {
				pos: [25, 25],
				structureType: STRUCTURE_RAMPART,
				owner: 'p1',
				hits: 1,
			});
			await shard.tick();

			const rampart = await shard.expectStructure(rampartId, STRUCTURE_RAMPART);
			expect(rampart.hitsMax).toBe(expectedHitsMax);
		});
	}
});
