export type CatalogLabel = 'verified_vanilla' | 'documented' | 'reported';

export const CATALOG_LABELS: CatalogLabel[];

export interface CatalogEntry {
	id: string;
	section: string;
	subsection: string;
	capability: string | null;
	capabilities: string[];
	entryClass: 'behavior' | 'matrix' | null;
	oracle: CatalogLabel;
}

export function parseCatalog(behaviorsPath: string): CatalogEntry[];
