import { describe, test, expect, code,
	STRUCTURE_STORAGE, STRUCTURE_TERMINAL, STRUCTURE_CONTAINER, STRUCTURE_FACTORY,
	STRUCTURE_SPAWN, STRUCTURE_TOWER, STRUCTURE_LINK, STRUCTURE_EXTENSION,
	STRUCTURE_LAB, STRUCTURE_NUKER, STRUCTURE_POWER_SPAWN,
	STORAGE_CAPACITY, TERMINAL_CAPACITY, CONTAINER_CAPACITY, FACTORY_CAPACITY,
	SPAWN_ENERGY_CAPACITY, TOWER_CAPACITY, LINK_CAPACITY, EXTENSION_ENERGY_CAPACITY,
	LAB_ENERGY_CAPACITY, LAB_MINERAL_CAPACITY,
	NUKER_ENERGY_CAPACITY, NUKER_GHODIUM_CAPACITY,
	POWER_SPAWN_ENERGY_CAPACITY, POWER_SPAWN_POWER_CAPACITY,
	RESOURCE_ENERGY,
} from '../../src/index.js';
import { storeOpenCases } from '../support/matrices/store-open.js';
import { storeSingleFixedCases } from '../support/matrices/store-single.js';

// Minimum RCL that allows at least one of each structure type.
const minRcl: Record<string, number> = {
	[STRUCTURE_STORAGE]: 4,
	[STRUCTURE_TERMINAL]: 6,
	[STRUCTURE_CONTAINER]: 1,
	[STRUCTURE_FACTORY]: 7,
	[STRUCTURE_SPAWN]: 1,
	[STRUCTURE_EXTENSION]: 2,
	[STRUCTURE_TOWER]: 3,
	[STRUCTURE_LINK]: 5,
	[STRUCTURE_LAB]: 6,
	[STRUCTURE_NUKER]: 8,
	[STRUCTURE_POWER_SPAWN]: 8,
};

// Capability required to place each structure type (undefined = always available).
const requiredCapability: Record<string, string | undefined> = {
	[STRUCTURE_TERMINAL]: 'market',
	[STRUCTURE_FACTORY]: 'factory',
	[STRUCTURE_NUKER]: 'nuke',
	[STRUCTURE_POWER_SPAWN]: 'powerCreeps',
};

