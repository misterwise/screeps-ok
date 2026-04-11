import {
	STRUCTURE_KEEPER_LAIR, STRUCTURE_POWER_BANK, STRUCTURE_INVADER_CORE,
} from '../index.js';

// Canonical NPC structure ownership: my is always false, owner.username is
// a well-known NPC identity string.
export const npcOwnershipCases = [
	{
		label: 'keeper lair',
		structureType: STRUCTURE_KEEPER_LAIR,
		expectedMy: false,
		expectedUsername: 'Source Keeper',
	},
	{
		label: 'power bank',
		structureType: STRUCTURE_POWER_BANK,
		expectedMy: false,
		expectedUsername: 'Power Bank',
	},
	{
		label: 'invader core',
		structureType: STRUCTURE_INVADER_CORE,
		expectedMy: false,
		expectedUsername: 'Invader',
	},
] as const;
