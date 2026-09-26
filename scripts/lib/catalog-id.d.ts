export const CATALOG_ID_RE: RegExp;
export const TEST_ID_RE: RegExp;
export function catalogIdsIn(text: string): string[];
export function baseCatalogId(id: string): string;
export function testCatalogId(fullName: string): string | null;
