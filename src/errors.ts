/**
 * Errors that originate from player code execution, not from gameplay.
 * Adapters wrap syntax errors, reference errors, and type errors from
 * the player code string into this type.
 *
 * This is distinct from gameplay error codes (ERR_NOT_IN_RANGE, etc.)
 * which are normal return values. A RunPlayerError means the test
 * itself is broken, not that the engine disagrees on behavior.
 */
// `instanceof` is brittle when multiple copies of this module exist (e.g.
// vitest SSR inlines the fixture but externalizes the package entry point,
// or the adapter lives outside node_modules and resolves via a self-link).
// Overriding Symbol.hasInstance lets any copy of the class recognize
// instances created by any other copy — the marker is a Symbol.for() so
// it is deterministic across realms and module graphs.
const MARKER = Symbol.for('screeps-ok.RunPlayerError');

export class RunPlayerError extends Error {
	/** The original error message from the engine's VM. */
	readonly engineMessage: string;
	/** 'syntax' | 'runtime' | 'serialization' */
	readonly errorKind: 'syntax' | 'runtime' | 'serialization';
	readonly [MARKER] = true;

	constructor(errorKind: 'syntax' | 'runtime' | 'serialization', engineMessage: string) {
		super(`RunPlayerError [${errorKind}]: ${engineMessage}`);
		this.name = 'RunPlayerError';
		this.errorKind = errorKind;
		this.engineMessage = engineMessage;
	}

	static [Symbol.hasInstance](v: unknown): boolean {
		return (
			typeof v === 'object' && v !== null &&
			(v as Record<symbol, unknown>)[MARKER] === true
		);
	}
}
