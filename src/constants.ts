// Canonical Screeps constants sourced from @screeps/common — the shared
// game-constant package consumed by both vanilla and xxscreeps.
//
// We re-export from the package rather than hand-maintaining values to
// prevent drift. @screeps/common is CJS and uses `Object.assign(exports,
// {...})`, which Node's static CJS→ESM interop can't enumerate, so we
// reach for createRequire and type every re-export by hand. This pattern
// works uniformly under native Node ESM, vitest's SSR transform, and any
// downstream bundler.
import { createRequire } from 'node:module';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const C = createRequire(import.meta.url)('@screeps/common/lib/constants.js');

// ── Tables ─────────────────────────────────────────────────────────
export const REACTIONS: Record<string, Record<string, string>> = C.REACTIONS;
export const BOOSTS: Record<string, Record<string, Record<string, number>>> = C.BOOSTS;
export const COMMODITIES: Record<string, {
	amount: number;
	cooldown: number;
	components: Record<string, number>;
	level?: number;
}> = C.COMMODITIES;
export const POWER_INFO: Record<number, {
	className: string;
	level: number[];
	cooldown: number;
	duration?: number;
	effect?: number[];
	range?: number;
	ops?: number;
	energy?: number;
	period?: number;
}> = C.POWER_INFO;

// Tables that need explicit typing (not picked up by ESM inference)
export const REACTION_TIME: Record<string, number> = C.REACTION_TIME;
export const BODYPART_COST: Record<string, number> = C.BODYPART_COST;
export const CONSTRUCTION_COST: Record<string, number> = C.CONSTRUCTION_COST;
export const CONTROLLER_STRUCTURES: Record<string, Record<number, number>> = C.CONTROLLER_STRUCTURES;
export const EXTENSION_ENERGY_CAPACITY: Record<number, number> = C.EXTENSION_ENERGY_CAPACITY;
export const RAMPART_HITS_MAX: Record<number, number> = C.RAMPART_HITS_MAX;
export const MINERAL_DENSITY: Record<number, number> = C.MINERAL_DENSITY;
export const RUIN_DECAY_STRUCTURES: Record<string, number> = C.RUIN_DECAY_STRUCTURES;
// RANGED_ATTACK_DISTANCE_RATE is not exported by @screeps/common; the values
// are hardcoded in the rangedMassAttack processor: {0: 1, 1: 1, 2: 0.4, 3: 0.1}.
export const RANGED_ATTACK_DISTANCE_RATE: Record<number, number> = { 0: 1, 1: 1, 2: 0.4, 3: 0.1 };

// Return codes
export const OK: 0 = C.OK;
export const ERR_NOT_OWNER: -1 = C.ERR_NOT_OWNER;
export const ERR_NO_PATH: -2 = C.ERR_NO_PATH;
export const ERR_NAME_EXISTS: -3 = C.ERR_NAME_EXISTS;
export const ERR_BUSY: -4 = C.ERR_BUSY;
export const ERR_NOT_FOUND: -5 = C.ERR_NOT_FOUND;
export const ERR_NOT_ENOUGH_ENERGY: -6 = C.ERR_NOT_ENOUGH_ENERGY;
export const ERR_NOT_ENOUGH_RESOURCES: -6 = C.ERR_NOT_ENOUGH_RESOURCES;
export const ERR_INVALID_TARGET: -7 = C.ERR_INVALID_TARGET;
export const ERR_FULL: -8 = C.ERR_FULL;
export const ERR_NOT_IN_RANGE: -9 = C.ERR_NOT_IN_RANGE;
export const ERR_INVALID_ARGS: -10 = C.ERR_INVALID_ARGS;
export const ERR_TIRED: -11 = C.ERR_TIRED;
export const ERR_NO_BODYPART: -12 = C.ERR_NO_BODYPART;
export const ERR_RCL_NOT_ENOUGH: -14 = C.ERR_RCL_NOT_ENOUGH;
export const ERR_GCL_NOT_ENOUGH: -15 = C.ERR_GCL_NOT_ENOUGH;

