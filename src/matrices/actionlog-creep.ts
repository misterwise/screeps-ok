export type ActionLogCreepCase = {
	catalogId: 'ACTIONLOG-CREEP-001';
	label: string;
	scenario:
		| 'attack'
		| 'harvest'
		| 'build'
		| 'repair'
		| 'heal'
		| 'rangedHeal'
		| 'upgradeController'
		| 'reserveController';
	action: string;
	expected: Record<string, number>;
};

export const actionLogCreepCases: readonly ActionLogCreepCase[] = [
	{
		catalogId: 'ACTIONLOG-CREEP-001',
		label: 'attackTargetCoordinates',
		scenario: 'attack',
		action: 'attack',
		expected: { x: 25, y: 26 },
	},
	{
		catalogId: 'ACTIONLOG-CREEP-001',
		label: 'harvestSourceCoordinates',
		scenario: 'harvest',
		action: 'harvest',
		expected: { x: 25, y: 26 },
	},
	{
		catalogId: 'ACTIONLOG-CREEP-001',
		label: 'buildSiteCoordinates',
		scenario: 'build',
		action: 'build',
		expected: { x: 25, y: 26 },
	},
	{
		catalogId: 'ACTIONLOG-CREEP-001',
		label: 'repairStructureCoordinates',
		scenario: 'repair',
		action: 'repair',
		expected: { x: 25, y: 26 },
	},
	{
		catalogId: 'ACTIONLOG-CREEP-001',
		label: 'healTargetCoordinates',
		scenario: 'heal',
		action: 'heal',
		expected: { x: 25, y: 26 },
	},
	{
		catalogId: 'ACTIONLOG-CREEP-001',
		label: 'rangedHealTargetCoordinates',
		scenario: 'rangedHeal',
		action: 'rangedHeal',
		expected: { x: 25, y: 27 },
	},
	{
		catalogId: 'ACTIONLOG-CREEP-001',
		label: 'upgradeControllerCoordinates',
		scenario: 'upgradeController',
		action: 'upgradeController',
		expected: { x: 1, y: 1 },
	},
	{
		catalogId: 'ACTIONLOG-CREEP-001',
		label: 'reserveControllerCoordinates',
		scenario: 'reserveController',
		action: 'reserveController',
		expected: { x: 1, y: 1 },
	},
];
