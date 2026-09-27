import {
	STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_TOWER,
	STRUCTURE_CONTAINER, STRUCTURE_ROAD, STRUCTURE_RAMPART,
	OK, ERR_INVALID_TARGET,
} from '../index.js';

type StructType =
	| typeof STRUCTURE_SPAWN
	| typeof STRUCTURE_EXTENSION
	| typeof STRUCTURE_TOWER
	| typeof STRUCTURE_CONTAINER
	| typeof STRUCTURE_ROAD
	| typeof STRUCTURE_RAMPART;

export interface ConstructionSiteOverStructureCase {
	label: string;
	existingType: StructType;
	placedType: StructType;
	expectedRc: typeof OK | typeof ERR_INVALID_TARGET;
}

// Pairs target engine `utils.checkConstructionSite` lines 181-184: a placed
// site is rejected when an existing non-road/non-rampart structure with a
// `CONSTRUCTION_COST` type occupies the tile and the placed type is also
// non-road/non-rampart. Road and rampart short-circuit on either side, so
// they stack with anything. Same-type stacking is owned by engine line 172
// and is intentionally out of scope here.
export const constructionSiteOverStructureCases: readonly ConstructionSiteOverStructureCase[] = [
	// non-stackable existing + non-stackable placed → blocked, both directions
	{ label: 'containerBlocksTower',     existingType: STRUCTURE_CONTAINER, placedType: STRUCTURE_TOWER,     expectedRc: ERR_INVALID_TARGET },
	{ label: 'containerBlocksSpawn',     existingType: STRUCTURE_CONTAINER, placedType: STRUCTURE_SPAWN,     expectedRc: ERR_INVALID_TARGET },
	{ label: 'containerBlocksExtension', existingType: STRUCTURE_CONTAINER, placedType: STRUCTURE_EXTENSION, expectedRc: ERR_INVALID_TARGET },
	{ label: 'towerBlocksContainer',     existingType: STRUCTURE_TOWER,     placedType: STRUCTURE_CONTAINER, expectedRc: ERR_INVALID_TARGET },
	{ label: 'spawnBlocksContainer',     existingType: STRUCTURE_SPAWN,     placedType: STRUCTURE_CONTAINER, expectedRc: ERR_INVALID_TARGET },

	// road / rampart stack on top of any existing structure
	{ label: 'containerAllowsRoad',      existingType: STRUCTURE_CONTAINER, placedType: STRUCTURE_ROAD,    expectedRc: OK },
	{ label: 'containerAllowsRampart',   existingType: STRUCTURE_CONTAINER, placedType: STRUCTURE_RAMPART, expectedRc: OK },
	{ label: 'towerAllowsRoad',          existingType: STRUCTURE_TOWER,     placedType: STRUCTURE_ROAD,    expectedRc: OK },
	{ label: 'towerAllowsRampart',       existingType: STRUCTURE_TOWER,     placedType: STRUCTURE_RAMPART, expectedRc: OK },

	// existing road / rampart never blocks any placed type
	{ label: 'roadAllowsContainer',      existingType: STRUCTURE_ROAD,    placedType: STRUCTURE_CONTAINER, expectedRc: OK },
	{ label: 'roadAllowsTower',          existingType: STRUCTURE_ROAD,    placedType: STRUCTURE_TOWER,     expectedRc: OK },
	{ label: 'rampartAllowsTower',       existingType: STRUCTURE_RAMPART, placedType: STRUCTURE_TOWER,     expectedRc: OK },
];
