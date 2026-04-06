import {
	STRUCTURE_STORAGE, STRUCTURE_TERMINAL, STRUCTURE_CONTAINER, STRUCTURE_FACTORY,
	STORAGE_CAPACITY, TERMINAL_CAPACITY, CONTAINER_CAPACITY, FACTORY_CAPACITY,
} from '../../../src/index.js';

// Open-capacity stores accept any resource up to a shared total capacity.
// store.getCapacity() (no argument) returns the total capacity.
// store.getCapacity(resource) returns the total capacity for any resource.
export const storeOpenCases = [
	{ structureType: STRUCTURE_STORAGE, expectedCapacity: STORAGE_CAPACITY },
	{ structureType: STRUCTURE_TERMINAL, expectedCapacity: TERMINAL_CAPACITY },
	{ structureType: STRUCTURE_CONTAINER, expectedCapacity: CONTAINER_CAPACITY },
	{ structureType: STRUCTURE_FACTORY, expectedCapacity: FACTORY_CAPACITY },
] as const;
