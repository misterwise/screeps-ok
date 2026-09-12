import type { CapabilityName } from '../adapter.js';

export type NukeImpactObjectCase = {
	catalogId: 'NUKE-IMPACT-008';
	label: string;
	objectType: 'powerCreep' | 'spawningSpawn' | 'controller' | 'source' | 'mineral' | 'deposit' | 'flag' | 'portal';
	capability?: CapabilityName;
	location: 'blastCenter' | 'roomwide';
	expected: 'roomObjectRemoved' | 'spawningCleared' | 'survives';
};

export const nukeImpactObjectCases: readonly NukeImpactObjectCase[] = [
	{
		catalogId: 'NUKE-IMPACT-008',
		label: 'powerCreepRoomwideRemoved',
		objectType: 'powerCreep',
		capability: 'powerCreeps',
		location: 'roomwide',
		expected: 'roomObjectRemoved',
	},
	{
		catalogId: 'NUKE-IMPACT-008',
		label: 'spawningSpawnRoomwideCancelled',
		objectType: 'spawningSpawn',
		location: 'roomwide',
		expected: 'spawningCleared',
	},
	{
		catalogId: 'NUKE-IMPACT-008',
		label: 'controllerAtBlastCenterSurvives',
		objectType: 'controller',
		location: 'blastCenter',
		expected: 'survives',
	},
	{
		catalogId: 'NUKE-IMPACT-008',
		label: 'sourceAtBlastCenterSurvives',
		objectType: 'source',
		location: 'blastCenter',
		expected: 'survives',
	},
	{
		catalogId: 'NUKE-IMPACT-008',
		label: 'mineralAtBlastCenterSurvives',
		objectType: 'mineral',
		location: 'blastCenter',
		expected: 'survives',
	},
	{
		catalogId: 'NUKE-IMPACT-008',
		label: 'depositAtBlastCenterSurvives',
		objectType: 'deposit',
		capability: 'deposit',
		location: 'blastCenter',
		expected: 'survives',
	},
	{
		catalogId: 'NUKE-IMPACT-008',
		label: 'flagAtBlastCenterSurvives',
		objectType: 'flag',
		location: 'blastCenter',
		expected: 'survives',
	},
	{
		catalogId: 'NUKE-IMPACT-008',
		label: 'portalAtBlastCenterSurvives',
		objectType: 'portal',
		capability: 'portals',
		location: 'blastCenter',
		expected: 'survives',
	},
];
