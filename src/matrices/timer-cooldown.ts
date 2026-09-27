import type { CapabilityName } from '../adapter.js';

// TIMER-COOLDOWN-001: each action vanilla refuses with ERR_TIRED on a cooldown its
// player getter exposes (game/structures.js:321,364,454,504,730,1370,1439;
// market.js:134; creeps.js:383,391; power-creeps.js:268).
export interface TimerCooldownCase {
	readonly action: string;
	readonly capability?: CapabilityName;
}

export const timerCooldownCases: readonly TimerCooldownCase[] = [
	{ action: 'runReaction', capability: 'chemistry' },
	{ action: 'reverseReaction', capability: 'chemistry' },
	{ action: 'unboostCreep', capability: 'chemistry' },
	{ action: 'transferEnergy' },
	{ action: 'send', capability: 'terminalSend' },
	{ action: 'deal', capability: 'market' },
	{ action: 'launchNuke', capability: 'nuke' },
	{ action: 'produce', capability: 'factory' },
	// The extractor's cooldown, then the deposit's.
	{ action: 'harvestMineral' },
	{ action: 'harvestDeposit', capability: 'deposit' },
	{ action: 'usePower', capability: 'powerCreeps' },
];
