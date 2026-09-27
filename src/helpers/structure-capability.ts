import type { CapabilityName } from '../adapter.js';
import {
	STRUCTURE_FACTORY, STRUCTURE_LAB, STRUCTURE_NUKER, STRUCTURE_OBSERVER,
	STRUCTURE_POWER_SPAWN, STRUCTURE_TERMINAL,
} from '../constants.js';

// The capability a structure type's own feature needs; the others need none.
export const structureCapability: Partial<Record<string, CapabilityName>> = {
	[STRUCTURE_FACTORY]: 'factory',
	[STRUCTURE_LAB]: 'chemistry',
	[STRUCTURE_NUKER]: 'nuke',
	[STRUCTURE_OBSERVER]: 'observer',
	[STRUCTURE_POWER_SPAWN]: 'powerSpawn',
	[STRUCTURE_TERMINAL]: 'terminal',
};
