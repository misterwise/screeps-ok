import {
	ERR_INVALID_ARGS, ERR_NOT_IN_RANGE, ERR_NOT_OWNER, ERR_RCL_NOT_ENOUGH,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const observerValidationCases = makeValidationCases('OBSERVER-007', [
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'invalid-args', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'rcl', expectedRc: ERR_RCL_NOT_ENOUGH },
	{ condition: 'range', expectedRc: ERR_NOT_IN_RANGE },
] as const);

export type ObserverValidationCase = typeof observerValidationCases[number];
