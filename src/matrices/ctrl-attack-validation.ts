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
] as const, [
	['invalid-controller-state', 'cooldown'],
]);

export type CtrlAttackValidationCase = typeof ctrlAttackValidationCases[number];
