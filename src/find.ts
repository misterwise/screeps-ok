import {
	FIND_CREEPS,
	FIND_CONSTRUCTION_SITES,
	FIND_DROPPED_RESOURCES,
	FIND_MINERALS,
	FIND_RUINS,
	FIND_SOURCES,
	FIND_STRUCTURES,
	FIND_TOMBSTONES,
} from './constants.js';

export const SUPPORTED_FIND_CONSTANTS = [
	FIND_CREEPS,
	FIND_STRUCTURES,
	FIND_CONSTRUCTION_SITES,
	FIND_SOURCES,
	FIND_MINERALS,
	FIND_TOMBSTONES,
	FIND_RUINS,
	FIND_DROPPED_RESOURCES,
] as const;

export type SupportedFindConstant = (typeof SUPPORTED_FIND_CONSTANTS)[number];

export type NeutralFindSelector =
	| 'creeps'
	| 'structures'
	| 'constructionSites'
	| 'sources'
	| 'minerals'
	| 'tombstones'
	| 'ruins'
	| 'droppedResources';

export function selectorFromFindConstant(findType: number): NeutralFindSelector {
	switch (findType) {
		case FIND_CREEPS:
			return 'creeps';
		case FIND_STRUCTURES:
			return 'structures';
		case FIND_CONSTRUCTION_SITES:
			return 'constructionSites';
		case FIND_SOURCES:
			return 'sources';
		case FIND_MINERALS:
			return 'minerals';
		case FIND_TOMBSTONES:
			return 'tombstones';
		case FIND_RUINS:
			return 'ruins';
		case FIND_DROPPED_RESOURCES:
			return 'droppedResources';
		default:
			throw new Error(`Unsupported FIND constant for findInRoom: ${findType}`);
	}
}
