import {
	ERR_BUSY, ERR_INVALID_ARGS, ERR_NO_BODYPART, ERR_NOT_OWNER, ERR_TIRED,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const moveBasicValidationCases = makeValidationCases('MOVE-BASIC-027', [
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'busy', expectedRc: ERR_BUSY },
	{ condition: 'fatigue', expectedRc: ERR_TIRED },
	{ condition: 'no-bodypart', expectedRc: ERR_NO_BODYPART },
	{ condition: 'invalid-args', expectedRc: ERR_INVALID_ARGS },
] as const, [
	['busy', 'fatigue'],
	['fatigue', 'no-bodypart'],
]);

export type MoveBasicValidationCase = typeof moveBasicValidationCases[number];
