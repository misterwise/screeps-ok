import {
	ERR_FULL, ERR_INVALID_ARGS, ERR_NOT_ENOUGH_RESOURCES, ERR_NOT_OWNER,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

// game/power-creeps.js:217-240. A power at level 5 has no next level to require, and an invalid power no level
// at all; no level requirement exceeds the max creep level.
export const powerCreepUpgradeValidationCases = makeValidationCases('POWERCREEP-UPGRADE-002', [
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'no-free-levels', expectedRc: ERR_NOT_ENOUGH_RESOURCES },
	{ condition: 'max-level', expectedRc: ERR_FULL },
	{ condition: 'invalid-power', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'power-max-level', expectedRc: ERR_FULL },
	{ condition: 'level-requirement', expectedRc: ERR_FULL },
] as const, [
	['max-level', 'level-requirement'],
	['invalid-power', 'power-max-level'],
	['invalid-power', 'level-requirement'],
	['power-max-level', 'level-requirement'],
]);

export type PowerCreepUpgradeValidationCase = typeof powerCreepUpgradeValidationCases[number];
