import {
	ERR_BUSY, ERR_FULL, ERR_INVALID_ARGS, ERR_INVALID_TARGET,
	ERR_NOT_ENOUGH_RESOURCES, ERR_NOT_IN_RANGE, ERR_NOT_OWNER,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const withdrawValidationCases = makeValidationCases('WITHDRAW-017', [
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'busy', expectedRc: ERR_BUSY },
	{ condition: 'invalid-args', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'invalid-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'target-not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'safemode-not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'invalid-nuker', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'invalid-capacity', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'range', expectedRc: ERR_NOT_IN_RANGE },
	{ condition: 'full', expectedRc: ERR_FULL },
	{ condition: 'full-amount', expectedRc: ERR_FULL },
	{ condition: 'not-enough', expectedRc: ERR_NOT_ENOUGH_RESOURCES },
] as const, [
	['busy', 'safemode-not-owner'],
]);

export type WithdrawValidationCase = typeof withdrawValidationCases[number];
