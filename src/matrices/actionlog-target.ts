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
		label: 'creepDamagedByCreep',
		scenario: 'meleeAttackCreep',
		action: 'attacked',
		expected: { x: 25, y: 25 },
	},
	{
		catalogId: 'ACTIONLOG-TARGET-001',
		label: 'creepHealedByCreep',
		scenario: 'meleeHealCreep',
		action: 'healed',
		expected: { x: 25, y: 25 },
	},
	{
		catalogId: 'ACTIONLOG-TARGET-001',
		label: 'creepDamagedByTower',
		scenario: 'towerAttackCreep',
		action: 'attacked',
		expected: { x: 25, y: 25 },
	},
	{
		catalogId: 'ACTIONLOG-TARGET-001',
		label: 'creepHealedByTower',
		scenario: 'towerHealCreep',
		action: 'healed',
		expected: { x: 25, y: 25 },
	},
];
