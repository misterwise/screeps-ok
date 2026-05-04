import {
	ERR_INVALID_TARGET, ERR_NOT_ENOUGH_ENERGY, ERR_NOT_OWNER, ERR_RCL_NOT_ENOUGH,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const towerRepairValidationCases = makeValidationCases('TOWER-REPAIR-005', [
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'invalid-target', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'not-enough', expectedRc: ERR_NOT_ENOUGH_ENERGY },
	{ condition: 'rcl', expectedRc: ERR_RCL_NOT_ENOUGH },
] as const);

export type TowerRepairValidationCase = typeof towerRepairValidationCases[number];
