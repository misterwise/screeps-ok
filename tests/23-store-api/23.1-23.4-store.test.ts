import { describe, test, expect, code,
	STRUCTURE_EXTENSION, STRUCTURE_LAB, CONTROLLER_STRUCTURES,
	LAB_ENERGY_CAPACITY, LAB_MINERAL_CAPACITY,
	RESOURCE_ENERGY, RESOURCE_HYDROGEN, RESOURCE_OXYGEN, RESOURCE_GHODIUM,
} from '../../src/index.js';
import type { ShardFixture } from '../../src/fixture.js';
import { structureCapability } from '../../src/helpers/structure-capability.js';
import { storeOpenCases } from '../../src/matrices/store-open.js';
import { storeSingleExtensionCases, storeSingleFixedCases } from '../../src/matrices/store-single.js';
import { storeRestrictedCases } from '../../src/matrices/store-restricted.js';
import { storeDisallowedCases } from '../../src/matrices/store-disallowed.js';

const storeSingleCases = [...storeSingleFixedCases, ...storeSingleExtensionCases];

// The lowest controller level that allows the structure type, at least 1 for an owned room.
function minRcl(structureType: string): number {
	const limits = (CONTROLLER_STRUCTURES as Record<string, Record<number, number>>)[structureType];
	return Math.max(1, Number(Object.keys(limits).find(level => limits[Number(level)] > 0)));
}

// p1's structure in W1N1 at `rcl` (0 leaves the room unowned).
async function placeStore(
	shard: ShardFixture, structureType: string, store: Record<string, number> = {}, rcl = minRcl(structureType),
): Promise<string> {
	const capability = structureCapability[structureType];
	if (capability) shard.requires(capability);
	await shard.createShard({
		players: ['p1'],
		rooms: [{ name: 'W1N1', ...(rcl > 0 ? { rcl, owner: 'p1' } : {}) }],
	});
	const id = await shard.placeStructure('W1N1', { pos: [25, 25], structureType, owner: 'p1', store });
	// The engine sets an extension's capacity from the controller level on its tick.
	if (structureType === STRUCTURE_EXTENSION) await shard.tick();
	return id;
}

