import {
	ERR_FULL, ERR_INVALID_ARGS, ERR_INVALID_TARGET, ERR_NOT_ENOUGH_RESOURCES,
	ERR_NOT_IN_RANGE, ERR_NOT_OWNER, ERR_RCL_NOT_ENOUGH, ERR_TIRED,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const labReverseValidationCases = makeValidationCases('LAB-REVERSE-013', [
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'cooldown', expectedRc: ERR_TIRED },
	{ condition: 'rcl', expectedRc: ERR_RCL_NOT_ENOUGH },
	{ condition: 'invalid-lab1', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'invalid-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'not-a-lab', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'self-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'range', expectedRc: ERR_NOT_IN_RANGE },
	{ condition: 'range-lab2', expectedRc: ERR_NOT_IN_RANGE },
	{ condition: 'same-lab', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'not-enough', expectedRc: ERR_NOT_ENOUGH_RESOURCES },
	{ condition: 'invalid-reverse-pair', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'full', expectedRc: ERR_FULL },
	{ condition: 'full-lab2', expectedRc: ERR_FULL },
] as const, [
	// A container as lab1 has no range or store to fail on.
	['invalid-lab1', 'range'],
	['invalid-lab1', 'full'],
	// The forms of lab2 exclude each other; same-lab sets lab2 too, and a lab2
	// that isn't another lab has no range or store to fail on.
	['invalid-target', 'not-a-lab'],
	['invalid-target', 'self-target'],
	['invalid-target', 'range-lab2'],
	['invalid-target', 'same-lab'],
	['invalid-target', 'full-lab2'],
	['not-a-lab', 'self-target'],
	['not-a-lab', 'range-lab2'],
	['not-a-lab', 'same-lab'],
	['not-a-lab', 'full-lab2'],
	['self-target', 'range-lab2'],
	['self-target', 'same-lab'],
	['self-target', 'full-lab2'],
	['range-lab2', 'same-lab'],
	['same-lab', 'full-lab2'],
]);

export type LabReverseValidationCase = typeof labReverseValidationCases[number];
