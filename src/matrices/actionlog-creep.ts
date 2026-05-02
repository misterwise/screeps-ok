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
		label: 'attack-target-coordinates',
		scenario: 'attack',
		action: 'attack',
		expected: { x: 25, y: 26 },
	},
	{
		catalogId: 'ACTIONLOG-CREEP-001',
		label: 'harvest-source-coordinates',
		scenario: 'harvest',
		action: 'harvest',
		expected: { x: 25, y: 26 },
	},
	{
		catalogId: 'ACTIONLOG-CREEP-001',
		label: 'build-site-coordinates',
		scenario: 'build',
		action: 'build',
		expected: { x: 25, y: 26 },
	},
	{
		catalogId: 'ACTIONLOG-CREEP-001',
		label: 'repair-structure-coordinates',
		scenario: 'repair',
		action: 'repair',
		expected: { x: 25, y: 26 },
	},
	{
		catalogId: 'ACTIONLOG-CREEP-001',
		label: 'heal-target-coordinates',
		scenario: 'heal',
		action: 'heal',
		expected: { x: 25, y: 26 },
	},
	{
		catalogId: 'ACTIONLOG-CREEP-001',
		label: 'ranged-heal-target-coordinates',
		scenario: 'rangedHeal',
		action: 'rangedHeal',
		expected: { x: 25, y: 27 },
	},
	{
		catalogId: 'ACTIONLOG-CREEP-001',
		label: 'upgrade-controller-coordinates',
		scenario: 'upgradeController',
		action: 'upgradeController',
		expected: { x: 1, y: 1 },
	},
	{
		catalogId: 'ACTIONLOG-CREEP-001',
		label: 'reserve-controller-coordinates',
		scenario: 'reserveController',
		action: 'reserveController',
		expected: { x: 1, y: 1 },
	},
];
