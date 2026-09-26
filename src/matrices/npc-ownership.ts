import {
	STRUCTURE_KEEPER_LAIR, STRUCTURE_POWER_BANK, STRUCTURE_INVADER_CORE,
} from '../index.js';
import type { CapabilityName } from '../index.js';

// NPC structures are never `my`; each has a well-known owner (game/structures.js).
export const npcOwnershipCases: readonly {
	structureType: typeof STRUCTURE_KEEPER_LAIR | typeof STRUCTURE_POWER_BANK | typeof STRUCTURE_INVADER_CORE;
	capability?: CapabilityName;
	expectedMy: false;
	expectedUsername: string;
}[] = [
	{ structureType: STRUCTURE_KEEPER_LAIR, expectedMy: false, expectedUsername: 'Source Keeper' },
	{ structureType: STRUCTURE_POWER_BANK, capability: 'powerBank', expectedMy: false, expectedUsername: 'Power Bank' },
	{ structureType: STRUCTURE_INVADER_CORE, capability: 'invaderCore', expectedMy: false, expectedUsername: 'Invader' },
];
