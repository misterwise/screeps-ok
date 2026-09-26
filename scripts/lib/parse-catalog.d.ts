export interface CatalogEntry {
	id: string;
	section: string;
	subsection: string;
	capability: string | null;
	capabilities: string[];
	entryClass: 'behavior' | 'matrix' | null;
	oracle: 'verified_vanilla' | 'needs_vanilla_verification' | null;
}

export function parseCatalog(behaviorsPath: string): CatalogEntry[];
