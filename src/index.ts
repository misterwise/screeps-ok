// Framework
export { code } from './code.js';
export type { PlayerCode } from './code.js';
export { RunPlayerError } from './errors.js';
export { test, describe, expect } from './fixture.js';

// Adapter contract
export type {
	ScreepsOkAdapter, AdapterCapabilities, PlayerReturnValue,
	ShardSpec, RoomSpec, TerrainSpec,
	CreepSpec, StructureSpec, SiteSpec, SourceSpec, MineralSpec,
	FlagSpec, TombstoneSpec, RuinSpec, DroppedResourceSpec,
} from './adapter.js';
export type { SupportedFindConstant, NeutralFindSelector } from './find.js';

// Snapshots
export type {
	ObjectSnapshot, PosSnapshot,
	CreepSnapshot, StructureSnapshotBase, StructureSnapshot,
	ControllerSnapshot, SpawnSnapshot, LabSnapshot, TowerSnapshot,
	StorageSnapshot, LinkSnapshot, RampartSnapshot,
	TerminalSnapshot, FactorySnapshot, ExtensionSnapshot,
	ContainerSnapshot, ExtractorSnapshot, RoadSnapshot,
	NukerSnapshot, PowerSpawnSnapshot, WallSnapshot,
	SiteSnapshot, SourceSnapshot, MineralSnapshot,
	TombstoneSnapshot, RuinSnapshot, DroppedResourceSnapshot,
} from './snapshots/common.js';

// Screeps constants — for readable assertions in tests
export {
	// Return codes
	OK, ERR_NOT_OWNER, ERR_NO_PATH, ERR_NAME_EXISTS, ERR_BUSY,
	ERR_NOT_FOUND, ERR_NOT_ENOUGH_ENERGY, ERR_NOT_ENOUGH_RESOURCES,
	ERR_INVALID_TARGET, ERR_FULL, ERR_NOT_IN_RANGE, ERR_INVALID_ARGS,
	ERR_TIRED, ERR_NO_BODYPART, ERR_RCL_NOT_ENOUGH, ERR_GCL_NOT_ENOUGH,
	// Directions
	TOP, TOP_RIGHT, RIGHT, BOTTOM_RIGHT, BOTTOM, BOTTOM_LEFT, LEFT, TOP_LEFT,
	// Body parts
	MOVE, WORK, CARRY, ATTACK, RANGED_ATTACK, TOUGH, HEAL, CLAIM,
	// FIND constants
	FIND_CREEPS, FIND_MY_CREEPS, FIND_HOSTILE_CREEPS,
	FIND_SOURCES, FIND_SOURCES_ACTIVE, FIND_DROPPED_RESOURCES,
	FIND_STRUCTURES, FIND_MY_STRUCTURES, FIND_HOSTILE_STRUCTURES,
	FIND_FLAGS, FIND_CONSTRUCTION_SITES, FIND_MY_SPAWNS, FIND_HOSTILE_SPAWNS,
	FIND_MINERALS, FIND_NUKES, FIND_TOMBSTONES, FIND_RUINS,
	FIND_EXIT, FIND_EXIT_TOP, FIND_EXIT_RIGHT, FIND_EXIT_BOTTOM, FIND_EXIT_LEFT,
	// LOOK constants
	LOOK_CREEPS, LOOK_ENERGY, LOOK_RESOURCES, LOOK_SOURCES, LOOK_MINERALS,
	LOOK_STRUCTURES, LOOK_FLAGS, LOOK_CONSTRUCTION_SITES, LOOK_TERRAIN,
	LOOK_TOMBSTONES, LOOK_RUINS,
	// Structure types
	STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_ROAD, STRUCTURE_WALL,
	STRUCTURE_RAMPART, STRUCTURE_CONTROLLER, STRUCTURE_LINK, STRUCTURE_STORAGE,
	STRUCTURE_TOWER, STRUCTURE_OBSERVER, STRUCTURE_POWER_SPAWN,
	STRUCTURE_EXTRACTOR, STRUCTURE_LAB, STRUCTURE_TERMINAL,
	STRUCTURE_CONTAINER, STRUCTURE_NUKER, STRUCTURE_FACTORY, STRUCTURE_KEEPER_LAIR,
	// Resources
	RESOURCE_ENERGY, RESOURCE_POWER,
	// Gameplay
	HARVEST_POWER, REPAIR_POWER, DISMANTLE_POWER, BUILD_POWER,
	ATTACK_POWER, RANGED_ATTACK_POWER, HEAL_POWER, RANGED_HEAL_POWER,
	CARRY_CAPACITY, ENERGY_REGEN_TIME, CREEP_LIFE_TIME,
	BODYPART_COST, LINK_COOLDOWN, LINK_LOSS_RATIO,
	TOWER_POWER_ATTACK, TOWER_POWER_HEAL, TOWER_POWER_REPAIR,
	TOWER_OPTIMAL_RANGE, TOWER_FALLOFF_RANGE, TOWER_FALLOFF,
	RAMPART_HITS_MAX,
	// Terrain
	TERRAIN_PLAIN, TERRAIN_WALL, TERRAIN_SWAMP,
} from './constants.js';

// Helpers
export { body } from './helpers/body.js';
