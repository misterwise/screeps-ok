import {
	FIND_MY_CREEPS, FIND_HOSTILE_CREEPS,
	FIND_STRUCTURES, FIND_MY_STRUCTURES, FIND_HOSTILE_STRUCTURES,
	FIND_MY_SPAWNS, FIND_HOSTILE_SPAWNS,
} from '../index.js';

// Setup placed by ROOM-FIND-001 tests:
//   creep 'Mine' (p1), creep 'Hostile' (p2),
//   spawn (p1), spawn (p2),
//   road (unowned), constructedWall (unowned),
//   controller (p1, implicit from rcl: 1, owner: 'p1').
//
// Each row is the exact set of `structureType || name` values the listed
// FIND_* constant must return when evaluated as p1. Labels are camelCase
// so the parity reporter can tag individual rows via ROOM-FIND-001:label.
export const roomFindPlayerRelativeCases = [
	{
		label: 'findMyCreeps',
		findConstant: FIND_MY_CREEPS,
		expectedValues: ['Mine'],
	},
	{
		label: 'findHostileCreeps',
		findConstant: FIND_HOSTILE_CREEPS,
		expectedValues: ['Hostile'],
	},
	{
		label: 'findStructures',
		findConstant: FIND_STRUCTURES,
		expectedValues: ['constructedWall', 'controller', 'road', 'spawn', 'spawn'],
	},
	{
		label: 'findMyStructures',
		findConstant: FIND_MY_STRUCTURES,
		expectedValues: ['controller', 'spawn'],
	},
	{
		label: 'findHostileStructures',
		findConstant: FIND_HOSTILE_STRUCTURES,
		expectedValues: ['spawn'],
	},
	{
		label: 'findMySpawns',
		findConstant: FIND_MY_SPAWNS,
		expectedValues: ['spawn'],
	},
	{
		label: 'findHostileSpawns',
		findConstant: FIND_HOSTILE_SPAWNS,
		expectedValues: ['spawn'],
	},
] as const;