describe('Store', () => {
	// ── STORE-OPEN: any resource, one shared capacity ──

	for (const { structureType, expectedCapacity } of storeOpenCases) {
		test(`STORE-OPEN-001:${structureType} stored resources share one capacity pool`, async ({ shard }) => {
			const energy = expectedCapacity / 4;
			const hydrogen = expectedCapacity / 5;
			const id = await placeStore(shard, structureType, { [RESOURCE_ENERGY]: energy, [RESOURCE_HYDROGEN]: hydrogen });
			const result = await shard.runPlayer('p1', code`
				const s = Game.getObjectById(${id}).store;
				[RESOURCE_ENERGY, RESOURCE_HYDROGEN, RESOURCE_OXYGEN].map(r => [s.getCapacity(r), s.getFreeCapacity(r)])
			`);
			const pool = [expectedCapacity, expectedCapacity - energy - hydrogen];
			expect(result).toEqual([pool, pool, pool]);
		});

		test(`STORE-OPEN-002:${structureType} getCapacity() is the canonical capacity`, async ({ shard }) => {
			const id = await placeStore(shard, structureType);
			const result = await shard.runPlayer('p1', code`Game.getObjectById(${id}).store.getCapacity()`);
			expect(result).toBe(expectedCapacity);
		});

		test(`STORE-OPEN-003:${structureType} no-argument calls report the shared total, used and free`, async ({ shard }) => {
			const energy = expectedCapacity / 4;
			const hydrogen = expectedCapacity / 5;
			const id = await placeStore(shard, structureType, { [RESOURCE_ENERGY]: energy, [RESOURCE_HYDROGEN]: hydrogen });
			const result = await shard.runPlayer('p1', code`
				const s = Game.getObjectById(${id}).store;
				({ capacity: s.getCapacity(), used: s.getUsedCapacity(), free: s.getFreeCapacity() })
			`);
			expect(result).toEqual({
				capacity: expectedCapacity,
				used: energy + hydrogen,
				free: expectedCapacity - energy - hydrogen,
			});
		});
	}

	// ── STORE-SINGLE: energy only ──

	for (const { label, structureType, expectedCapacity, rcl } of storeSingleCases) {
		test(`STORE-SINGLE-001:${label} calls for another resource return null`, async ({ shard }) => {
			const id = await placeStore(shard, structureType, {}, rcl);
			const result = await shard.runPlayer('p1', code`
				const s = Game.getObjectById(${id}).store;
				[s.getCapacity(RESOURCE_HYDROGEN), s.getUsedCapacity(RESOURCE_HYDROGEN), s.getFreeCapacity(RESOURCE_HYDROGEN)]
			`);
			expect(result).toEqual([null, null, null]);
		});

		test(`STORE-SINGLE-002:${label} getCapacity(RESOURCE_ENERGY) is the canonical capacity`, async ({ shard }) => {
			const id = await placeStore(shard, structureType, {}, rcl);
			const result = await shard.runPlayer('p1', code`Game.getObjectById(${id}).store.getCapacity(RESOURCE_ENERGY)`);
			expect(result).toBe(expectedCapacity);
		});

		test(`STORE-SINGLE-003:${label} energy calls report its capacity, stored and free amounts`, async ({ shard }) => {
			const energy = expectedCapacity / 2;
			const id = await placeStore(shard, structureType, { [RESOURCE_ENERGY]: energy }, rcl);
			const result = await shard.runPlayer('p1', code`
				const s = Game.getObjectById(${id}).store;
				[s.getCapacity(RESOURCE_ENERGY), s.getUsedCapacity(RESOURCE_ENERGY), s.getFreeCapacity(RESOURCE_ENERGY)]
			`);
			expect(result).toEqual([expectedCapacity, energy, expectedCapacity - energy]);
		});

		test(`STORE-SINGLE-004:${label} no-argument calls return null`, async ({ shard }) => {
			const id = await placeStore(shard, structureType, { [RESOURCE_ENERGY]: expectedCapacity / 2 }, rcl);
			const result = await shard.runPlayer('p1', code`
				const s = Game.getObjectById(${id}).store;
				[s.getCapacity(), s.getUsedCapacity(), s.getFreeCapacity()]
			`);
			expect(result).toEqual([null, null, null]);
		});
	}

	// ── STORE-RESTRICTED: a capacity per allowed resource ──

	for (const { label, structureType, resourceCapacities } of storeRestrictedCases) {
		const resources = resourceCapacities.map(({ resource }) => resource);
		// Half of each allowed resource; the lab's hydrogen binds its mineral slot.
		const halfFull = Object.fromEntries(resourceCapacities.map(({ resource, expectedCapacity }) => [resource, expectedCapacity / 2]));

		test(`STORE-RESTRICTED-002:${label} each allowed resource has its canonical capacity`, async ({ shard }) => {
			const id = await placeStore(shard, structureType, halfFull);
			const result = await shard.runPlayer('p1', code`
				const s = Game.getObjectById(${id}).store;
				${resources}.map(r => s.getCapacity(r))
			`);
			expect(result).toEqual(resourceCapacities.map(({ expectedCapacity }) => expectedCapacity));
		});

		test(`STORE-RESTRICTED-003:${label} calls for an allowed resource report its capacity, stored and free amounts`, async ({ shard }) => {
			const id = await placeStore(shard, structureType, halfFull);
			const result = await shard.runPlayer('p1', code`
				const s = Game.getObjectById(${id}).store;
				${resources}.map(r => [s.getCapacity(r), s.getUsedCapacity(r), s.getFreeCapacity(r)])
			`);
			expect(result).toEqual(resourceCapacities.map(({ expectedCapacity }) =>
				[expectedCapacity, expectedCapacity / 2, expectedCapacity / 2]));
		});

		test(`STORE-RESTRICTED-005:${label} no-argument calls return null`, async ({ shard }) => {
			const id = await placeStore(shard, structureType, halfFull);
			const result = await shard.runPlayer('p1', code`
				const s = Game.getObjectById(${id}).store;
				[s.getCapacity(), s.getUsedCapacity(), s.getFreeCapacity()]
			`);
			expect(result).toEqual([null, null, null]);
		});
	}

	// Labs bind their mineral slot on the first deposit (STORE-BIND-001/-002), so only the pre-bound stores run.
	for (const { label, structureType, disallowed } of storeDisallowedCases) {
		test(`STORE-RESTRICTED-004:${label} calls for a disallowed resource return null`, async ({ shard }) => {
			const id = await placeStore(shard, structureType);
			const result = await shard.runPlayer('p1', code`
				const s = Game.getObjectById(${id}).store;
				${disallowed}.map(r => [s.getCapacity(r), s.getUsedCapacity(r), s.getFreeCapacity(r)])
			`);
			expect(result).toEqual(disallowed.map(() => [null, null, null]));
		});
	}

	// ── STORE-BIND: the lab's mineral slot ──

	test('STORE-BIND-001 unbound lab mineral slot accepts any non-energy resource', async ({ shard }) => {
		const id = await placeStore(shard, STRUCTURE_LAB);
		const result = await shard.runPlayer('p1', code`
			const s = Game.getObjectById(${id}).store;
			[RESOURCE_HYDROGEN, RESOURCE_OXYGEN, RESOURCE_GHODIUM, RESOURCE_ENERGY].map(r => s.getCapacity(r))
		`);
		expect(result).toEqual([LAB_MINERAL_CAPACITY, LAB_MINERAL_CAPACITY, LAB_MINERAL_CAPACITY, LAB_ENERGY_CAPACITY]);
	});

	for (const boundMineral of [RESOURCE_HYDROGEN, RESOURCE_OXYGEN, RESOURCE_GHODIUM]) {
		test(`STORE-BIND-002:${boundMineral} stored mineral binds the lab slot`, async ({ shard }) => {
			const stored = LAB_MINERAL_CAPACITY / 2;
			const id = await placeStore(shard, STRUCTURE_LAB, { [boundMineral]: stored });
			const otherMineral = boundMineral === RESOURCE_HYDROGEN ? RESOURCE_OXYGEN : RESOURCE_HYDROGEN;

			const result = await shard.runPlayer('p1', code`
				const s = Game.getObjectById(${id}).store;
				({
					capBound: s.getCapacity(${boundMineral}),
					capOther: s.getCapacity(${otherMineral}),
					capEnergy: s.getCapacity(RESOURCE_ENERGY),
					usedBound: s.getUsedCapacity(${boundMineral}),
					usedOther: s.getUsedCapacity(${otherMineral}),
					freeBound: s.getFreeCapacity(${boundMineral}),
					freeOther: s.getFreeCapacity(${otherMineral}),
				})
			`);
			expect(result).toEqual({
				capBound: LAB_MINERAL_CAPACITY,
				capOther: null,
				capEnergy: LAB_ENERGY_CAPACITY,
				usedBound: stored,
				usedOther: null,
				freeBound: LAB_MINERAL_CAPACITY - stored,
				freeOther: null,
			});
		});
	}
});
