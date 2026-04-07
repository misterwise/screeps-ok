// Checked-in canonical Screeps constants for test-side assertions.
//
// Scalar constants are owned directly by this file. Large canonical tables
// (REACTIONS, BOOSTS, COMMODITIES, POWER_INFO) are re-exported from
// @screeps/common — the shared game-constant package that defines what
// Screeps is. This is not "the engine under test"; both vanilla and xxscreeps
// consume these tables and could implement the logic around them incorrectly,
// which is exactly what the suite tests.

// Large canonical tables — imported from @screeps/common rather than
// hand-maintained, to avoid drift in hundreds of lookup entries.
export {
	REACTIONS, BOOSTS, COMMODITIES, POWER_INFO,
} from '@screeps/common/lib/constants.js';

// Return codes
export const OK = 0 as const;
export const ERR_NOT_OWNER = -1 as const;
export const ERR_NO_PATH = -2 as const;
export const ERR_NAME_EXISTS = -3 as const;
export const ERR_BUSY = -4 as const;
export const ERR_NOT_FOUND = -5 as const;
export const ERR_NOT_ENOUGH_ENERGY = -6 as const;
export const ERR_NOT_ENOUGH_RESOURCES = -6 as const;
export const ERR_INVALID_TARGET = -7 as const;
export const ERR_FULL = -8 as const;
export const ERR_NOT_IN_RANGE = -9 as const;
export const ERR_INVALID_ARGS = -10 as const;
export const ERR_TIRED = -11 as const;
export const ERR_NO_BODYPART = -12 as const;
export const ERR_RCL_NOT_ENOUGH = -14 as const;
export const ERR_GCL_NOT_ENOUGH = -15 as const;

// FIND constants
export const FIND_EXIT_TOP = 1 as const;
export const FIND_EXIT_RIGHT = 3 as const;
export const FIND_EXIT_BOTTOM = 5 as const;
export const FIND_EXIT_LEFT = 7 as const;
export const FIND_EXIT = 10 as const;
export const FIND_CREEPS = 101 as const;
export const FIND_MY_CREEPS = 102 as const;
export const FIND_HOSTILE_CREEPS = 103 as const;
export const FIND_SOURCES_ACTIVE = 104 as const;
export const FIND_SOURCES = 105 as const;
export const FIND_DROPPED_RESOURCES = 106 as const;
export const FIND_STRUCTURES = 107 as const;
export const FIND_MY_STRUCTURES = 108 as const;
export const FIND_HOSTILE_STRUCTURES = 109 as const;
export const FIND_FLAGS = 110 as const;
export const FIND_CONSTRUCTION_SITES = 111 as const;
export const FIND_MY_SPAWNS = 112 as const;
export const FIND_HOSTILE_SPAWNS = 113 as const;
export const FIND_MINERALS = 116 as const;
export const FIND_NUKES = 117 as const;
export const FIND_TOMBSTONES = 118 as const;
export const FIND_RUINS = 123 as const;

// Directions
export const TOP = 1 as const;
export const TOP_RIGHT = 2 as const;
export const RIGHT = 3 as const;
export const BOTTOM_RIGHT = 4 as const;
export const BOTTOM = 5 as const;
export const BOTTOM_LEFT = 6 as const;
export const LEFT = 7 as const;
export const TOP_LEFT = 8 as const;

// Body parts
export const MOVE = 'move' as const;
export const WORK = 'work' as const;
export const CARRY = 'carry' as const;
export const ATTACK = 'attack' as const;
export const RANGED_ATTACK = 'ranged_attack' as const;
export const TOUGH = 'tough' as const;
export const HEAL = 'heal' as const;
export const CLAIM = 'claim' as const;

