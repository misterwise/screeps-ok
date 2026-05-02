export type ActionLogTargetCase = {
	catalogId: 'ACTIONLOG-TARGET-001';
	label: string;
	scenario: 'meleeAttackCreep' | 'meleeHealCreep' | 'towerAttackCreep' | 'towerHealCreep';
	action: 'attacked' | 'healed';
	expected: Record<string, number>;
};

export const actionLogTargetCases: readonly ActionLogTargetCase[] = [
	{
		catalogId: 'ACTIONLOG-TARGET-001',
		label: 'creep-damaged-by-creep',
		scenario: 'meleeAttackCreep',
		action: 'attacked',
		expected: { x: 25, y: 25 },
	},
	{
		catalogId: 'ACTIONLOG-TARGET-001',
		label: 'creep-healed-by-creep',
		scenario: 'meleeHealCreep',
		action: 'healed',
		expected: { x: 25, y: 25 },
	},
	{
		catalogId: 'ACTIONLOG-TARGET-001',
		label: 'creep-damaged-by-tower',
		scenario: 'towerAttackCreep',
		action: 'attacked',
		expected: { x: 25, y: 25 },
	},
	{
		catalogId: 'ACTIONLOG-TARGET-001',
		label: 'creep-healed-by-tower',
		scenario: 'towerHealCreep',
		action: 'healed',
		expected: { x: 25, y: 25 },
	},
];
