// INTENT-CREEP-002: the creep methods whose two same-tick calls can differ visibly; the later call's
// intent replaces the earlier (@screeps/driver/lib/runtime/runtime.js:66-71).
export const intentOverwriteCases = [
	'move', 'pull', 'attack', 'rangedAttack', 'heal', 'rangedHeal', 'harvest', 'build',
	'repair', 'dismantle', 'transfer', 'withdraw', 'pickup', 'drop', 'say', 'signController',
] as const;

// INTENT-CREEP-003: each creep intent with a visible effect, canceled by its name
// (game/creeps.js:1008-1014, runtime.js:92-99).
export const intentCancelCases = [
	'move', 'pull', 'attack', 'rangedAttack', 'rangedMassAttack', 'heal', 'rangedHeal', 'harvest',
	'build', 'repair', 'dismantle', 'upgradeController', 'claimController', 'reserveController',
	'attackController', 'signController', 'generateSafeMode', 'transfer', 'withdraw', 'pickup',
	'drop', 'say', 'suicide',
] as const;

export type IntentOrderMethod = typeof intentOverwriteCases[number] | typeof intentCancelCases[number];
