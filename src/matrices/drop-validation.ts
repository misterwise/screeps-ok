import {
	ERR_BUSY, ERR_INVALID_ARGS, ERR_NOT_ENOUGH_RESOURCES, ERR_NOT_OWNER,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const dropValidationCases = makeValidationCases('DROP-011', [
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'busy', expectedRc: ERR_BUSY },
	{ condition: 'invalid-args', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'not-enough', expectedRc: ERR_NOT_ENOUGH_RESOURCES },
	{ condition: 'not-enough-amount', expectedRc: ERR_NOT_ENOUGH_RESOURCES },
] as const, [
	['not-enough', 'not-enough-amount'],
]);

export type DropValidationCase = typeof dropValidationCases[number];
