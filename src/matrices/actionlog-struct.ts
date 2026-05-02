import type { CapabilityName } from '../adapter.js';

export type ActionLogStructureCase = {
	catalogId: 'ACTIONLOG-STRUCT-001';
	label: string;
	scenario:
		| 'towerAttack'
		| 'towerHeal'
		| 'towerRepair'
		| 'linkTransferEnergy'
		| 'labRunReaction'
		| 'labReverseReaction';
	action: string;
	expected: Record<string, number>;
	capability?: CapabilityName;
};

export const actionLogStructureCases: readonly ActionLogStructureCase[] = [
	{
		catalogId: 'ACTIONLOG-STRUCT-001',
		label: 'tower-attack-target-coordinates',
		scenario: 'towerAttack',
		action: 'attack',
		expected: { x: 25, y: 28 },
	},
	{
		catalogId: 'ACTIONLOG-STRUCT-001',
		label: 'tower-heal-target-coordinates',
		scenario: 'towerHeal',
		action: 'heal',
		expected: { x: 25, y: 27 },
	},
	{
		catalogId: 'ACTIONLOG-STRUCT-001',
		label: 'tower-repair-target-coordinates',
		scenario: 'towerRepair',
		action: 'repair',
		expected: { x: 25, y: 26 },
	},
	{
		catalogId: 'ACTIONLOG-STRUCT-001',
		label: 'link-transfer-target-coordinates',
		scenario: 'linkTransferEnergy',
		action: 'transferEnergy',
		expected: { x: 25, y: 35 },
	},
	{
		catalogId: 'ACTIONLOG-STRUCT-001',
		label: 'lab-run-reaction-reagent-coordinates',
		scenario: 'labRunReaction',
		action: 'runReaction',
		expected: { x1: 25, y1: 27, x2: 27, y2: 25 },
		capability: 'chemistry',
	},
	{
		catalogId: 'ACTIONLOG-STRUCT-001',
		label: 'lab-reverse-reaction-output-coordinates',
		scenario: 'labReverseReaction',
		action: 'reverseReaction',
		expected: { x1: 25, y1: 27, x2: 27, y2: 25 },
		capability: 'chemistry',
	},
];
