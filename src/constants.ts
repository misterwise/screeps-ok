// Re-export gameplay constants from @screeps/common for use in test assertions.
// This lets tests use `OK`, `ERR_NOT_IN_RANGE`, etc. instead of magic numbers.

// @ts-expect-error -- @screeps/common has no type declarations
import constants from '@screeps/common/lib/constants.js';

// ── Return codes ────────────────────────────────────────────
export const OK: 0 = constants.OK;
export const ERR_NOT_OWNER: -1 = constants.ERR_NOT_OWNER;
export const ERR_NO_PATH: -2 = constants.ERR_NO_PATH;
export const ERR_NAME_EXISTS: -3 = constants.ERR_NAME_EXISTS;
export const ERR_BUSY: -4 = constants.ERR_BUSY;
export const ERR_NOT_FOUND: -5 = constants.ERR_NOT_FOUND;
export const ERR_NOT_ENOUGH_ENERGY: -6 = constants.ERR_NOT_ENOUGH_ENERGY;
export const ERR_NOT_ENOUGH_RESOURCES: -6 = constants.ERR_NOT_ENOUGH_RESOURCES;
export const ERR_INVALID_TARGET: -7 = constants.ERR_INVALID_TARGET;
export const ERR_FULL: -8 = constants.ERR_FULL;
export const ERR_NOT_IN_RANGE: -9 = constants.ERR_NOT_IN_RANGE;
export const ERR_INVALID_ARGS: -10 = constants.ERR_INVALID_ARGS;
export const ERR_TIRED: -11 = constants.ERR_TIRED;
export const ERR_NO_BODYPART: -12 = constants.ERR_NO_BODYPART;
export const ERR_RCL_NOT_ENOUGH: -14 = constants.ERR_RCL_NOT_ENOUGH;
export const ERR_GCL_NOT_ENOUGH: -15 = constants.ERR_GCL_NOT_ENOUGH;

// ── FIND constants ──────────────────────────────────────────
export const FIND_EXIT_TOP: 1 = constants.FIND_EXIT_TOP;
export const FIND_EXIT_RIGHT: 3 = constants.FIND_EXIT_RIGHT;
export const FIND_EXIT_BOTTOM: 5 = constants.FIND_EXIT_BOTTOM;
export const FIND_EXIT_LEFT: 7 = constants.FIND_EXIT_LEFT;
export const FIND_EXIT: 10 = constants.FIND_EXIT;
export const FIND_CREEPS: 101 = constants.FIND_CREEPS;
export const FIND_MY_CREEPS: 102 = constants.FIND_MY_CREEPS;
export const FIND_HOSTILE_CREEPS: 103 = constants.FIND_HOSTILE_CREEPS;
export const FIND_SOURCES_ACTIVE: 104 = constants.FIND_SOURCES_ACTIVE;
export const FIND_SOURCES: 105 = constants.FIND_SOURCES;
export const FIND_DROPPED_RESOURCES: 106 = constants.FIND_DROPPED_RESOURCES;
export const FIND_STRUCTURES: 107 = constants.FIND_STRUCTURES;
export const FIND_MY_STRUCTURES: 108 = constants.FIND_MY_STRUCTURES;
export const FIND_HOSTILE_STRUCTURES: 109 = constants.FIND_HOSTILE_STRUCTURES;
export const FIND_FLAGS: 110 = constants.FIND_FLAGS;
export const FIND_CONSTRUCTION_SITES: 111 = constants.FIND_CONSTRUCTION_SITES;
export const FIND_MY_SPAWNS: 112 = constants.FIND_MY_SPAWNS;
export const FIND_HOSTILE_SPAWNS: 113 = constants.FIND_HOSTILE_SPAWNS;
export const FIND_MINERALS: 116 = constants.FIND_MINERALS;
export const FIND_NUKES: 117 = constants.FIND_NUKES;
export const FIND_TOMBSTONES: 118 = constants.FIND_TOMBSTONES;
export const FIND_RUINS: 123 = constants.FIND_RUINS;

// ── Directions ──────────────────────────────────────────────
export const TOP: 1 = constants.TOP;
export const TOP_RIGHT: 2 = constants.TOP_RIGHT;
export const RIGHT: 3 = constants.RIGHT;
export const BOTTOM_RIGHT: 4 = constants.BOTTOM_RIGHT;
export const BOTTOM: 5 = constants.BOTTOM;
export const BOTTOM_LEFT: 6 = constants.BOTTOM_LEFT;
export const LEFT: 7 = constants.LEFT;
export const TOP_LEFT: 8 = constants.TOP_LEFT;

// ── Body parts ──────────────────────────────────────────────
export const MOVE = 'move' as const;
export const WORK = 'work' as const;
export const CARRY = 'carry' as const;
export const ATTACK = 'attack' as const;
export const RANGED_ATTACK = 'ranged_attack' as const;
export const TOUGH = 'tough' as const;
export const HEAL = 'heal' as const;
export const CLAIM = 'claim' as const;

// ── LOOK constants ──────────────────────────────────────────
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

// ── Structure types ─────────────────────────────────────────
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

// ── Resources ───────────────────────────────────────────────
export const RESOURCE_ENERGY = 'energy' as const;
export const RESOURCE_POWER = 'power' as const;

// ── Gameplay constants ──────────────────────────────────────
export const HARVEST_POWER: 2 = constants.HARVEST_POWER;
export const REPAIR_POWER: 100 = constants.REPAIR_POWER;
export const DISMANTLE_POWER: 50 = constants.DISMANTLE_POWER;
export const BUILD_POWER: 5 = constants.BUILD_POWER;
export const ATTACK_POWER: 30 = constants.ATTACK_POWER;
export const RANGED_ATTACK_POWER: 10 = constants.RANGED_ATTACK_POWER;
export const HEAL_POWER: 12 = constants.HEAL_POWER;
export const RANGED_HEAL_POWER: 4 = constants.RANGED_HEAL_POWER;
export const CARRY_CAPACITY: 50 = constants.CARRY_CAPACITY;
export const ENERGY_REGEN_TIME: 300 = constants.ENERGY_REGEN_TIME;
export const CREEP_LIFE_TIME: 1500 = constants.CREEP_LIFE_TIME;

// ── Terrain ─────────────────────────────────────────────────
export const TERRAIN_PLAIN: 0 = 0;
export const TERRAIN_WALL: 1 = 1;
export const TERRAIN_SWAMP: 2 = 2;