// FIND constants
export const FIND_EXIT_TOP: 1 = C.FIND_EXIT_TOP;
export const FIND_EXIT_RIGHT: 3 = C.FIND_EXIT_RIGHT;
export const FIND_EXIT_BOTTOM: 5 = C.FIND_EXIT_BOTTOM;
export const FIND_EXIT_LEFT: 7 = C.FIND_EXIT_LEFT;
export const FIND_EXIT: 10 = C.FIND_EXIT;
export const FIND_CREEPS: 101 = C.FIND_CREEPS;
export const FIND_MY_CREEPS: 102 = C.FIND_MY_CREEPS;
export const FIND_HOSTILE_CREEPS: 103 = C.FIND_HOSTILE_CREEPS;
export const FIND_SOURCES_ACTIVE: 104 = C.FIND_SOURCES_ACTIVE;
export const FIND_SOURCES: 105 = C.FIND_SOURCES;
export const FIND_DROPPED_RESOURCES: 106 = C.FIND_DROPPED_RESOURCES;
export const FIND_STRUCTURES: 107 = C.FIND_STRUCTURES;
export const FIND_MY_STRUCTURES: 108 = C.FIND_MY_STRUCTURES;
export const FIND_HOSTILE_STRUCTURES: 109 = C.FIND_HOSTILE_STRUCTURES;
export const FIND_FLAGS: 110 = C.FIND_FLAGS;
export const FIND_CONSTRUCTION_SITES: 111 = C.FIND_CONSTRUCTION_SITES;
export const FIND_MY_SPAWNS: 112 = C.FIND_MY_SPAWNS;
export const FIND_HOSTILE_SPAWNS: 113 = C.FIND_HOSTILE_SPAWNS;
export const FIND_MINERALS: 116 = C.FIND_MINERALS;
export const FIND_NUKES: 117 = C.FIND_NUKES;
export const FIND_TOMBSTONES: 118 = C.FIND_TOMBSTONES;
export const FIND_DEPOSITS: 122 = C.FIND_DEPOSITS;
export const FIND_RUINS: 123 = C.FIND_RUINS;

// Directions
export const TOP: 1 = C.TOP;
export const TOP_RIGHT: 2 = C.TOP_RIGHT;
export const RIGHT: 3 = C.RIGHT;
export const BOTTOM_RIGHT: 4 = C.BOTTOM_RIGHT;
export const BOTTOM: 5 = C.BOTTOM;
export const BOTTOM_LEFT: 6 = C.BOTTOM_LEFT;
export const LEFT: 7 = C.LEFT;
export const TOP_LEFT: 8 = C.TOP_LEFT;

// Body parts
export const MOVE: 'move' = C.MOVE;
export const WORK: 'work' = C.WORK;
export const CARRY: 'carry' = C.CARRY;
export const ATTACK: 'attack' = C.ATTACK;
export const RANGED_ATTACK: 'ranged_attack' = C.RANGED_ATTACK;
export const TOUGH: 'tough' = C.TOUGH;
export const HEAL: 'heal' = C.HEAL;
export const CLAIM: 'claim' = C.CLAIM;

// LOOK constants
export const LOOK_CREEPS: 'creep' = C.LOOK_CREEPS;
export const LOOK_ENERGY: 'energy' = C.LOOK_ENERGY;
export const LOOK_RESOURCES: 'resource' = C.LOOK_RESOURCES;
export const LOOK_SOURCES: 'source' = C.LOOK_SOURCES;
export const LOOK_MINERALS: 'mineral' = C.LOOK_MINERALS;
export const LOOK_DEPOSITS: 'deposit' = C.LOOK_DEPOSITS;
export const LOOK_STRUCTURES: 'structure' = C.LOOK_STRUCTURES;
export const LOOK_FLAGS: 'flag' = C.LOOK_FLAGS;
export const LOOK_CONSTRUCTION_SITES: 'constructionSite' = C.LOOK_CONSTRUCTION_SITES;
export const LOOK_NUKES: 'nuke' = C.LOOK_NUKES;
export const LOOK_TERRAIN: 'terrain' = C.LOOK_TERRAIN;
export const LOOK_TOMBSTONES: 'tombstone' = C.LOOK_TOMBSTONES;
export const LOOK_POWER_CREEPS: 'powerCreep' = C.LOOK_POWER_CREEPS;
export const LOOK_RUINS: 'ruin' = C.LOOK_RUINS;

