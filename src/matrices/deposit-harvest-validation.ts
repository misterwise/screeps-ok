import {
	ERR_BUSY, ERR_INVALID_TARGET, ERR_NO_BODYPART, ERR_NOT_IN_RANGE, ERR_NOT_OWNER, ERR_TIRED,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const depositHarvestValidationCases = makeValidationCases('DEPOSIT-HARVEST-006', [
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'busy', expectedRc: ERR_BUSY },
	{ condition: 'no-bodypart', expectedRc: ERR_NO_BODYPART },
	{ condition: 'invalid-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'range', expectedRc: ERR_NOT_IN_RANGE },
	{ condition: 'cooldown', expectedRc: ERR_TIRED },
] as const);

export type DepositHarvestValidationCase = typeof depositHarvestValidationCases[number];
