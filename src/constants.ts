// Checked-in canonical Screeps constants for test-side assertions.
//
// These values are intentionally owned by screeps-ok rather than read from the
// engine under test at runtime. Canonical tests must not use the implementation
// as its own oracle.

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

// Resources
export const RESOURCE_ENERGY = 'energy' as const;
export const RESOURCE_POWER = 'power' as const;

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
export const CARRY_CAPACITY = 50 as const;
export const ENERGY_REGEN_TIME = 300 as const;
export const CREEP_LIFE_TIME = 1500 as const;
export const LINK_COOLDOWN = 1 as const;
export const LINK_LOSS_RATIO = 0.03 as const;
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

// Terrain
export const TERRAIN_PLAIN = 0 as const;
export const TERRAIN_WALL = 1 as const;
export const TERRAIN_SWAMP = 2 as const;
