import type { CatalogEntry } from './parse-catalog.js';

export function catalogLabelErrors(
	entries: CatalogEntry[],
	tested: Set<string>,
	vanilla: { unsupported: Set<string>; registered: Set<string> },
): string[];
