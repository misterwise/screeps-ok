import {
	STRUCTURE_LAB, STRUCTURE_POWER_SPAWN, STRUCTURE_NUKER,
	RESOURCE_ENERGY, RESOURCE_POWER, RESOURCE_GHODIUM, RESOURCE_HYDROGEN,
	LAB_ENERGY_CAPACITY, LAB_MINERAL_CAPACITY,
	POWER_SPAWN_ENERGY_CAPACITY, POWER_SPAWN_POWER_CAPACITY,
	NUKER_ENERGY_CAPACITY, NUKER_GHODIUM_CAPACITY,
} from '../index.js';

interface StoreRestrictedCase {
	label: string;
	structureType: string;
	resourceCapacities: ReadonlyArray<{ resource: string; expectedCapacity: number }>;
}

// Restricted stores accept a fixed set of resources, each with its own capacity. The lab is bound to
// its mineral: unbound, its mineral slot takes any resource and getUsedCapacity() is the total (STORE-BIND-001).
export const storeRestrictedCases: readonly StoreRestrictedCase[] = [
	{
		label: 'lab',
		structureType: STRUCTURE_LAB,
		resourceCapacities: [
			{ resource: RESOURCE_ENERGY, expectedCapacity: LAB_ENERGY_CAPACITY },
			{ resource: RESOURCE_HYDROGEN, expectedCapacity: LAB_MINERAL_CAPACITY },
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
