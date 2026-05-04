import {
	ERR_INVALID_TARGET, ERR_NOT_IN_RANGE, ERR_NOT_OWNER,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const recycleCreepValidationCases = makeValidationCases('RECYCLE-CREEP-005', [
	{ condition: 'not-owner-spawn', expectedRc: ERR_NOT_OWNER },
	{ condition: 'invalid-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'not-owner-creep', expectedRc: ERR_NOT_OWNER },
	{ condition: 'range', expectedRc: ERR_NOT_IN_RANGE },
] as const);

export type RecycleCreepValidationCase = typeof recycleCreepValidationCases[number];
