import { ERR_BUSY, ERR_INVALID_TARGET, ERR_NOT_IN_RANGE } from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const ctrlSignValidationCases = makeValidationCases('CTRL-SIGN-004', [
	{ condition: 'busy', expectedRc: ERR_BUSY },
	{ condition: 'invalid-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'range', expectedRc: ERR_NOT_IN_RANGE },
	{ condition: 'not-controller', expectedRc: ERR_INVALID_TARGET },
] as const, [
	['invalid-target', 'range'],
	['invalid-target', 'not-controller'],
]);

export type CtrlSignValidationCase = typeof ctrlSignValidationCases[number];
