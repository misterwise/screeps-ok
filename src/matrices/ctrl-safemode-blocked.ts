// Canonical hostile actions that are blocked (deal zero damage / have no effect)
// when the target room has an active safe mode.
//
// Source: official safe-mode checks in hostile creep combat and dismantle processors.

export const safeModeBlockedActionCases = [
	{ label: 'attack', method: 'attack' },
	{ label: 'rangedAttack', method: 'rangedAttack' },
	{ label: 'rangedMassAttack', method: 'rangedMassAttack' },
	{ label: 'dismantle', method: 'dismantle' },
] as const;
