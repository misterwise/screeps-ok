import { ERR_INVALID_ARGS, ERR_INVALID_TARGET, ERR_NO_BODYPART, ERR_NOT_OWNER } from '../constants.js';

// Each action a room's safe mode refuses a hostile caller, the code the
// refusal returns, and what the caller acts on. Creep intents share the
// guard `!this.room.controller.my && this.room.controller.safeMode`
// (game/creeps.js); a power creep's are game/power-creeps.js:258 and :311.
export type TimerSafeModeTarget = 'rampart' | 'container' | 'friendlyCreep' | 'controller' | 'none';

export interface TimerSafeModeCase {
	readonly action: string;
	readonly target: TimerSafeModeTarget;
	readonly refusedRc: number;
	readonly powerCreep: boolean;
}

export const timerSafeModeCases: readonly TimerSafeModeCase[] = [
	{ action: 'attack', target: 'rampart', refusedRc: ERR_NO_BODYPART, powerCreep: false },
	{ action: 'rangedAttack', target: 'rampart', refusedRc: ERR_NO_BODYPART, powerCreep: false },
	{ action: 'rangedMassAttack', target: 'none', refusedRc: ERR_NO_BODYPART, powerCreep: false },
	{ action: 'dismantle', target: 'rampart', refusedRc: ERR_NO_BODYPART, powerCreep: false },
	{ action: 'withdraw', target: 'container', refusedRc: ERR_NOT_OWNER, powerCreep: false },
	{ action: 'heal', target: 'friendlyCreep', refusedRc: ERR_NO_BODYPART, powerCreep: false },
	{ action: 'rangedHeal', target: 'friendlyCreep', refusedRc: ERR_NO_BODYPART, powerCreep: false },
	{ action: 'attackController', target: 'controller', refusedRc: ERR_NO_BODYPART, powerCreep: false },
	{ action: 'usePower', target: 'none', refusedRc: ERR_INVALID_ARGS, powerCreep: true },
	{ action: 'enableRoom', target: 'controller', refusedRc: ERR_INVALID_TARGET, powerCreep: true },
];
