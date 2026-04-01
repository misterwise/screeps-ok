/**
 * Errors that originate from player code execution, not from gameplay.
 * Adapters wrap syntax errors, reference errors, and type errors from
 * the player code string into this type.
 *
 * This is distinct from gameplay error codes (ERR_NOT_IN_RANGE, etc.)
 * which are normal return values. A RunPlayerError means the test
 * itself is broken, not that the engine disagrees on behavior.
 */
export class RunPlayerError extends Error {
	/** The original error message from the engine's VM. */
	readonly engineMessage: string;
	/** 'syntax' | 'runtime' | 'serialization' */
	readonly errorKind: 'syntax' | 'runtime' | 'serialization';

	constructor(errorKind: 'syntax' | 'runtime' | 'serialization', engineMessage: string) {
		super(`RunPlayerError [${errorKind}]: ${engineMessage}`);
		this.name = 'RunPlayerError';
		this.errorKind = errorKind;
		this.engineMessage = engineMessage;
	}
}
