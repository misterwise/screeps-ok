// INTENT-LIMIT-001/-002: the global intents vanilla queues with `pushByName(..., 50)`
// (game/market.js:104,168,187; game/power-creeps.js:187,200,213,242,371,408).
export const INTENT_LIMIT_PER_TICK = 50;

export const intentLimitCases = [
	{ label: 'cancelOrder' },
	{ label: 'changeOrderPrice' },
	{ label: 'extendOrder' },
	{ label: 'createPowerCreep' },
	{ label: 'spawnPowerCreep' },
	{ label: 'suicidePowerCreep' },
	{ label: 'deletePowerCreep' },
	{ label: 'upgradePowerCreep' },
	{ label: 'renamePowerCreep' },
] as const;

export type IntentLimitCase = typeof intentLimitCases[number];