// Structure types
export const STRUCTURE_SPAWN: 'spawn' = C.STRUCTURE_SPAWN;
export const STRUCTURE_EXTENSION: 'extension' = C.STRUCTURE_EXTENSION;
export const STRUCTURE_ROAD: 'road' = C.STRUCTURE_ROAD;
export const STRUCTURE_WALL: 'constructedWall' = C.STRUCTURE_WALL;
export const STRUCTURE_RAMPART: 'rampart' = C.STRUCTURE_RAMPART;
export const STRUCTURE_CONTROLLER: 'controller' = C.STRUCTURE_CONTROLLER;
export const STRUCTURE_LINK: 'link' = C.STRUCTURE_LINK;
export const STRUCTURE_STORAGE: 'storage' = C.STRUCTURE_STORAGE;
export const STRUCTURE_TOWER: 'tower' = C.STRUCTURE_TOWER;
export const STRUCTURE_OBSERVER: 'observer' = C.STRUCTURE_OBSERVER;
export const STRUCTURE_POWER_SPAWN: 'powerSpawn' = C.STRUCTURE_POWER_SPAWN;
export const STRUCTURE_EXTRACTOR: 'extractor' = C.STRUCTURE_EXTRACTOR;
export const STRUCTURE_LAB: 'lab' = C.STRUCTURE_LAB;
export const STRUCTURE_TERMINAL: 'terminal' = C.STRUCTURE_TERMINAL;
export const STRUCTURE_CONTAINER: 'container' = C.STRUCTURE_CONTAINER;
export const STRUCTURE_NUKER: 'nuker' = C.STRUCTURE_NUKER;
export const STRUCTURE_FACTORY: 'factory' = C.STRUCTURE_FACTORY;
export const STRUCTURE_KEEPER_LAIR: 'keeperLair' = C.STRUCTURE_KEEPER_LAIR;
export const STRUCTURE_POWER_BANK: 'powerBank' = C.STRUCTURE_POWER_BANK;
export const STRUCTURE_INVADER_CORE: 'invaderCore' = C.STRUCTURE_INVADER_CORE;

// Resources
export const RESOURCE_ENERGY: 'energy' = C.RESOURCE_ENERGY;
export const RESOURCE_POWER: 'power' = C.RESOURCE_POWER;
export const RESOURCE_GHODIUM: 'G' = C.RESOURCE_GHODIUM;
export const RESOURCE_SILICON: 'silicon' = C.RESOURCE_SILICON;
export const RESOURCE_METAL: 'metal' = C.RESOURCE_METAL;
export const RESOURCE_BIOMASS: 'biomass' = C.RESOURCE_BIOMASS;
export const RESOURCE_MIST: 'mist' = C.RESOURCE_MIST;