// LOOK constants
export const LOOK_CREEPS = 'creep' as const;
export const LOOK_ENERGY = 'energy' as const;
export const LOOK_RESOURCES = 'resource' as const;
export const LOOK_SOURCES = 'source' as const;
export const LOOK_MINERALS = 'mineral' as const;
export const LOOK_STRUCTURES = 'structure' as const;
export const LOOK_FLAGS = 'flag' as const;
export const LOOK_CONSTRUCTION_SITES = 'constructionSite' as const;
export const LOOK_TERRAIN = 'terrain' as const;
export const LOOK_TOMBSTONES = 'tombstone' as const;
export const LOOK_RUINS = 'ruin' as const;

// Structure types
export const STRUCTURE_SPAWN = 'spawn' as const;
export const STRUCTURE_EXTENSION = 'extension' as const;
export const STRUCTURE_ROAD = 'road' as const;
export const STRUCTURE_WALL = 'constructedWall' as const;
export const STRUCTURE_RAMPART = 'rampart' as const;
export const STRUCTURE_CONTROLLER = 'controller' as const;
export const STRUCTURE_LINK = 'link' as const;
export const STRUCTURE_STORAGE = 'storage' as const;
export const STRUCTURE_TOWER = 'tower' as const;
export const STRUCTURE_OBSERVER = 'observer' as const;
export const STRUCTURE_POWER_SPAWN = 'powerSpawn' as const;
export const STRUCTURE_EXTRACTOR = 'extractor' as const;
export const STRUCTURE_LAB = 'lab' as const;
export const STRUCTURE_TERMINAL = 'terminal' as const;
export const STRUCTURE_CONTAINER = 'container' as const;
export const STRUCTURE_NUKER = 'nuker' as const;
export const STRUCTURE_FACTORY = 'factory' as const;
export const STRUCTURE_KEEPER_LAIR = 'keeperLair' as const;
export const STRUCTURE_POWER_BANK = 'powerBank' as const;
export const STRUCTURE_INVADER_CORE = 'invaderCore' as const;

// Resources
export const RESOURCE_ENERGY = 'energy' as const;
export const RESOURCE_POWER = 'power' as const;
export const RESOURCE_GHODIUM = 'G' as const;
export const RESOURCE_SILICON = 'silicon' as const;
export const RESOURCE_METAL = 'metal' as const;
export const RESOURCE_BIOMASS = 'biomass' as const;
export const RESOURCE_MIST = 'mist' as const;

// Gameplay constants
export const BODYPART_COST = {
	[WORK]: 100,
	[CARRY]: 50,
	[MOVE]: 50,
	[ATTACK]: 80,
	[RANGED_ATTACK]: 150,
	[HEAL]: 250,
	[CLAIM]: 600,
	[TOUGH]: 10,
} as const;

export const HARVEST_POWER = 2 as const;
export const REPAIR_POWER = 100 as const;
export const DISMANTLE_POWER = 50 as const;
export const BUILD_POWER = 5 as const;
export const ATTACK_POWER = 30 as const;
export const RANGED_ATTACK_POWER = 10 as const;
export const RANGED_ATTACK_DISTANCE_RATE = {
	1: 1,
	2: 0.4,
	3: 0.1,
	4: 0,
} as const;
export const HEAL_POWER = 12 as const;
export const RANGED_HEAL_POWER = 4 as const;
export const BODYPART_HITS = 100 as const;
export const TOWER_ENERGY_COST = 10 as const;
export const UPGRADE_CONTROLLER_POWER = 1 as const;
export const CREEP_CORPSE_RATE = 0.2 as const;
export const TOMBSTONE_DECAY_PER_PART = 5 as const;
export const DISMANTLE_COST = 0.005 as const;
export const CARRY_CAPACITY = 50 as const;
export const ENERGY_REGEN_TIME = 300 as const;
export const CREEP_LIFE_TIME = 1500 as const;
export const CREEP_CLAIM_LIFE_TIME = 600 as const;
export const CREEP_SPAWN_TIME = 3 as const;
export const MAX_CREEP_SIZE = 50 as const;
export const SPAWN_RENEW_RATIO = 1.2 as const;
export const LINK_COOLDOWN = 1 as const;
export const LINK_LOSS_RATIO = 0.03 as const;
export const EXTRACTOR_COOLDOWN = 5 as const;
export const HARVEST_MINERAL_POWER = 1 as const;
export const TOWER_POWER_ATTACK = 600 as const;
export const TOWER_POWER_HEAL = 400 as const;
export const TOWER_POWER_REPAIR = 800 as const;
export const TOWER_OPTIMAL_RANGE = 5 as const;
export const TOWER_FALLOFF_RANGE = 20 as const;
export const TOWER_FALLOFF = 0.75 as const;

