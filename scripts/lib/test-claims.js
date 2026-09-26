// The catalog ids each numbered-section test file claims, shared by coverage
// and the capability validator: ids in its code (comments aside) and the
// `catalogId:` literals of the matrices it imports.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { baseCatalogId, catalogIdsIn, isCatalogTestFile, stripComments } from './catalog-id.js';

const MATRIX_IMPORT_RE = /from\s+['"]([^'"]+\/matrices\/[^'"]+?)(?:\.js)?['"]/g;
const MATRIX_CATALOG_ID_RE = /catalogId\s*:\s*['"]([^'"]+)['"]/g;

function walk(dir) {
	return readdirSync(dir, { withFileTypes: true })
		.sort((a, b) => a.name.localeCompare(b.name))
		.flatMap(entry => {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) return walk(full);
			return entry.name.endsWith('.test.ts') ? [full] : [];
		});
}

// [{ file, code, ids }] in path order; `code` is the file with comments stripped.
export function testFileClaims(testsDir) {
	const matrixIds = new Map();
	const idsOfMatrix = matrixPath => {
		if (!matrixIds.has(matrixPath)) {
			const source = stripComments(readFileSync(matrixPath, 'utf8'));
			matrixIds.set(matrixPath, [...source.matchAll(MATRIX_CATALOG_ID_RE)].flatMap(m => catalogIdsIn(m[1])));
		}
		return matrixIds.get(matrixPath);
	};

	return walk(testsDir).filter(isCatalogTestFile).map(file => {
		const code = stripComments(readFileSync(file, 'utf8'));
		const ids = new Set(catalogIdsIn(code).map(baseCatalogId));
		for (const m of code.matchAll(MATRIX_IMPORT_RE)) {
			for (const id of idsOfMatrix(path.resolve(path.dirname(file), `${m[1]}.ts`))) ids.add(baseCatalogId(id));
		}
		return { file, code, ids };
	});
}
