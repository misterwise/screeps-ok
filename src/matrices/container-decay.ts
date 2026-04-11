import {
	CONTAINER_DECAY, CONTAINER_DECAY_TIME, CONTAINER_DECAY_TIME_OWNED,
} from '../index.js';

// Canonical container decay amount and interval by room ownership state.
export const containerDecayCases = [
	{
		label: 'unowned room',
		owned: false,
		expectedDecayAmount: CONTAINER_DECAY,
		expectedDecayInterval: CONTAINER_DECAY_TIME,
	},
	{
		label: 'owned room',
		owned: true,
		expectedDecayAmount: CONTAINER_DECAY,
		expectedDecayInterval: CONTAINER_DECAY_TIME_OWNED,
	},
] as const;
