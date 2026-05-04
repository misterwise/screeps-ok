import {
	ERR_FULL, ERR_INVALID_ARGS, ERR_INVALID_TARGET, ERR_NOT_ENOUGH_RESOURCES,
	ERR_NOT_IN_RANGE, ERR_NOT_OWNER, ERR_RCL_NOT_ENOUGH, ERR_TIRED,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const labReverseValidationCases = makeValidationCases('LAB-REVERSE-013', [
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'cooldown', expectedRc: ERR_TIRED },
	{ condition: 'rcl', expectedRc: ERR_RCL_NOT_ENOUGH },
	{ condition: 'invalid-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'range', expectedRc: ERR_NOT_IN_RANGE },
	{ condition: 'same-lab', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'not-enough', expectedRc: ERR_NOT_ENOUGH_RESOURCES },
	{ condition: 'invalid-reverse-pair', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'full', expectedRc: ERR_FULL },
] as const);

export type LabReverseValidationCase = typeof labReverseValidationCases[number];
