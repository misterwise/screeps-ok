import {
	STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_ROAD, STRUCTURE_WALL,
	STRUCTURE_RAMPART, STRUCTURE_LINK, STRUCTURE_STORAGE, STRUCTURE_TOWER,
	STRUCTURE_OBSERVER, STRUCTURE_POWER_SPAWN, STRUCTURE_EXTRACTOR,
	STRUCTURE_LAB, STRUCTURE_TERMINAL, STRUCTURE_CONTAINER,
	STRUCTURE_NUKER, STRUCTURE_FACTORY,
	SPAWN_HITS, EXTENSION_HITS, ROAD_HITS, WALL_HITS,
	RAMPART_HITS, LINK_HITS, STORAGE_HITS, TOWER_HITS,
	OBSERVER_HITS, POWER_SPAWN_HITS, EXTRACTOR_HITS,
	LAB_HITS, TERMINAL_HITS, CONTAINER_HITS,
	NUKER_HITS, FACTORY_HITS,
} from '../index.js';

// Canonical initial hits for structures with fixed hit totals.
// Excludes structures with RCL-scaled or dynamic hitsMax (ramparts, walls).
export const structureHitsCases = [
	{ structureType: STRUCTURE_SPAWN, expectedHits: SPAWN_HITS },
	{ structureType: STRUCTURE_EXTENSION, expectedHits: EXTENSION_HITS },
	{ structureType: STRUCTURE_ROAD, expectedHits: ROAD_HITS },
	{ structureType: STRUCTURE_WALL, expectedHits: WALL_HITS },
	{ structureType: STRUCTURE_RAMPART, expectedHits: RAMPART_HITS },
	{ structureType: STRUCTURE_LINK, expectedHits: LINK_HITS },
	{ structureType: STRUCTURE_STORAGE, expectedHits: STORAGE_HITS },
	{ structureType: STRUCTURE_TOWER, expectedHits: TOWER_HITS },
	{ structureType: STRUCTURE_OBSERVER, expectedHits: OBSERVER_HITS },
	{ structureType: STRUCTURE_POWER_SPAWN, expectedHits: POWER_SPAWN_HITS },
	{ structureType: STRUCTURE_EXTRACTOR, expectedHits: EXTRACTOR_HITS },
	{ structureType: STRUCTURE_LAB, expectedHits: LAB_HITS },
	{ structureType: STRUCTURE_TERMINAL, expectedHits: TERMINAL_HITS },
	{ structureType: STRUCTURE_CONTAINER, expectedHits: CONTAINER_HITS },
	{ structureType: STRUCTURE_NUKER, expectedHits: NUKER_HITS },
	{ structureType: STRUCTURE_FACTORY, expectedHits: FACTORY_HITS },
] as const;
