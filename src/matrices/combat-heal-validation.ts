import {
	ERR_BUSY, ERR_INVALID_TARGET, ERR_NO_BODYPART, ERR_NOT_IN_RANGE, ERR_NOT_OWNER,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const combatHealValidationCases = makeValidationCases('COMBAT-HEAL-007', [
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'busy', expectedRc: ERR_BUSY },
	{ condition: 'no-bodypart', expectedRc: ERR_NO_BODYPART },
	{ condition: 'invalid-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'range', expectedRc: ERR_NOT_IN_RANGE },
] as const);

export type CombatHealValidationCase = typeof combatHealValidationCases[number];
