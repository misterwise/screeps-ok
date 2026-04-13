import { describe, test, expect, code,
	OK, ERR_RCL_NOT_ENOUGH,
	STRUCTURE_EXTENSION, STRUCTURE_TOWER, STRUCTURE_STORAGE, STRUCTURE_LINK,
	STRUCTURE_LAB, STRUCTURE_EXTRACTOR, STRUCTURE_TERMINAL, STRUCTURE_OBSERVER,
	STRUCTURE_SPAWN,
	CONTROLLER_STRUCTURES,
} from '../../src/index.js';

// Minimum RCL required for each structure type (from CONTROLLER_STRUCTURES).
// Tests place the structure at rcl - 1 to verify isActive() === false,
// then at rcl to verify isActive() === true.
const isActiveCases: readonly { structureType: string; minRcl: number; label: string; cap?: string }[] = [
	{ structureType: STRUCTURE_EXTENSION, minRcl: 2, label: 'extension' },
	{ structureType: STRUCTURE_TOWER, minRcl: 3, label: 'tower' },
	{ structureType: STRUCTURE_STORAGE, minRcl: 4, label: 'storage' },
	{ structureType: STRUCTURE_LINK, minRcl: 5, label: 'link' },
	{ structureType: STRUCTURE_EXTRACTOR, minRcl: 6, label: 'extractor' },
	{ structureType: STRUCTURE_LAB, minRcl: 6, label: 'lab' },
	{ structureType: STRUCTURE_TERMINAL, minRcl: 6, label: 'terminal', cap: 'market' },
	{ structureType: STRUCTURE_OBSERVER, minRcl: 8, label: 'observer', cap: 'observer' },
];

describe('CTRL-STRUCTLIMIT-002: isActive by RCL', () => {
	for (const { structureType, minRcl, label, cap } of isActiveCases) {
		test(`CTRL-STRUCTLIMIT-002:${label} ${label} reports isActive() === false below required RCL`, async ({ shard }) => {
			if (cap) shard.requires(cap as any);
			// Place the structure at one RCL below the minimum.
			const belowRcl = minRcl - 1;
			await shard.ownedRoom('p1', 'W1N1', belowRcl);
			const id = await shard.placeStructure('W1N1', {
				pos: [25, 25], structureType, owner: 'p1',
			});
			await shard.tick();

			const active = await shard.runPlayer('p1', code`
				Game.getObjectById(${id}).isActive()
			`);
			expect(active).toBe(false);
		});

		test(`CTRL-STRUCTLIMIT-002:${label} ${label} reports isActive() === true at required RCL`, async ({ shard }) => {
			if (cap) shard.requires(cap as any);
			await shard.ownedRoom('p1', 'W1N1', minRcl);
			const id = await shard.placeStructure('W1N1', {
				pos: [25, 25], structureType, owner: 'p1',
			});
			await shard.tick();

			const active = await shard.runPlayer('p1', code`
				Game.getObjectById(${id}).isActive()
			`);
			expect(active).toBe(true);
		});
	}

	// Spawns are always active at RCL 1+ (the first allowed RCL).
	test('CTRL-STRUCTLIMIT-002:spawn spawn reports isActive() === true at RCL 1', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 1);
		const id = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
		});
		await shard.tick();

		const active = await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).isActive()
		`);
		expect(active).toBe(true);
	});
});

describe('CTRL-STRUCTLIMIT-001: structure count limits', () => {
	// Pick extension at RCL 2 (max 5) as a representative combo.
	// Place exactly the limit → all active; place one more → the excess is inactive.
	test('CTRL-STRUCTLIMIT-001 placing exactly CONTROLLER_STRUCTURES[extension][2] structures are all active, one more is inactive', async ({ shard }) => {
		const limit = CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][2];
		expect(limit).toBeGreaterThan(0);

		await shard.ownedRoom('p1', 'W1N1', 2);
		// Place exactly the allowed number of extensions.
		for (let i = 0; i < limit; i++) {
			await shard.placeStructure('W1N1', {
				pos: [10 + i, 25], structureType: STRUCTURE_EXTENSION, owner: 'p1',
			});
		}
		// Place one extra beyond the limit.
		await shard.placeStructure('W1N1', {
			pos: [10 + limit, 25], structureType: STRUCTURE_EXTENSION, owner: 'p1',
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const exts = Game.rooms['W1N1'].find(FIND_MY_STRUCTURES)
				.filter(s => s.structureType === STRUCTURE_EXTENSION);
			({
				total: exts.length,
				active: exts.filter(s => s.isActive()).length,
				inactive: exts.filter(s => !s.isActive()).length,
			})
		`) as { total: number; active: number; inactive: number };

		expect(result.total).toBe(limit + 1);
		expect(result.active).toBe(limit);
		expect(result.inactive).toBe(1);
	});
});
