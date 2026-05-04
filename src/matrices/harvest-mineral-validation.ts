import {
	ERR_BUSY, ERR_INVALID_TARGET, ERR_NO_BODYPART, ERR_NOT_ENOUGH_RESOURCES,
	ERR_NOT_FOUND, ERR_NOT_IN_RANGE, ERR_NOT_OWNER, ERR_RCL_NOT_ENOUGH, ERR_TIRED,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const harvestMineralValidationCases = makeValidationCases('HARVEST-MINERAL-014', [
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'busy', expectedRc: ERR_BUSY },
	{ condition: 'no-bodypart', expectedRc: ERR_NO_BODYPART },
	{ condition: 'invalid-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'depleted', expectedRc: ERR_NOT_ENOUGH_RESOURCES },
	{ condition: 'range', expectedRc: ERR_NOT_IN_RANGE },
	{ condition: 'no-extractor', expectedRc: ERR_NOT_FOUND },
	{ condition: 'extractor-not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'inactive-extractor', expectedRc: ERR_RCL_NOT_ENOUGH },
	{ condition: 'cooldown', expectedRc: ERR_TIRED },
] as const);

export type HarvestMineralValidationCase = typeof harvestMineralValidationCases[number];
