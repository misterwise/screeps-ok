import { describe, test, expect, code,
	OK,
	MOVE, ATTACK,
	STRUCTURE_TERMINAL, STRUCTURE_FACTORY, STRUCTURE_NUKER, STRUCTURE_POWER_SPAWN,
	STRUCTURE_OBSERVER, STRUCTURE_RAMPART, STRUCTURE_EXTENSION,
	FIND_RUINS,
	ATTACK_POWER,
} from '../../src/index.js';
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
		test(`STRUCTURE-HITS-001:${structureType} initializes with ${expectedHits} hits`, async ({ shard }) => {
			const cap = requiredCap[structureType];
			if (cap) shard.requires(cap as any);

			const rcl = minRcl[structureType] ?? 1;
			await shard.ownedRoom('p1', 'W1N1', rcl);
			const id = await shard.placeStructure('W1N1', {
				pos: [25, 25], structureType, owner: 'p1',
			});

			const struct = await shard.expectObject(id, 'structure');
			expect(struct.hits).toBe(expectedHits);
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
		await shard.tick();

		await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${rampartId}))
		`);
		await shard.tick();

		const obj = await shard.getObject(rampartId);
		expect(obj).toBeNull();
	});

	test('STRUCTURE-HITS-004 destroying a structure creates a ruin containing remaining store', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const extId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_EXTENSION, owner: 'p1',
			store: { energy: 50 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${extId}).destroy()
		`);
		expect(rc).toBe(OK);

		const ruins = await shard.findInRoom('W1N1', FIND_RUINS);
		const ruin = ruins.find(r => r.pos.x === 25 && r.pos.y === 25);
		expect(ruin).toBeDefined();
		expect(ruin!.store.energy).toBe(50);
	});
});
