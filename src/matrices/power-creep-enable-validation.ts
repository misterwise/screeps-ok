import {
	ERR_BUSY, ERR_INVALID_TARGET, ERR_NOT_IN_RANGE, ERR_NOT_OWNER,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const powerCreepEnableValidationCases = makeValidationCases('POWERCREEP-ENABLE-002', [
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'busy', expectedRc: ERR_BUSY },
	{ condition: 'invalid-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'range', expectedRc: ERR_NOT_IN_RANGE },
	{ condition: 'not-controller', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'safe-mode', expectedRc: ERR_INVALID_TARGET },
] as const, [
	// Another player's unspawned power creep isn't visible, and an unspawned one has no position.
	['not-owner', 'busy'],
	['busy', 'range'],
	// A source is no structure; the other two are properties of a structure or a controller.
	['invalid-target', 'not-controller'],
	['invalid-target', 'safe-mode'],
	['not-controller', 'safe-mode'],
]);

export type PowerCreepEnableValidationCase = typeof powerCreepEnableValidationCases[number];