// Gameplay
export const HARVEST_POWER: number = C.HARVEST_POWER;
export const REPAIR_POWER: number = C.REPAIR_POWER;
export const DISMANTLE_POWER: number = C.DISMANTLE_POWER;
export const BUILD_POWER: number = C.BUILD_POWER;
export const ATTACK_POWER: number = C.ATTACK_POWER;
export const RANGED_ATTACK_POWER: number = C.RANGED_ATTACK_POWER;
export const HEAL_POWER: number = C.HEAL_POWER;
export const RANGED_HEAL_POWER: number = C.RANGED_HEAL_POWER;
// BODYPART_HITS is not exported by @screeps/common; 100 HP per part is a
// universal engine convention documented in the Screeps API.
export const BODYPART_HITS = 100 as const;
export const TOWER_ENERGY_COST: number = C.TOWER_ENERGY_COST;
export const UPGRADE_CONTROLLER_POWER: number = C.UPGRADE_CONTROLLER_POWER;
export const CREEP_CORPSE_RATE: number = C.CREEP_CORPSE_RATE;
export const TOMBSTONE_DECAY_PER_PART: number = C.TOMBSTONE_DECAY_PER_PART;
export const DISMANTLE_COST: number = C.DISMANTLE_COST;
export const REPAIR_COST: number = C.REPAIR_COST;
export const CARRY_CAPACITY: number = C.CARRY_CAPACITY;
export const ENERGY_REGEN_TIME: number = C.ENERGY_REGEN_TIME;
export const CREEP_LIFE_TIME: number = C.CREEP_LIFE_TIME;
export const CREEP_CLAIM_LIFE_TIME: number = C.CREEP_CLAIM_LIFE_TIME;
export const CREEP_PART_MAX_ENERGY: number = C.CREEP_PART_MAX_ENERGY;
export const CREEP_SPAWN_TIME: number = C.CREEP_SPAWN_TIME;
export const MAX_CREEP_SIZE: number = C.MAX_CREEP_SIZE;
export const SPAWN_RENEW_RATIO: number = C.SPAWN_RENEW_RATIO;
export const LINK_COOLDOWN: number = C.LINK_COOLDOWN;
export const LINK_LOSS_RATIO: number = C.LINK_LOSS_RATIO;
export const EXTRACTOR_COOLDOWN: number = C.EXTRACTOR_COOLDOWN;
export const OBSERVER_RANGE: number = C.OBSERVER_RANGE;
export const HARVEST_MINERAL_POWER: number = C.HARVEST_MINERAL_POWER;
export const TOWER_POWER_ATTACK: number = C.TOWER_POWER_ATTACK;
export const TOWER_POWER_HEAL: number = C.TOWER_POWER_HEAL;
export const TOWER_POWER_REPAIR: number = C.TOWER_POWER_REPAIR;
export const TOWER_OPTIMAL_RANGE: number = C.TOWER_OPTIMAL_RANGE;
export const TOWER_FALLOFF_RANGE: number = C.TOWER_FALLOFF_RANGE;
export const TOWER_FALLOFF: number = C.TOWER_FALLOFF;

// Structure hits
export const SPAWN_HITS: number = C.SPAWN_HITS;
export const EXTENSION_HITS: number = C.EXTENSION_HITS;
export const ROAD_HITS: number = C.ROAD_HITS;
export const WALL_HITS: number = C.WALL_HITS;
export const WALL_HITS_MAX: number = C.WALL_HITS_MAX;
export const RAMPART_HITS: number = C.RAMPART_HITS;
export const LINK_HITS: number = C.LINK_HITS;
export const STORAGE_HITS: number = C.STORAGE_HITS;
export const TOWER_HITS: number = C.TOWER_HITS;
export const OBSERVER_HITS: number = C.OBSERVER_HITS;
export const POWER_SPAWN_HITS: number = C.POWER_SPAWN_HITS;
export const EXTRACTOR_HITS: number = C.EXTRACTOR_HITS;
export const LAB_HITS: number = C.LAB_HITS;
export const TERMINAL_HITS: number = C.TERMINAL_HITS;
export const CONTAINER_HITS: number = C.CONTAINER_HITS;
export const NUKER_HITS: number = C.NUKER_HITS;
export const FACTORY_HITS: number = C.FACTORY_HITS;

// Dropped resource decay
export const ENERGY_DECAY: number = C.ENERGY_DECAY;

// Container decay
export const CONTAINER_DECAY: number = C.CONTAINER_DECAY;
export const CONTAINER_DECAY_TIME: number = C.CONTAINER_DECAY_TIME;
export const CONTAINER_DECAY_TIME_OWNED: number = C.CONTAINER_DECAY_TIME_OWNED;

