import {
	ERR_BUSY, ERR_INVALID_TARGET, ERR_NO_BODYPART, ERR_NOT_IN_RANGE, ERR_NOT_OWNER,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const ctrlReserveValidationCases = makeValidationCases('CTRL-RESERVE-008', [
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'busy', expectedRc: ERR_BUSY },
	{ condition: 'invalid-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'range', expectedRc: ERR_NOT_IN_RANGE },
	{ condition: 'invalid-controller-state', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'no-bodypart', expectedRc: ERR_NO_BODYPART },
] as const);

export type CtrlReserveValidationCase = typeof ctrlReserveValidationCases[number];