export const RAMPART_HITS_MAX = {
	2: 300000,
	3: 1000000,
	4: 3000000,
	5: 10000000,
	6: 30000000,
	7: 100000000,
	8: 300000000,
} as const;

// Construction cost
export const CONSTRUCTION_COST = {
	[STRUCTURE_SPAWN]: 15000,
	[STRUCTURE_EXTENSION]: 3000,
	[STRUCTURE_ROAD]: 300,
	[STRUCTURE_WALL]: 1,
	[STRUCTURE_RAMPART]: 1,
	[STRUCTURE_LINK]: 5000,
	[STRUCTURE_STORAGE]: 30000,
	[STRUCTURE_TOWER]: 5000,
	[STRUCTURE_OBSERVER]: 8000,
	[STRUCTURE_POWER_SPAWN]: 100000,
	[STRUCTURE_EXTRACTOR]: 5000,
	[STRUCTURE_LAB]: 50000,
	[STRUCTURE_TERMINAL]: 100000,
	[STRUCTURE_CONTAINER]: 5000,
	[STRUCTURE_NUKER]: 100000,
	[STRUCTURE_FACTORY]: 100000,
} as const;

// Structure hits
export const SPAWN_HITS = 5000 as const;
export const EXTENSION_HITS = 1000 as const;
export const ROAD_HITS = 5000 as const;
export const WALL_HITS = 1 as const;
export const WALL_HITS_MAX = 300000000 as const;
export const RAMPART_HITS = 1 as const;
export const LINK_HITS = 1000 as const;
export const STORAGE_HITS = 10000 as const;
export const TOWER_HITS = 3000 as const;
export const OBSERVER_HITS = 500 as const;
export const POWER_SPAWN_HITS = 5000 as const;
export const EXTRACTOR_HITS = 500 as const;
export const LAB_HITS = 500 as const;
export const TERMINAL_HITS = 3000 as const;
export const CONTAINER_HITS = 250000 as const;
export const NUKER_HITS = 1000 as const;
export const FACTORY_HITS = 1000 as const;

// Container decay
export const CONTAINER_DECAY = 5000 as const;
export const CONTAINER_DECAY_TIME = 100 as const;
export const CONTAINER_DECAY_TIME_OWNED = 500 as const;

// Road decay and wear
export const ROAD_DECAY_AMOUNT = 100 as const;
export const ROAD_DECAY_TIME = 1000 as const;
export const ROAD_WEAROUT = 1 as const;
export const ROAD_WEAROUT_POWER_CREEP = 100 as const;

// Source energy
export const SOURCE_ENERGY_CAPACITY = 3000 as const;
export const SOURCE_ENERGY_NEUTRAL_CAPACITY = 1500 as const;
export const SOURCE_ENERGY_KEEPER_CAPACITY = 4000 as const;

// Ruin decay
export const RUIN_DECAY = 500 as const;
export const RUIN_DECAY_STRUCTURES = {
	powerBank: 10,
} as const;

