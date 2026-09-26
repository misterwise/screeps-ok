import {
	ERR_BUSY, ERR_INVALID_TARGET, ERR_NOT_OWNER, ERR_RCL_NOT_ENOUGH, ERR_TIRED,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

// A spawned creep carries no spawn cooldown, and the ownership and RCL checks
// are about the power spawn, so they only apply when the target is one.
export const powerCreepSpawnValidationCases = makeValidationCases('POWERCREEP-SPAWN-002', [
	{ condition: 'busy', expectedRc: ERR_BUSY },
	{ condition: 'invalid-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'rcl', expectedRc: ERR_RCL_NOT_ENOUGH },
	{ condition: 'cooldown', expectedRc: ERR_TIRED },
] as const, [
	['busy', 'cooldown'],
	['invalid-target', 'not-owner'],
	['invalid-target', 'rcl'],
]);

export type PowerCreepSpawnValidationCase = typeof powerCreepSpawnValidationCases[number];