// Rampart decay
export const RAMPART_DECAY_AMOUNT: number = C.RAMPART_DECAY_AMOUNT;
export const RAMPART_DECAY_TIME: number = C.RAMPART_DECAY_TIME;

// Road decay and wear
export const ROAD_DECAY_AMOUNT: number = C.ROAD_DECAY_AMOUNT;
export const ROAD_DECAY_TIME: number = C.ROAD_DECAY_TIME;
export const ROAD_WEAROUT: number = C.ROAD_WEAROUT;
export const ROAD_WEAROUT_POWER_CREEP: number = C.ROAD_WEAROUT_POWER_CREEP;
export const CONSTRUCTION_COST_ROAD_SWAMP_RATIO: number = C.CONSTRUCTION_COST_ROAD_SWAMP_RATIO;
export const CONSTRUCTION_COST_ROAD_WALL_RATIO: number = C.CONSTRUCTION_COST_ROAD_WALL_RATIO;

// Source energy
export const SOURCE_ENERGY_CAPACITY: number = C.SOURCE_ENERGY_CAPACITY;
export const SOURCE_ENERGY_NEUTRAL_CAPACITY: number = C.SOURCE_ENERGY_NEUTRAL_CAPACITY;
export const SOURCE_ENERGY_KEEPER_CAPACITY: number = C.SOURCE_ENERGY_KEEPER_CAPACITY;
export const INVADERS_ENERGY_GOAL: number = C.INVADERS_ENERGY_GOAL;

// Ruin decay
export const RUIN_DECAY: number = C.RUIN_DECAY;

// Store capacities
export const STORAGE_CAPACITY: number = C.STORAGE_CAPACITY;
export const TERMINAL_CAPACITY: number = C.TERMINAL_CAPACITY;
export const TERMINAL_COOLDOWN: number = C.TERMINAL_COOLDOWN;
export const CONTAINER_CAPACITY: number = C.CONTAINER_CAPACITY;
export const TOWER_CAPACITY: number = C.TOWER_CAPACITY;
export const SPAWN_ENERGY_CAPACITY: number = C.SPAWN_ENERGY_CAPACITY;
export const LINK_CAPACITY: number = C.LINK_CAPACITY;
export const LAB_MINERAL_CAPACITY: number = C.LAB_MINERAL_CAPACITY;
export const LAB_ENERGY_CAPACITY: number = C.LAB_ENERGY_CAPACITY;
export const LAB_REACTION_AMOUNT: number = C.LAB_REACTION_AMOUNT;
export const LAB_BOOST_MINERAL: number = C.LAB_BOOST_MINERAL;
export const LAB_BOOST_ENERGY: number = C.LAB_BOOST_ENERGY;
export const NUKER_ENERGY_CAPACITY: number = C.NUKER_ENERGY_CAPACITY;
export const NUKER_GHODIUM_CAPACITY: number = C.NUKER_GHODIUM_CAPACITY;
export const POWER_SPAWN_ENERGY_CAPACITY: number = C.POWER_SPAWN_ENERGY_CAPACITY;
export const POWER_SPAWN_POWER_CAPACITY: number = C.POWER_SPAWN_POWER_CAPACITY;
export const FACTORY_CAPACITY: number = C.FACTORY_CAPACITY;

// Mineral density
export const DENSITY_LOW: 1 = C.DENSITY_LOW;
export const DENSITY_MODERATE: 2 = C.DENSITY_MODERATE;
export const DENSITY_HIGH: 3 = C.DENSITY_HIGH;
export const DENSITY_ULTRA: 4 = C.DENSITY_ULTRA;

// RawMemory segment limits
export const MAX_ACTIVE_SEGMENTS: number = C.MAX_ACTIVE_SEGMENTS;
export const MAX_SEGMENT_COUNT: number = C.MAX_SEGMENT_COUNT;
export const MAX_SEGMENT_SIZE: number = C.MAX_SEGMENT_SIZE;

