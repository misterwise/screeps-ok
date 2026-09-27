import {
	ERR_FULL, ERR_INVALID_ARGS, ERR_INVALID_TARGET, ERR_NOT_ENOUGH_RESOURCES,
	ERR_NOT_IN_RANGE, ERR_NOT_OWNER, ERR_RCL_NOT_ENOUGH, ERR_TIRED,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const labRunValidationCases = makeValidationCases('LAB-RUN-013', [
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'cooldown', expectedRc: ERR_TIRED },
	{ condition: 'rcl', expectedRc: ERR_RCL_NOT_ENOUGH },
	{ condition: 'invalid-lab1', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'invalid-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'not-a-lab', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'self-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'range-lab1', expectedRc: ERR_NOT_IN_RANGE },
	{ condition: 'range', expectedRc: ERR_NOT_IN_RANGE },
	{ condition: 'full', expectedRc: ERR_FULL },
	{ condition: 'not-enough-lab1', expectedRc: ERR_NOT_ENOUGH_RESOURCES },
	{ condition: 'not-enough', expectedRc: ERR_NOT_ENOUGH_RESOURCES },
	{ condition: 'no-product', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'invalid-args', expectedRc: ERR_INVALID_ARGS },
] as const, [
	// A container as lab1 has no range, store or mineral to fail on.
	['invalid-lab1', 'range-lab1'],
	['invalid-lab1', 'not-enough-lab1'],
	['invalid-lab1', 'no-product'],
	// The forms of lab2 exclude each other, and a lab2 that isn't another lab
	// has no range, store or mineral to fail on.
	['invalid-target', 'not-a-lab'],
	['invalid-target', 'self-target'],
	['invalid-target', 'no-product'],
	['not-a-lab', 'self-target'],
	['not-a-lab', 'range'],
	['not-a-lab', 'not-enough'],
	['not-a-lab', 'no-product'],
	['self-target', 'range'],
	['self-target', 'not-enough'],
	['self-target', 'no-product'],
]);

export type LabRunValidationCase = typeof labRunValidationCases[number];
