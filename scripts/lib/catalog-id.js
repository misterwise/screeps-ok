// The one catalog id shape every tool reads: FAMILY-001 or FAMILY-SUBFAMILY-001,
// and in test names and registrations optionally keyed by a camelCase `:row`.
const BASE = '[A-Z]+-(?:[A-Z]+-)?[0-9]{3}';
const KEYED = `${BASE}(?::[a-zA-Z][a-zA-Z0-9]*)?`;

export const CATALOG_ID_RE = new RegExp(`^${BASE}$`);
export const TEST_ID_RE = new RegExp(`^${KEYED}$`);

// A token that runs on into more id characters (`-003b`, `-OPS-001`, `:not-owner`) is no id at all.
const ID_IN_TEXT_RE = new RegExp(`(?<![\\w-])${KEYED}(?![\\w-]|:\\w)`, 'g');

export function catalogIdsIn(text) {
	return [...text.matchAll(ID_IN_TEXT_RE)].map(m => m[0]);
}

// The ids a document names that aren't catalog rows, with their 1-based lines.
export function unknownCatalogIds(text, rowIds) {
	return text.split('\n').flatMap((line, i) => catalogIdsIn(line)
		.map(baseCatalogId)
		.filter(id => !rowIds.has(id))
		.map(id => ({ id, line: i + 1 })));
}

// Comments name rows a file deliberately leaves to another; only code claims them.
export function stripComments(source) {
	return source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
}

// Tests in a numbered catalog section each carry one catalog id; the 00-*
// sections test the framework and the adapter contract.
export function isCatalogTestFile(file) {
	return /[\\/]tests[\\/](?!00-)[0-9]{2}-[^\\/]+[\\/]/.test(file);
}

// A test file's path from its suite root (`tests/…`), wherever the run's checkout or install was.
export function suitePath(file) {
	const parts = file.split(/[\\/]/);
	const at = parts.findLastIndex(part => /^tests(?:-\w+)?$/.test(part));
	return at === -1 ? file : parts.slice(at).join('/');
}

export function baseCatalogId(id) {
	return id.split(':')[0];
}

// A describe may repeat the bare id over its tests' `:row` ids; the row wins.
// Null when the name carries no id, two ids, or two rows.
export function testCatalogId(fullName) {
	const ids = new Set(catalogIdsIn(fullName));
	const bases = new Set([...ids].map(baseCatalogId));
	const keyed = [...ids].filter(id => id.includes(':'));
	if (bases.size !== 1 || keyed.length > 1) return null;
	return keyed[0] ?? [...bases][0];
}
