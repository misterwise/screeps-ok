// The one catalog id shape every tool reads: FAMILY-001 or FAMILY-SUBFAMILY-001,
// and in test names and registrations optionally keyed by a letters-only `:row`.
const BASE = '[A-Z]+-(?:[A-Z]+-)?[0-9]{3}';
const KEYED = `${BASE}(?::[a-zA-Z]+)?`;

export const CATALOG_ID_RE = new RegExp(`^${BASE}$`);
export const TEST_ID_RE = new RegExp(`^${KEYED}$`);

// A token that runs on into more id characters (`-003b`, `-OPS-001`, `:row2`) is no id at all.
const ID_IN_TEXT_RE = new RegExp(`(?<![\\w-])${KEYED}(?![\\w-]|:\\w)`, 'g');

export function catalogIdsIn(text) {
	return [...text.matchAll(ID_IN_TEXT_RE)].map(m => m[0]);
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
