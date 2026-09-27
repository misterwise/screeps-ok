import { ERR_BUSY, ERR_INVALID_TARGET, ERR_NOT_IN_RANGE, ERR_NOT_OWNER } from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const movePullValidationCases = makeValidationCases('MOVE-PULL-011', [
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'busy', expectedRc: ERR_BUSY },
	{ condition: 'invalid-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'self', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'spawning-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'range', expectedRc: ERR_NOT_IN_RANGE },
] as const, [
	['invalid-target', 'self'],
	['invalid-target', 'spawning-target'],
	['self', 'spawning-target'],
	['self', 'range'],
]);

export type MovePullValidationCase = typeof movePullValidationCases[number];
