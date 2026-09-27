import {
	ERR_BUSY, ERR_INVALID_TARGET, ERR_NO_BODYPART, ERR_NOT_ENOUGH_RESOURCES,
	ERR_NOT_IN_RANGE, ERR_NOT_OWNER,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const harvestValidationCases = makeValidationCases('HARVEST-015', [
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'busy', expectedRc: ERR_BUSY },
	{ condition: 'no-bodypart', expectedRc: ERR_NO_BODYPART },
	{ condition: 'no-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'null-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'plain-object-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'invalid-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'depleted', expectedRc: ERR_NOT_ENOUGH_RESOURCES },
	{ condition: 'range', expectedRc: ERR_NOT_IN_RANGE },
	{ condition: 'hostile-room', expectedRc: ERR_NOT_OWNER },
	{ condition: 'hostile-reservation', expectedRc: ERR_NOT_OWNER },
] as const, [
	['busy', 'hostile-room'],
	['busy', 'hostile-reservation'],
	['no-target', 'null-target'],
	['no-target', 'plain-object-target'],
	['no-target', 'invalid-target'],
	['no-target', 'depleted'],
	['no-target', 'range'],
	['null-target', 'plain-object-target'],
	['null-target', 'invalid-target'],
	['null-target', 'depleted'],
	['null-target', 'range'],
	['plain-object-target', 'invalid-target'],
	['plain-object-target', 'depleted'],
	['plain-object-target', 'range'],
	['invalid-target', 'depleted'],
	['hostile-room', 'hostile-reservation'],
]);

export type HarvestValidationCase = typeof harvestValidationCases[number];
