import {
	ERR_BUSY, ERR_INVALID_TARGET, ERR_NOT_ENOUGH_RESOURCES, ERR_NOT_IN_RANGE, ERR_NOT_OWNER,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const ctrlGensafeValidationCases = makeValidationCases('CTRL-GENSAFE-005', [
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'busy', expectedRc: ERR_BUSY },
	{ condition: 'not-enough', expectedRc: ERR_NOT_ENOUGH_RESOURCES },
	{ condition: 'invalid-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'range', expectedRc: ERR_NOT_IN_RANGE },
] as const);

export type CtrlGensafeValidationCase = typeof ctrlGensafeValidationCases[number];
