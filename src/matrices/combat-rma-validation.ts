import { ERR_BUSY, ERR_NO_BODYPART, ERR_NOT_OWNER } from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const combatRmaValidationCases = makeValidationCases('COMBAT-RMA-005', [
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'busy', expectedRc: ERR_BUSY },
	{ condition: 'no-bodypart', expectedRc: ERR_NO_BODYPART },
] as const);

export type CombatRmaValidationCase = typeof combatRmaValidationCases[number];
