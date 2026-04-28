import {
	describe, test, expect, code,
	FIND_STRUCTURES, STRUCTURE_INVADER_CORE,
} from '../../src/index.js';
import { strongholdTemplates } from '../../src/matrices/stronghold-layout.js';

describe('Stronghold layout', () => {
	for (const template of strongholdTemplates) {
		test(
			`STRONGHOLD-LAYOUT-001 deploying invader core (${template.name}) places the canonical structure layout`,
			async ({ shard }) => {
				shard.requires('invaderCore');
				await shard.createShard({
					players: ['p1'],
					rooms: [{ name: 'W1N1' }],
				});

				const coreX = 25, coreY = 25;
				const coreId = await shard.placeObject('W1N1', 'invaderCore', {
					pos: [coreX, coreY],
					level: template.coreLevel,
					deployTime: 1,
					templateName: template.name,
					strongholdId: `sh-${template.name}`,
				});

				// One tick fires invader-core pretick → 'deploy' behavior.
				await shard.tick();

				const allStructures = await shard.findInRoom('W1N1', FIND_STRUCTURES);

				const core = allStructures.find(s => s.id === coreId);
				expect(core).toBeDefined();
				expect(core!.structureType).toBe(STRUCTURE_INVADER_CORE);

				const cores = allStructures.filter(
					s => s.structureType === STRUCTURE_INVADER_CORE,
				);
				expect(cores).toHaveLength(1);

				const placed = allStructures
					.filter(s => s.id !== coreId && s.structureType !== 'controller')
					.map(s => `${s.structureType}@${s.pos.x - coreX},${s.pos.y - coreY}`)
					.sort();

				const expected = template.structures
					.map(e => `${e.type}@${e.dx},${e.dy}`)
					.sort();

				expect(placed).toEqual(expected);
			},
		);
	}
});
