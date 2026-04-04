import {
	FIND_MY_CREEPS, FIND_HOSTILE_CREEPS, FIND_MY_STRUCTURES, FIND_HOSTILE_STRUCTURES,
} from '../../../src/index.js';

export const roomFindPlayerRelativeCases = [
	{
		label: 'FIND_MY_CREEPS',
		findConstant: FIND_MY_CREEPS,
		expectedValues: ['Mine'],
	},
	{
		label: 'FIND_HOSTILE_CREEPS',
		findConstant: FIND_HOSTILE_CREEPS,
		expectedValues: ['Hostile'],
	},
	{
		label: 'FIND_MY_STRUCTURES',
		findConstant: FIND_MY_STRUCTURES,
		expectedValues: ['controller', 'spawn'],
	},
	{
		label: 'FIND_HOSTILE_STRUCTURES',
		findConstant: FIND_HOSTILE_STRUCTURES,
		expectedValues: ['spawn'],
	},
] as const;