// Nuke
export const NUKE_RANGE: number = C.NUKE_RANGE;
export const NUKE_LAND_TIME: number = C.NUKE_LAND_TIME;
export const NUKE_DAMAGE: Record<number, number> = C.NUKE_DAMAGE;
export const NUKER_COOLDOWN: number = C.NUKER_COOLDOWN;

// Power constants
export const PWR_OPERATE_TOWER: number = C.PWR_OPERATE_TOWER;
export const PWR_OPERATE_STORAGE: number = C.PWR_OPERATE_STORAGE;
export const PWR_DISRUPT_SPAWN: number = C.PWR_DISRUPT_SPAWN;
export const PWR_DISRUPT_TOWER: number = C.PWR_DISRUPT_TOWER;
export const PWR_OPERATE_LAB: number = C.PWR_OPERATE_LAB;
export const PWR_OPERATE_OBSERVER: number = C.PWR_OPERATE_OBSERVER;
export const PWR_OPERATE_FACTORY: number = C.PWR_OPERATE_FACTORY;
export const PWR_OPERATE_TERMINAL: number = C.PWR_OPERATE_TERMINAL;
export const PWR_REGEN_SOURCE: number = C.PWR_REGEN_SOURCE;
export const PWR_REGEN_MINERAL: number = C.PWR_REGEN_MINERAL;
export const PWR_OPERATE_SPAWN: number = C.PWR_OPERATE_SPAWN;
export const PWR_OPERATE_POWER: number = C.PWR_OPERATE_POWER;
export const PWR_OPERATE_CONTROLLER: number = C.PWR_OPERATE_CONTROLLER;
export const PWR_SHIELD: number = C.PWR_SHIELD;
export const PWR_FORTIFY: number = C.PWR_FORTIFY;
export const PWR_DISRUPT_SOURCE: number = C.PWR_DISRUPT_SOURCE;
export const PWR_DISRUPT_TERMINAL: number = C.PWR_DISRUPT_TERMINAL;

// Power creep / power bank
export const POWER_LEVEL_MULTIPLY: number = C.POWER_LEVEL_MULTIPLY;
export const POWER_LEVEL_POW: number = C.POWER_LEVEL_POW;
export const POWER_CREEP_LIFE_TIME: number = C.POWER_CREEP_LIFE_TIME;
export const POWER_SPAWN_ENERGY_RATIO: number = C.POWER_SPAWN_ENERGY_RATIO;
export const POWER_BANK_HIT_BACK: number = C.POWER_BANK_HIT_BACK;
export const POWER_BANK_CAPACITY_MAX: number = C.POWER_BANK_CAPACITY_MAX;
export const POWER_BANK_CAPACITY_MIN: number = C.POWER_BANK_CAPACITY_MIN;
export const POWER_BANK_DECAY: number = C.POWER_BANK_DECAY;
export const POWER_BANK_HITS: number = C.POWER_BANK_HITS;
export const TOMBSTONE_DECAY_POWER_CREEP: number = C.TOMBSTONE_DECAY_POWER_CREEP;

// Safe mode
export const SAFE_MODE_DURATION: number = C.SAFE_MODE_DURATION;
export const SAFE_MODE_COOLDOWN: number = C.SAFE_MODE_COOLDOWN;
export const SAFE_MODE_COST: number = C.SAFE_MODE_COST;
export const CONTROLLER_DOWNGRADE_SAFEMODE_THRESHOLD: number = C.CONTROLLER_DOWNGRADE_SAFEMODE_THRESHOLD;
export const CONTROLLER_DOWNGRADE: Record<number, number> = C.CONTROLLER_DOWNGRADE;
export const CONTROLLER_CLAIM_DOWNGRADE: number = C.CONTROLLER_CLAIM_DOWNGRADE;
export const CONTROLLER_LEVELS: Record<number, number> = C.CONTROLLER_LEVELS;
export const CONTROLLER_RESERVE: number = C.CONTROLLER_RESERVE;
export const CONTROLLER_RESERVE_MAX: number = C.CONTROLLER_RESERVE_MAX;
export const CONTROLLER_MAX_UPGRADE_PER_TICK: number = C.CONTROLLER_MAX_UPGRADE_PER_TICK;
export const CONTROLLER_ATTACK_BLOCKED_UPGRADE: number = C.CONTROLLER_ATTACK_BLOCKED_UPGRADE;
export const CONTROLLER_NUKE_BLOCKED_UPGRADE: number = C.CONTROLLER_NUKE_BLOCKED_UPGRADE;

