export const CATALOG_ID_RE: RegExp;
export const TEST_ID_RE: RegExp;
export function catalogIdsIn(text: string): string[];
export function stripComments(source: string): string;
export function isCatalogTestFile(file: string): boolean;
export function baseCatalogId(id: string): string;
export function testCatalogId(fullName: string): string | null;
