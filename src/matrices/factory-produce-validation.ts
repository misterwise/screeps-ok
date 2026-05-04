import {
	ERR_BUSY, ERR_FULL, ERR_INVALID_ARGS, ERR_INVALID_TARGET,
	ERR_NOT_ENOUGH_RESOURCES, ERR_NOT_OWNER, ERR_RCL_NOT_ENOUGH, ERR_TIRED,
} from '../constants.js';
import { makeValidationCases } from './validation-cases.js';

export const factoryProduceValidationCases = makeValidationCases('FACTORY-PRODUCE-011', [
	{ condition: 'not-owner', expectedRc: ERR_NOT_OWNER },
	{ condition: 'cooldown', expectedRc: ERR_TIRED },
	{ condition: 'invalid-args', expectedRc: ERR_INVALID_ARGS },
	{ condition: 'level-mismatch', expectedRc: ERR_INVALID_TARGET },
	{ condition: 'rcl', expectedRc: ERR_RCL_NOT_ENOUGH },
	{ condition: 'power-effect', expectedRc: ERR_BUSY },
	{ condition: 'not-enough', expectedRc: ERR_NOT_ENOUGH_RESOURCES },
	{ condition: 'full', expectedRc: ERR_FULL },
] as const, [
	['level-mismatch', 'full'],
	['power-effect', 'full'],
]);

export type FactoryProduceValidationCase = typeof factoryProduceValidationCases[number];
