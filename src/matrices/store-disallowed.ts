import {
	STRUCTURE_NUKER, STRUCTURE_POWER_SPAWN,
	RESOURCE_HYDROGEN, RESOURCE_OXYGEN, RESOURCE_ZYNTHIUM, RESOURCE_GHODIUM, RESOURCE_POWER, RESOURCE_OPS,
} from '../index.js';

// Pre-bound restricted stores: structures whose allowed resource set is fixed
// at construction (unlike labs, whose mineral slot binds dynamically on first
// deposit). For these, getCapacity / getUsedCapacity / getFreeCapacity must
// return null for any resource outside the allowed set.
interface StoreDisallowedCase {
	label: string;
	structureType: string;
	capability: 'nuke' | 'powerSpawn';
	rcl: number;
	disallowed: readonly string[];
}

export const storeDisallowedCases: readonly StoreDisallowedCase[] = [
	{
		label: 'nuker',
		structureType: STRUCTURE_NUKER,
		capability: 'nuke',
		rcl: 8,
		// Nuker accepts energy + G only. Sample a mineral, a boost, power, and a commodity.
		disallowed: [RESOURCE_HYDROGEN, RESOURCE_OXYGEN, RESOURCE_ZYNTHIUM, RESOURCE_POWER, RESOURCE_OPS],
	},
	{
		label: 'powerSpawn',
		structureType: STRUCTURE_POWER_SPAWN,
		capability: 'powerSpawn',
		rcl: 8,
		// Power spawn accepts energy + power only. Sample minerals (including G) and a commodity.
		disallowed: [RESOURCE_HYDROGEN, RESOURCE_OXYGEN, RESOURCE_ZYNTHIUM, RESOURCE_GHODIUM, RESOURCE_OPS],
	},
];