// Controller structure limits
export const CONTROLLER_STRUCTURES = {
	[STRUCTURE_SPAWN]:       { 0: 0, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 2, 8: 3 },
	[STRUCTURE_EXTENSION]:   { 0: 0, 1: 0, 2: 5, 3: 10, 4: 20, 5: 30, 6: 40, 7: 50, 8: 60 },
	[STRUCTURE_LINK]:        { 1: 0, 2: 0, 3: 0, 4: 0, 5: 2, 6: 3, 7: 4, 8: 6 },
	[STRUCTURE_ROAD]:        { 0: 2500, 1: 2500, 2: 2500, 3: 2500, 4: 2500, 5: 2500, 6: 2500, 7: 2500, 8: 2500 },
	[STRUCTURE_WALL]:        { 1: 0, 2: 2500, 3: 2500, 4: 2500, 5: 2500, 6: 2500, 7: 2500, 8: 2500 },
	[STRUCTURE_RAMPART]:     { 1: 0, 2: 2500, 3: 2500, 4: 2500, 5: 2500, 6: 2500, 7: 2500, 8: 2500 },
	[STRUCTURE_STORAGE]:     { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1 },
	[STRUCTURE_TOWER]:       { 1: 0, 2: 0, 3: 1, 4: 1, 5: 2, 6: 2, 7: 3, 8: 6 },
	[STRUCTURE_OBSERVER]:    { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 1 },
	[STRUCTURE_POWER_SPAWN]: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 1 },
	[STRUCTURE_EXTRACTOR]:   { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 1, 7: 1, 8: 1 },
	[STRUCTURE_TERMINAL]:    { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 1, 7: 1, 8: 1 },
	[STRUCTURE_LAB]:         { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 3, 7: 6, 8: 10 },
	[STRUCTURE_CONTAINER]:   { 0: 5, 1: 5, 2: 5, 3: 5, 4: 5, 5: 5, 6: 5, 7: 5, 8: 5 },
	[STRUCTURE_NUKER]:       { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 1 },
	[STRUCTURE_FACTORY]:     { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 1, 8: 1 },
} as const;

// Store capacities
export const STORAGE_CAPACITY = 1000000 as const;
export const TERMINAL_CAPACITY = 300000 as const;
export const CONTAINER_CAPACITY = 2000 as const;
export const TOWER_CAPACITY = 1000 as const;
export const SPAWN_ENERGY_CAPACITY = 300 as const;
export const EXTENSION_ENERGY_CAPACITY = {
	0: 50, 1: 50, 2: 50, 3: 50, 4: 50, 5: 50, 6: 50, 7: 100, 8: 200,
} as const;
export const LINK_CAPACITY = 800 as const;
export const LAB_MINERAL_CAPACITY = 3000 as const;
export const LAB_ENERGY_CAPACITY = 2000 as const;
export const NUKER_ENERGY_CAPACITY = 300000 as const;
export const NUKER_GHODIUM_CAPACITY = 5000 as const;
export const POWER_SPAWN_ENERGY_CAPACITY = 5000 as const;
export const POWER_SPAWN_POWER_CAPACITY = 100 as const;
export const FACTORY_CAPACITY = 50000 as const;

// Mineral density
export const DENSITY_LOW = 1 as const;
export const DENSITY_MODERATE = 2 as const;
export const DENSITY_HIGH = 3 as const;
export const DENSITY_ULTRA = 4 as const;
export const MINERAL_DENSITY = {
	[DENSITY_LOW]: 15000,
	[DENSITY_MODERATE]: 35000,
	[DENSITY_HIGH]: 70000,
	[DENSITY_ULTRA]: 100000,
} as const;

// RawMemory segment limits
export const MAX_ACTIVE_SEGMENTS = 10 as const;
export const MAX_SEGMENT_COUNT = 100 as const;
export const MAX_SEGMENT_SIZE = 102400 as const;

// Terrain
export const TERRAIN_PLAIN = 0 as const;
export const TERRAIN_WALL = 1 as const;
export const TERRAIN_SWAMP = 2 as const;
