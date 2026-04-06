import {
	SOURCE_ENERGY_CAPACITY,
	SOURCE_ENERGY_NEUTRAL_CAPACITY,
	SOURCE_ENERGY_KEEPER_CAPACITY,
	ENERGY_REGEN_TIME,
} from '../../../src/index.js';

// Canonical source energy capacity by room state.
export const sourceRegenCases = [
	{
		label: 'owned/reserved room',
		roomState: 'owned' as const,
		expectedCapacity: SOURCE_ENERGY_CAPACITY,
		expectedRegenTime: ENERGY_REGEN_TIME,
	},
	{
		label: 'neutral room',
		roomState: 'neutral' as const,
		expectedCapacity: SOURCE_ENERGY_NEUTRAL_CAPACITY,
		expectedRegenTime: ENERGY_REGEN_TIME,
	},
	{
		label: 'keeper room',
		roomState: 'keeper' as const,
		expectedCapacity: SOURCE_ENERGY_KEEPER_CAPACITY,
		expectedRegenTime: ENERGY_REGEN_TIME,
	},
] as const;
