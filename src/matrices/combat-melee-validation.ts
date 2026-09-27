import {
	ERR_BUSY, ERR_INVALID_TARGET, ERR_NO_BODYPART, ERR_NOT_IN_RANGE, ERR_NOT_OWNER,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const combatMeleeValidationCases = makeValidationCases('COMBAT-MELEE-009', [
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'busy', expectedRc: ERR_BUSY },
	{ condition: 'no-bodypart', expectedRc: ERR_NO_BODYPART },
	{ condition: 'safe-mode', expectedRc: ERR_NO_BODYPART },
	{ condition: 'invalid-target', expectedRc: ERR_INVALID_TARGET },
	// game/creeps.js:613: a PWR_FORTIFY or EFFECT_INVULNERABILITY effect on the target.
	{ condition: 'fortified', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'range', expectedRc: ERR_NOT_IN_RANGE },
] as const, [
	// A spawning creep's room is its owner's, never in another player's safe mode.
	['busy', 'safe-mode'],
	// A source replaces the fortified rampart.
	['invalid-target', 'fortified'],
]);

export type CombatMeleeValidationCase = typeof combatMeleeValidationCases[number];
