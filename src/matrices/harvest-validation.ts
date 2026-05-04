import {
	ERR_BUSY, ERR_INVALID_TARGET, ERR_NO_BODYPART, ERR_NOT_ENOUGH_RESOURCES,
	ERR_NOT_IN_RANGE, ERR_NOT_OWNER,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const harvestValidationCases = makeValidationCases('HARVEST-015', [
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'busy', expectedRc: ERR_BUSY },
	{ condition: 'no-bodypart', expectedRc: ERR_NO_BODYPART },
	{ condition: 'invalid-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'depleted', expectedRc: ERR_NOT_ENOUGH_RESOURCES },
	{ condition: 'range', expectedRc: ERR_NOT_IN_RANGE },
	{ condition: 'hostile-room', expectedRc: ERR_NOT_OWNER },
] as const, [
	['busy', 'hostile-room'],
]);

export type HarvestValidationCase = typeof harvestValidationCases[number];
