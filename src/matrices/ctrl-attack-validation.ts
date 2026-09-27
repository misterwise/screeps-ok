import {
	ERR_BUSY, ERR_INVALID_TARGET, ERR_NO_BODYPART, ERR_NOT_IN_RANGE, ERR_NOT_OWNER, ERR_TIRED,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const ctrlAttackValidationCases = makeValidationCases('CTRL-ATTACK-007', [
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'busy', expectedRc: ERR_BUSY },
	{ condition: 'invalid-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'no-bodypart', expectedRc: ERR_NO_BODYPART },
	{ condition: 'range', expectedRc: ERR_NOT_IN_RANGE },
	{ condition: 'invalid-controller-state', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'cooldown', expectedRc: ERR_TIRED },
	{ condition: 'safe-mode', expectedRc: ERR_NO_BODYPART },
	// game/creeps.js:911: a stronghold's controller (InvaderCoreSpec.ownsController).
	{ condition: 'invulnerable', expectedRc: ERR_INVALID_TARGET },
] as const, [
	// A spawning creep's room is its owner's, and a neutral controller's room has no safe mode.
	['busy', 'safe-mode'],
	['invalid-controller-state', 'safe-mode'],
	// A source replaces the controller the rest describe.
	['invalid-target', 'invalid-controller-state'],
	['invalid-target', 'cooldown'],
	['invalid-target', 'invulnerable'],
	['invalid-controller-state', 'cooldown'],
	// An invulnerable controller is owned, runs no safe mode, and takes neither an attack nor a nuke's hit
	// to block its upgrades (creeps.js:911, nukes/tick.js:71).
	['invalid-controller-state', 'invulnerable'],
	['cooldown', 'invulnerable'],
	['safe-mode', 'invulnerable'],
]);

export type CtrlAttackValidationCase = typeof ctrlAttackValidationCases[number];
