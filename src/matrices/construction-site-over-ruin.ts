import {
	STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_TOWER,
	STRUCTURE_CONTAINER, STRUCTURE_ROAD,
} from '../index.js';

type StructType =
	| typeof STRUCTURE_SPAWN
	| typeof STRUCTURE_EXTENSION
	| typeof STRUCTURE_TOWER
	| typeof STRUCTURE_CONTAINER
	| typeof STRUCTURE_ROAD;

export interface ConstructionSiteOverRuinCase {
	label: string;
	ruinType: StructType;
	placedType: StructType;
}

const TYPES: readonly StructType[] = [
	STRUCTURE_SPAWN,
	STRUCTURE_EXTENSION,
	STRUCTURE_TOWER,
	STRUCTURE_CONTAINER,
	STRUCTURE_ROAD,
];

export const constructionSiteOverRuinCases: readonly ConstructionSiteOverRuinCase[] = (() => {
	const cases: ConstructionSiteOverRuinCase[] = [];
	for (const ruinType of TYPES) {
		for (const placedType of TYPES) {
			cases.push({
				label: `${ruinType}-ruin-place-${placedType}`,
				ruinType,
				placedType,
			});
		}
	}
	return cases;
})();