describe('Store', () => {
	// ── STORE-OPEN: general stores (any resource, shared total capacity) ──

	for (const { structureType, expectedCapacity } of storeOpenCases) {
		test(`STORE-OPEN-001:${structureType} getCapacity() returns total capacity for ${structureType}`, async ({ shard }) => {
			const cap = requiredCapability[structureType];
			if (cap) shard.requires(cap as any);

			const rcl = minRcl[structureType] ?? 1;
			await shard.ownedRoom('p1', 'W1N1', rcl);
			const id = await shard.placeStructure('W1N1', {
				pos: [25, 25], structureType, owner: 'p1',
			});

			const result = await shard.runPlayer('p1', code`
				Game.getObjectById(${id}).store.getCapacity()
			`);
			expect(result).toBe(expectedCapacity);
		});
	}

	for (const { structureType, expectedCapacity } of storeOpenCases) {
		test(`STORE-OPEN-002:${structureType} getCapacity(RESOURCE_ENERGY) returns total capacity for ${structureType}`, async ({ shard }) => {
			const cap = requiredCapability[structureType];
			if (cap) shard.requires(cap as any);

			const rcl = minRcl[structureType] ?? 1;
			await shard.ownedRoom('p1', 'W1N1', rcl);
			const id = await shard.placeStructure('W1N1', {
				pos: [25, 25], structureType, owner: 'p1',
			});

			// For general stores, getCapacity(resource) returns the shared total.
			const result = await shard.runPlayer('p1', code`
				Game.getObjectById(${id}).store.getCapacity(RESOURCE_ENERGY)
			`);
			expect(result).toBe(expectedCapacity);
		});
	}

	test('STORE-OPEN-003 getUsedCapacity and getFreeCapacity reflect mixed contents', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 4);
		const id = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_STORAGE, owner: 'p1',
			store: { energy: 500, power: 200 },
		});

		const result = await shard.runPlayer('p1', code`
			const s = Game.getObjectById(${id}).store;
			({ used: s.getUsedCapacity(), free: s.getFreeCapacity() })
		`);
		expect(result).toEqual({
			used: 700,
			free: STORAGE_CAPACITY - 700,
		});
	});

	// ── STORE-SINGLE: energy-only stores ─────────────────────────────────

	for (const { label, structureType, expectedCapacity } of storeSingleFixedCases) {
		test(`STORE-SINGLE-001:${label} getCapacity(RESOURCE_ENERGY) returns ${expectedCapacity} for ${label}`, async ({ shard }) => {
			const rcl = minRcl[structureType] ?? 1;
			await shard.ownedRoom('p1', 'W1N1', rcl);
			const id = await shard.placeStructure('W1N1', {
				pos: [25, 25], structureType, owner: 'p1',
			});

			const result = await shard.runPlayer('p1', code`
				Game.getObjectById(${id}).store.getCapacity(RESOURCE_ENERGY)
			`);
			expect(result).toBe(expectedCapacity);
		});
	}

	test('STORE-SINGLE-001:extension getCapacity(RESOURCE_ENERGY) returns RCL-based capacity for extension', async ({ shard }) => {
		// Extension capacity is RCL-dependent: 50 at RCL 2-6, 100 at RCL 7, 200 at RCL 8.
		await shard.ownedRoom('p1', 'W1N1', 7);
		const id = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_EXTENSION, owner: 'p1',
		});

		const result = await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).store.getCapacity(RESOURCE_ENERGY)
		`);
		expect(result).toBe(EXTENSION_ENERGY_CAPACITY[7]);
	});

	test('STORE-SINGLE-002 getCapacity() with no argument returns null for energy-only stores', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 5);
		const id = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LINK, owner: 'p1',
		});

		const result = await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).store.getCapacity()
		`);
		expect(result).toBeNull();
	});

	test('STORE-SINGLE-003 getCapacity(non-energy) returns null for energy-only stores', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 3);
		const id = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
		});

		const result = await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).store.getCapacity('H')
		`);
		expect(result).toBeNull();
	});

	test('STORE-SINGLE-004 getUsedCapacity(RESOURCE_ENERGY) returns energy amount for energy-only stores', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 1);
		const id = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 150 },
		});

		const result = await shard.runPlayer('p1', code`
			const s = Game.getObjectById(${id}).store;
			({
				usedEnergy: s.getUsedCapacity(RESOURCE_ENERGY),
				freeEnergy: s.getFreeCapacity(RESOURCE_ENERGY),
			})
		`);
		expect(result).toEqual({
			usedEnergy: 150,
			freeEnergy: SPAWN_ENERGY_CAPACITY - 150,
		});
	});

	// ── STORE-RESTRICTED: per-resource capacity limits ───────────────────

	test('STORE-RESTRICTED-001 lab getCapacity returns per-resource caps', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 6);
		// Lab must hold a mineral for getCapacity(mineral) to return the cap.
		const id = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 0, H: 100 },
		});

		const result = await shard.runPlayer('p1', code`
			const s = Game.getObjectById(${id}).store;
			({
				capEnergy: s.getCapacity(RESOURCE_ENERGY),
				capMineral: s.getCapacity('H'),
				capGeneral: s.getCapacity(),
			})
		`);
		expect(result).toEqual({
			capEnergy: LAB_ENERGY_CAPACITY,
			capMineral: LAB_MINERAL_CAPACITY,
			capGeneral: null,
		});
	});

	test('STORE-RESTRICTED-002 nuker getCapacity returns per-resource caps', async ({ shard }) => {
		shard.requires('nuke');

		await shard.ownedRoom('p1', 'W1N1', 8);
		const id = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_NUKER, owner: 'p1',
		});

		const result = await shard.runPlayer('p1', code`
			const s = Game.getObjectById(${id}).store;
			({
				capEnergy: s.getCapacity(RESOURCE_ENERGY),
				capGhodium: s.getCapacity('G'),
				capGeneral: s.getCapacity(),
			})
		`);
		expect(result).toEqual({
			capEnergy: NUKER_ENERGY_CAPACITY,
			capGhodium: NUKER_GHODIUM_CAPACITY,
			capGeneral: null,
		});
	});

	test('STORE-RESTRICTED-003 powerSpawn getCapacity returns per-resource caps', async ({ shard }) => {
		shard.requires('powerCreeps');

		await shard.ownedRoom('p1', 'W1N1', 8);
		const id = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_POWER_SPAWN, owner: 'p1',
		});

		const result = await shard.runPlayer('p1', code`
			const s = Game.getObjectById(${id}).store;
			({
				capEnergy: s.getCapacity(RESOURCE_ENERGY),
				capPower: s.getCapacity(RESOURCE_POWER),
				capGeneral: s.getCapacity(),
			})
		`);
		expect(result).toEqual({
			capEnergy: POWER_SPAWN_ENERGY_CAPACITY,
			capPower: POWER_SPAWN_POWER_CAPACITY,
			capGeneral: null,
		});
	});

	test('STORE-RESTRICTED-004 restricted store getCapacity returns null for disallowed resource', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 6);
		const id = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
		});

		// Labs accept energy + one mineral, not power.
		const result = await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).store.getCapacity(RESOURCE_POWER)
		`);
		expect(result).toBeNull();
	});

	test('STORE-RESTRICTED-005 restricted store getUsedCapacity reflects stored amounts', async ({ shard }) => {
		shard.requires('nuke');

		await shard.ownedRoom('p1', 'W1N1', 8);
		const id = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_NUKER, owner: 'p1',
			store: { energy: 10000, G: 500 },
		});

		const result = await shard.runPlayer('p1', code`
			const s = Game.getObjectById(${id}).store;
			({
				usedEnergy: s.getUsedCapacity(RESOURCE_ENERGY),
				usedG: s.getUsedCapacity('G'),
				freeEnergy: s.getFreeCapacity(RESOURCE_ENERGY),
				freeG: s.getFreeCapacity('G'),
			})
		`);
		expect(result).toEqual({
			usedEnergy: 10000,
			usedG: 500,
			freeEnergy: NUKER_ENERGY_CAPACITY - 10000,
			freeG: NUKER_GHODIUM_CAPACITY - 500,
		});
	});
});