// Construction site limit
export const MAX_CONSTRUCTION_SITES: number = C.MAX_CONSTRUCTION_SITES;

// Flags
export const FLAGS_LIMIT: number = C.FLAGS_LIMIT;
export const MARKET_ORDER_LIFE_TIME: number = C.MARKET_ORDER_LIFE_TIME;
export const COLOR_RED: number = C.COLOR_RED;
export const COLOR_BLUE: number = C.COLOR_BLUE;
export const COLOR_GREEN: number = C.COLOR_GREEN;
export const COLOR_WHITE: number = C.COLOR_WHITE;

// Event log
export const EVENT_ATTACK: number = C.EVENT_ATTACK;
export const EVENT_OBJECT_DESTROYED: number = C.EVENT_OBJECT_DESTROYED;
export const EVENT_ATTACK_CONTROLLER: number = C.EVENT_ATTACK_CONTROLLER;
export const EVENT_BUILD: number = C.EVENT_BUILD;
export const EVENT_HARVEST: number = C.EVENT_HARVEST;
export const EVENT_HEAL: number = C.EVENT_HEAL;
export const EVENT_REPAIR: number = C.EVENT_REPAIR;
export const EVENT_RESERVE_CONTROLLER: number = C.EVENT_RESERVE_CONTROLLER;
export const EVENT_UPGRADE_CONTROLLER: number = C.EVENT_UPGRADE_CONTROLLER;
export const EVENT_EXIT: number = C.EVENT_EXIT;
export const EVENT_TRANSFER: number = C.EVENT_TRANSFER;
export const EVENT_POWER: number = C.EVENT_POWER;
export const EVENT_ATTACK_TYPE_MELEE: number = C.EVENT_ATTACK_TYPE_MELEE;
export const EVENT_ATTACK_TYPE_RANGED: number = C.EVENT_ATTACK_TYPE_RANGED;
export const EVENT_ATTACK_TYPE_RANGED_MASS: number = C.EVENT_ATTACK_TYPE_RANGED_MASS;
export const EVENT_ATTACK_TYPE_DISMANTLE: number = C.EVENT_ATTACK_TYPE_DISMANTLE;
export const EVENT_ATTACK_TYPE_HIT_BACK: number = C.EVENT_ATTACK_TYPE_HIT_BACK;
export const EVENT_ATTACK_TYPE_NUKE: number = C.EVENT_ATTACK_TYPE_NUKE;
export const EVENT_HEAL_TYPE_MELEE: number = C.EVENT_HEAL_TYPE_MELEE;
export const EVENT_HEAL_TYPE_RANGED: number = C.EVENT_HEAL_TYPE_RANGED;

// Lab unboost
export const LAB_UNBOOST_ENERGY: number = C.LAB_UNBOOST_ENERGY;
export const LAB_UNBOOST_MINERAL: number = C.LAB_UNBOOST_MINERAL;

// Terrain (TERRAIN_PLAIN is 0 by convention; @screeps/common only exports the masks)
export const TERRAIN_PLAIN = 0 as const;
export const TERRAIN_WALL: 1 = C.TERRAIN_MASK_WALL;
export const TERRAIN_SWAMP: 2 = C.TERRAIN_MASK_SWAMP;
