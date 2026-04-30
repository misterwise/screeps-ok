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
		label: 'power-creep-roomwide-room-object-removed',
		objectType: 'powerCreep',
		capability: 'powerCreeps',
		location: 'roomwide',
		expected: 'roomObjectRemoved',
	},
	{
		catalogId: 'NUKE-IMPACT-008',
		label: 'actively-spawning-spawn-roomwide-cancelled',
		objectType: 'spawningSpawn',
		location: 'roomwide',
		expected: 'spawningCleared',
	},
	{
		catalogId: 'NUKE-IMPACT-008',
		label: 'controller-at-blast-center-survives',
		objectType: 'controller',
		location: 'blastCenter',
		expected: 'survives',
	},
	{
		catalogId: 'NUKE-IMPACT-008',
		label: 'source-at-blast-center-survives',
		objectType: 'source',
		location: 'blastCenter',
		expected: 'survives',
	},
	{
		catalogId: 'NUKE-IMPACT-008',
		label: 'mineral-at-blast-center-survives',
		objectType: 'mineral',
		location: 'blastCenter',
		expected: 'survives',
	},
	{
		catalogId: 'NUKE-IMPACT-008',
		label: 'deposit-at-blast-center-survives',
		objectType: 'deposit',
		capability: 'deposit',
		location: 'blastCenter',
		expected: 'survives',
	},
	{
		catalogId: 'NUKE-IMPACT-008',
		label: 'flag-at-blast-center-survives',
		objectType: 'flag',
		location: 'blastCenter',
		expected: 'survives',
	},
	{
		catalogId: 'NUKE-IMPACT-008',
		label: 'portal-at-blast-center-survives',
		objectType: 'portal',
		capability: 'portals',
		location: 'blastCenter',
		expected: 'survives',
	},
];
