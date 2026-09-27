import { describe, test, expect, code,
	OK,
	MOVE, ATTACK, WORK, CARRY,
	STRUCTURE_RAMPART, STRUCTURE_EXTENSION, STRUCTURE_EXTRACTOR, STRUCTURE_SPAWN,
	FIND_STRUCTURES, RESOURCE_HYDROGEN,
	ATTACK_POWER, CARRY_CAPACITY, CONSTRUCTION_COST, CONTROLLER_STRUCTURES,
} from '../../src/index.js';
import { structureHitsCases } from '../../src/matrices/structure-hits.js';

// The lowest controller level that allows a structure type (at least 1).
function minRcl(structureType: string): number {
	const level = Object.entries(CONTROLLER_STRUCTURES[structureType])
		.find(([, count]) => count > 0)![0];
	return Math.max(1, Number(level));
}

describe('Structure hits', () => {
	for (const { structureType, expectedHits, capability } of structureHitsCases) {
		test(`STRUCTURE-HITS-001:${structureType} a built ${structureType} starts with ${expectedHits} hits`, async ({ shard }) => {
			if (capability) shard.requires(capability);
			await shard.ownedRoom('p1', 'W1N1', minRcl(structureType));
			// An extractor is built on a mineral.
			if (structureType === STRUCTURE_EXTRACTOR) {
				await shard.placeMineral('W1N1', { pos: [25, 25], mineralType: RESOURCE_HYDROGEN });
			}
			// One build point short, so a single build completes it.
			const siteId = await shard.placeSite('W1N1', {
				pos: [25, 25], owner: 'p1', structureType,
				progress: CONSTRUCTION_COST[structureType] - 1,
				...(structureType === STRUCTURE_SPAWN ? { name: 'Built' } : {}),
			});
			const builderId = await shard.placeCreep('W1N1', {
				pos: [25, 26], owner: 'p1', body: [WORK, CARRY, MOVE], store: { energy: CARRY_CAPACITY },
			});

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${builderId}).build(Game.getObjectById(${siteId}))
			`);
			expect(rc).toBe(OK);
			const built = (await shard.findInRoom('W1N1', FIND_STRUCTURES))
				.filter(s => s.structureType === structureType && s.pos.x === 25 && s.pos.y === 25);
			expect(built.map(s => s.hits)).toEqual([expectedHits]);
		});
	}

	test('STRUCTURE-HITS-002 destroyable structures expose hits and hitsMax', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const id = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_EXTENSION, owner: 'p1',
		});

		const result = await shard.runPlayer('p1', code`
			const s = Game.getObjectById(${id});
			({ hasHits: typeof s.hits === 'number', hasHitsMax: typeof s.hitsMax === 'number' })
		`) as { hasHits: boolean; hasHitsMax: boolean };
		expect(result.hasHits).toBe(true);
		expect(result.hasHitsMax).toBe(true);
	});

	test('STRUCTURE-HITS-003 a structure at 0 hits is destroyed in the same tick', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 2, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		// Rampart with exactly ATTACK_POWER hits — one hit kills it.
		const rampartId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_RAMPART, owner: 'p1',
			hits: ATTACK_POWER,
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p2',
			body: [ATTACK, MOVE],
		});

		const rc = await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${rampartId}))
		`);
		expect(rc).toBe(OK);
		expect(await shard.getObject(rampartId)).toBeNull();
	});
});
