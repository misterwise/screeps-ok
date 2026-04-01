/**
 * Branded type for player code strings. runPlayer accepts only PlayerCode,
 * not raw strings. Produced exclusively by the code`` tagged template.
 */
declare const PlayerCodeBrand: unique symbol;
export type PlayerCode = string & { [PlayerCodeBrand]: true };

/**
 * Tagged template that safely interpolates values into player code.
 *
 * Each interpolated value is JSON.stringify'd at evaluation time, producing
 * a safe string/number literal in the generated code. This prevents code
 * injection regardless of the value's content.
 *
 * @example
 * ```ts
 * const id = await shard.placeCreep(...);
 * await shard.runPlayer('p1', code`
 *   Game.getObjectById(${id}).move(TOP);
 * `);
 * ```
 */
export function code(strings: TemplateStringsArray, ...values: unknown[]): PlayerCode {
	let result = strings[0];
	for (let i = 0; i < values.length; i++) {
		result += JSON.stringify(values[i]);
		result += strings[i + 1];
	}
	return result as PlayerCode;
}
