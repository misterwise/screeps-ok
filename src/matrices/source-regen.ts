import {
	SOURCE_ENERGY_CAPACITY,
	SOURCE_ENERGY_NEUTRAL_CAPACITY,
	SOURCE_ENERGY_KEEPER_CAPACITY,
} from '../index.js';

// Source capacity by room state (@screeps/engine processor/intents/sources/tick.js:46-59):
// a controller that is owned or reserved, one that is neither, and no controller.
export const sourceRegenCases = [
	{ label: 'owned', roomState: 'owned', expectedCapacity: SOURCE_ENERGY_CAPACITY },
	{ label: 'reserved', roomState: 'reserved', expectedCapacity: SOURCE_ENERGY_CAPACITY },
	{ label: 'neutral', roomState: 'neutral', expectedCapacity: SOURCE_ENERGY_NEUTRAL_CAPACITY },
	{ label: 'keeper', roomState: 'keeper', expectedCapacity: SOURCE_ENERGY_KEEPER_CAPACITY },
] as const;
