/**
 * Build a body part array concisely.
 *
 * Accepts alternating (count, part) pairs:
 *   body(3, 'work', 1, 'carry', 1, 'move')  →  ['work','work','work','carry','move']
 *
 * Single parts can omit the count:
 *   body('work', 'carry', 'move')  →  ['work','carry','move']
 */
export function body(...args: (string | number)[]): string[] {
	const result: string[] = [];
	let i = 0;
	while (i < args.length) {
		if (typeof args[i] === 'number') {
			const count = args[i] as number;
			const part = args[i + 1] as string;
			for (let j = 0; j < count; j++) result.push(part);
			i += 2;
		} else {
			result.push(args[i] as string);
			i++;
		}
	}
	return result;
}
