// Canonical creep intents that the vanilla API short-circuits when the
// creep stands in a room whose controller is foreign and currently in safe
// mode. Each case records the method, the kind of target to place, and
// the return code the Creep prototype emits from its safe-mode guard.
//
// Source audit (@screeps/engine):
//   - src/game/creeps.js — API-level guards of shape
//     `!this.room.controller.my && this.room.controller.safeMode`.
//   - src/processor/intents/creeps/*.js — matching processor-side blocks
//     for every listed intent except attackController, which relies on
//     the API guard exclusively (the processor guard also exists, so both
//     layers enforce the block uniformly for intents here).
//
// claimController has an API-level guard in the source, but it is
// unreachable: a safe-moded room's controller is always level >= 1, and
// claimController rejects any target with level > 0 before the safe-mode
// check is evaluated. It is therefore not part of the player-observable
// blocked set.
//
// Target kinds used by the test harness:
//   - 'rampart'        : owner-placed rampart in the safe-moded room
//   - 'container'      : container with resources in the safe-moded room
//   - 'friendlyCreep'  : another creep owned by the acting hostile player
//   - 'controller'     : the safe-moded room's controller

export type SafeModeBlockedTargetKind =
	| 'rampart'
	| 'container'
	| 'friendlyCreep'
	| 'controller';

export interface SafeModeBlockedCase {
	readonly label: string;
	readonly method: string;
	readonly target: SafeModeBlockedTargetKind;
	readonly expectedRc: number;
}

// Return-code literals; constants are not imported here to keep matrix
// definitions free of runtime cycles.
const ERR_NOT_OWNER = -1;
const ERR_NO_BODYPART = -12;

export const safeModeBlockedActionCases: readonly SafeModeBlockedCase[] = [
	{ label: 'attack', method: 'attack', target: 'rampart', expectedRc: ERR_NO_BODYPART },
	{ label: 'rangedAttack', method: 'rangedAttack', target: 'rampart', expectedRc: ERR_NO_BODYPART },
	{ label: 'rangedMassAttack', method: 'rangedMassAttack', target: 'rampart', expectedRc: ERR_NO_BODYPART },
	{ label: 'dismantle', method: 'dismantle', target: 'rampart', expectedRc: ERR_NO_BODYPART },
	{ label: 'withdraw', method: 'withdraw', target: 'container', expectedRc: ERR_NOT_OWNER },
	{ label: 'heal', method: 'heal', target: 'friendlyCreep', expectedRc: ERR_NO_BODYPART },
	{ label: 'rangedHeal', method: 'rangedHeal', target: 'friendlyCreep', expectedRc: ERR_NO_BODYPART },
	{ label: 'attackController', method: 'attackController', target: 'controller', expectedRc: ERR_NO_BODYPART },
];
