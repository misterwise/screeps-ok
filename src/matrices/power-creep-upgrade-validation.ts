import {
	ERR_FULL, ERR_INVALID_ARGS, ERR_NOT_ENOUGH_RESOURCES, ERR_NOT_OWNER,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

// A level requirement belongs to a valid power, and no requirement exceeds the
// max creep level, so it cannot pair with either of those conditions.
export const powerCreepUpgradeValidationCases = makeValidationCases('POWERCREEP-UPGRADE-002', [
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'no-free-levels', expectedRc: ERR_NOT_ENOUGH_RESOURCES },
	{ condition: 'max-level', expectedRc: ERR_FULL },
	{ condition: 'invalid-power', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'level-requirement', expectedRc: ERR_FULL },
] as const, [
	['max-level', 'level-requirement'],
	['invalid-power', 'level-requirement'],
]);

export type PowerCreepUpgradeValidationCase = typeof powerCreepUpgradeValidationCases[number];
