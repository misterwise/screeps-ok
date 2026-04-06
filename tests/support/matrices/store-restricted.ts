import {
	STRUCTURE_LAB, STRUCTURE_POWER_SPAWN, STRUCTURE_NUKER,
	RESOURCE_ENERGY, RESOURCE_POWER, RESOURCE_GHODIUM,
	LAB_ENERGY_CAPACITY, LAB_MINERAL_CAPACITY,
	POWER_SPAWN_ENERGY_CAPACITY, POWER_SPAWN_POWER_CAPACITY,
	NUKER_ENERGY_CAPACITY, NUKER_GHODIUM_CAPACITY,
} from '../../../src/index.js';

interface StoreRestrictedCase {
	label: string;
	structureType: string;
	resourceCapacities: ReadonlyArray<{ resource: string; expectedCapacity: number }>;
}

// Restricted stores accept a fixed set of resources, each with its own capacity.
// store.getCapacity() returns null (no generic capacity).
// store.getCapacity(resource) returns the per-resource capacity for allowed resources.
export const storeRestrictedCases: readonly StoreRestrictedCase[] = [
	{
		label: 'lab',
		structureType: STRUCTURE_LAB,
		resourceCapacities: [
			{ resource: RESOURCE_ENERGY, expectedCapacity: LAB_ENERGY_CAPACITY },
			// Mineral type varies at runtime; capacity is fixed regardless of mineral.
			{ resource: 'mineral', expectedCapacity: LAB_MINERAL_CAPACITY },
		],
	},
	{
		label: 'powerSpawn',
		structureType: STRUCTURE_POWER_SPAWN,
		resourceCapacities: [
			{ resource: RESOURCE_ENERGY, expectedCapacity: POWER_SPAWN_ENERGY_CAPACITY },
			{ resource: RESOURCE_POWER, expectedCapacity: POWER_SPAWN_POWER_CAPACITY },
		],
	},
	{
		label: 'nuker',
		structureType: STRUCTURE_NUKER,
		resourceCapacities: [
			{ resource: RESOURCE_ENERGY, expectedCapacity: NUKER_ENERGY_CAPACITY },
			{ resource: RESOURCE_GHODIUM, expectedCapacity: NUKER_GHODIUM_CAPACITY },
		],
	},
];
