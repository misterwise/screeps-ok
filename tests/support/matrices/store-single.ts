import {
	STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_TOWER, STRUCTURE_LINK,
	SPAWN_ENERGY_CAPACITY, EXTENSION_ENERGY_CAPACITY, TOWER_CAPACITY, LINK_CAPACITY,
	RESOURCE_ENERGY,
} from '../../../src/index.js';

type RCL = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

interface StoreSingleCase {
	label: string;
	structureType: string;
	resource: typeof RESOURCE_ENERGY;
	expectedCapacity: number;
	rcl?: RCL;
}

// Single-resource stores hold only energy with a fixed capacity.
// store.getCapacity() returns null (no generic capacity).
// store.getCapacity(RESOURCE_ENERGY) returns the energy capacity.
export const storeSingleFixedCases: readonly StoreSingleCase[] = [
	{ label: 'spawn', structureType: STRUCTURE_SPAWN, resource: RESOURCE_ENERGY, expectedCapacity: SPAWN_ENERGY_CAPACITY },
	{ label: 'tower', structureType: STRUCTURE_TOWER, resource: RESOURCE_ENERGY, expectedCapacity: TOWER_CAPACITY },
	{ label: 'link', structureType: STRUCTURE_LINK, resource: RESOURCE_ENERGY, expectedCapacity: LINK_CAPACITY },
];

// Extension capacity varies by controller level.
export const storeSingleExtensionCases: readonly StoreSingleCase[] = (
	Object.entries(EXTENSION_ENERGY_CAPACITY) as [string, number][]
).map(([rclStr, capacity]) => ({
	label: `extension rcl=${rclStr}`,
	structureType: STRUCTURE_EXTENSION,
	resource: RESOURCE_ENERGY as typeof RESOURCE_ENERGY,
	expectedCapacity: capacity,
	rcl: Number(rclStr) as RCL,
}));
