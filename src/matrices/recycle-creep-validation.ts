import {
	ERR_INVALID_TARGET, ERR_NOT_IN_RANGE, ERR_NOT_OWNER, ERR_RCL_NOT_ENOUGH,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const recycleCreepValidationCases = makeValidationCases('RECYCLE-CREEP-005', [
	{ condition: 'not-owner-spawn', expectedRc: ERR_NOT_OWNER },
	{ condition: 'invalid-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'rcl', expectedRc: ERR_RCL_NOT_ENOUGH },
	{ condition: 'not-owner-creep', expectedRc: ERR_NOT_OWNER },
	{ condition: 'range', expectedRc: ERR_NOT_IN_RANGE },
] as const, [
	// A source has no owner.
	['invalid-target', 'not-owner-creep'],
]);

export type RecycleCreepValidationCase = typeof recycleCreepValidationCases[number];
