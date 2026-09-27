import {
	ERR_INVALID_ARGS, ERR_INVALID_TARGET, ERR_NOT_ENOUGH_RESOURCES, ERR_NOT_IN_RANGE,
	ERR_NOT_OWNER, ERR_RCL_NOT_ENOUGH, ERR_TIRED,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const nukeLaunchValidationCases = makeValidationCases('NUKE-LAUNCH-008', [
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'invalid-argument-shape', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'novice-source', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'respawn-source', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'novice-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'respawn-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'cooldown', expectedRc: ERR_TIRED },
	{ condition: 'inactive-rcl', expectedRc: ERR_RCL_NOT_ENOUGH },
	{ condition: 'out-of-range', expectedRc: ERR_NOT_IN_RANGE },
	{ condition: 'missing-energy', expectedRc: ERR_NOT_ENOUGH_RESOURCES },
	{ condition: 'missing-ghodium', expectedRc: ERR_NOT_ENOUGH_RESOURCES },
] as const, [
	// The four room statuses are one expression (game/structures.js:1363-1369), as are both stocks (:1382).
	['novice-source', 'respawn-source'],
	['novice-source', 'novice-target'],
	['novice-source', 'respawn-target'],
	['respawn-source', 'novice-target'],
	['respawn-source', 'respawn-target'],
	['novice-target', 'respawn-target'],
	['missing-energy', 'missing-ghodium'],
]);

export type NukeLaunchValidationCase = typeof nukeLaunchValidationCases[number];
