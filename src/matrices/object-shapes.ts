/**
 * Canonical enumerable data-property surfaces for Screeps game objects.
 *
 * These shapes represent the player-facing API surface as documented at
 * https://docs.screeps.com/api/ — prototype getters and non-function
 * own properties, excluding methods, constructor, and underscore-
 * prefixed internal fields.
 *
 * Discovered empirically on vanilla server; pinned here so both
 * adapters can assert exact conformance. If vanilla's surface changes,
 * update here and the tests will catch the drift on the next run.
 */
import {
	STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_ROAD, STRUCTURE_WALL,
	STRUCTURE_RAMPART, STRUCTURE_LINK, STRUCTURE_STORAGE, STRUCTURE_TOWER,
	STRUCTURE_OBSERVER, STRUCTURE_POWER_SPAWN, STRUCTURE_EXTRACTOR,
	STRUCTURE_LAB, STRUCTURE_TERMINAL, STRUCTURE_CONTAINER,
	STRUCTURE_NUKER, STRUCTURE_FACTORY,
	STRUCTURE_KEEPER_LAIR, STRUCTURE_POWER_BANK, STRUCTURE_INVADER_CORE,
} from '../index.js';
import type { CapabilityName } from '../index.js';

// ── Helpers ──────────────────────────────────────────────────────────

/** Sort at definition time so test assertions can use direct equality. */
const shape = (...keys: string[]) => Object.freeze(keys.sort());

// ── Core objects ─────────────────────────────────────────────────────

export const CREEP_SHAPE = shape(
	'body', 'carry', 'carryCapacity', 'fatigue', 'hits', 'hitsMax',
	'id', 'memory', 'my', 'name', 'owner', 'pos', 'room',
	'saying', 'spawning', 'store', 'ticksToLive',
);

export const POWER_CREEP_SHAPE = shape(
	'carry', 'carryCapacity', 'className', 'deleteTime', 'hits', 'hitsMax',
	'id', 'level', 'memory', 'my', 'name', 'owner', 'pos', 'powers',
	'room', 'saying', 'shard', 'spawnCooldownTime', 'store', 'ticksToLive',
);

// ── Sub-objects ──────────────────────────────────────────────────────

export const BODY_PART_SHAPE = shape('hits', 'type');
export const BODY_PART_BOOSTED_SHAPE = shape('boost', 'hits', 'type');
export const OWNER_SHAPE = shape('username');
export const ROOM_POSITION_SHAPE = shape('roomName', 'x', 'y');
export const SPAWNING_SHAPE = shape('directions', 'name', 'needTime', 'remainingTime', 'spawn');
export const RESERVATION_SHAPE = shape('ticksToEnd', 'username');
export const SIGN_SHAPE = shape('datetime', 'text', 'time', 'username');

// ── Room & controller ────────────────────────────────────────────────

export const ROOM_SHAPE = shape(
	'controller', 'energyAvailable', 'energyCapacityAvailable',
	'memory', 'name', 'survivalInfo', 'visual',
);

export const CONTROLLER_SHAPE = shape(
	'hits', 'hitsMax', 'id', 'isPowerEnabled', 'level', 'my', 'owner',
	'pos', 'progress', 'progressTotal', 'reservation', 'room',
	'safeMode', 'safeModeAvailable', 'safeModeCooldown', 'sign',
	'structureType', 'ticksToDowngrade', 'upgradeBlocked',
);

// ── Game globals ─────────────────────────────────────────────────────

export const GAME_SHAPE = shape(
	'constructionSites', 'cpu', 'cpuLimit', 'creeps', 'flags', 'gcl',
	'gpl', 'map', 'market', 'powerCreeps', 'resources', 'rooms',
	'shard', 'spawns', 'structures', 'time',
);

export const GAME_CPU_SHAPE = shape('bucket', 'limit', 'tickLimit');
export const GAME_MAP_SHAPE = shape('visual');
export const GAME_SHARD_SHAPE = shape('name', 'ptr', 'type');
export const GAME_GCL_SHAPE = shape('level', 'progress', 'progressTotal');
export const GAME_GPL_SHAPE = shape('level', 'progress', 'progressTotal');

// ── World objects ────────────────────────────────────────────────────

export const SOURCE_SHAPE = shape(
	'energy', 'energyCapacity', 'id', 'pos', 'room', 'ticksToRegeneration',
);

export const MINERAL_SHAPE = shape(
	'density', 'id', 'mineralAmount', 'mineralType', 'pos', 'room',
	'ticksToRegeneration',
);

export const CONSTRUCTION_SITE_SHAPE = shape(
	'id', 'my', 'name', 'owner', 'pos', 'progress', 'progressTotal',
	'room', 'structureType',
);

export const FLAG_SHAPE = shape(
	'color', 'memory', 'name', 'pos', 'room', 'secondaryColor',
);

export const DROPPED_RESOURCE_SHAPE = shape(
	'amount', 'energy', 'id', 'pos', 'resourceType', 'room',
);

export const TOMBSTONE_SHAPE = shape(
	'creep', 'deathTime', 'id', 'pos', 'room', 'store', 'ticksToDecay',
);

export const RUIN_SHAPE = shape(
	'destroyTime', 'id', 'pos', 'room', 'store', 'structure',
	'structureType', 'ticksToDecay',
);

export const NUKE_SHAPE = shape(
	'id', 'launchRoomName', 'pos', 'room', 'timeToLand',
);

export const DEPOSIT_SHAPE = shape(
	'cooldown', 'depositType', 'id', 'lastCooldown', 'pos', 'room',
	'ticksToDecay',
);

// ── Game sub-objects ─────────────────────────────────────────────────

export const GAME_MARKET_SHAPE = shape(
	'credits', 'incomingTransactions', 'orders', 'outgoingTransactions',
);

// ── Structures (per-type) ────────────────────────────────────────────

export interface StructureShapeEntry {
	structureType: string;
	shape: readonly string[];
	rcl: number;
	owned: boolean;
	cap?: CapabilityName;
	/** Extra spec fields for placeStructure (e.g. store contents). */
	extra?: Record<string, unknown>;
}

export const structureShapes: readonly StructureShapeEntry[] = [
	{
		structureType: STRUCTURE_SPAWN, rcl: 1, owned: true,
		extra: { store: { energy: 300 } },
		shape: shape(
			'energy', 'energyCapacity', 'hits', 'hitsMax', 'id', 'memory',
			'my', 'name', 'owner', 'pos', 'room', 'spawning', 'store',
			'structureType',
		),
	},
	{
		structureType: STRUCTURE_EXTENSION, rcl: 2, owned: true,
		extra: { store: { energy: 50 } },
		shape: shape(
			'energy', 'energyCapacity', 'hits', 'hitsMax', 'id', 'my',
			'owner', 'pos', 'room', 'store', 'structureType',
		),
	},
	{
		structureType: STRUCTURE_ROAD, rcl: 1, owned: false,
		shape: shape(
			'hits', 'hitsMax', 'id', 'pos', 'room', 'structureType',
			'ticksToDecay',
		),
	},
	{
		structureType: STRUCTURE_WALL, rcl: 2, owned: false,
		shape: shape(
			'hits', 'hitsMax', 'id', 'pos', 'room', 'structureType',
			'ticksToLive',
		),
	},
	{
		structureType: STRUCTURE_RAMPART, rcl: 2, owned: true,
		shape: shape(
			'hits', 'hitsMax', 'id', 'isPublic', 'my', 'owner', 'pos',
			'room', 'structureType', 'ticksToDecay',
		),
	},
	{
		structureType: STRUCTURE_LINK, rcl: 5, owned: true,
		extra: { store: { energy: 100 } },
		shape: shape(
			'cooldown', 'energy', 'energyCapacity', 'hits', 'hitsMax', 'id',
			'my', 'owner', 'pos', 'room', 'store', 'structureType',
		),
	},
	{
		structureType: STRUCTURE_STORAGE, rcl: 4, owned: true,
		extra: { store: { energy: 500 } },
		shape: shape(
			'hits', 'hitsMax', 'id', 'my', 'owner', 'pos', 'room', 'store',
			'storeCapacity', 'structureType',
		),
	},
	{
		structureType: STRUCTURE_TOWER, rcl: 3, owned: true,
		extra: { store: { energy: 100 } },
		shape: shape(
			'energy', 'energyCapacity', 'hits', 'hitsMax', 'id', 'my',
			'owner', 'pos', 'room', 'store', 'structureType',
		),
	},
	{
		structureType: STRUCTURE_EXTRACTOR, rcl: 6, owned: true,
		shape: shape(
			'cooldown', 'hits', 'hitsMax', 'id', 'my', 'owner', 'pos',
			'room', 'structureType',
		),
	},
	{
		structureType: STRUCTURE_LAB, rcl: 6, owned: true,
		shape: shape(
			'cooldown', 'energy', 'energyCapacity', 'hits', 'hitsMax', 'id',
			'mineralAmount', 'mineralCapacity', 'mineralType', 'my', 'owner',
			'pos', 'room', 'store', 'structureType',
		),
	},
	{
		structureType: STRUCTURE_TERMINAL, rcl: 6, owned: true, cap: 'market',
		shape: shape(
			'cooldown', 'hits', 'hitsMax', 'id', 'my', 'owner', 'pos',
			'room', 'store', 'storeCapacity', 'structureType',
		),
	},
	{
		structureType: STRUCTURE_CONTAINER, rcl: 1, owned: false,
		extra: { store: { energy: 200 } },
		shape: shape(
			'hits', 'hitsMax', 'id', 'pos', 'room', 'store',
			'storeCapacity', 'structureType', 'ticksToDecay',
		),
	},
	{
		structureType: STRUCTURE_OBSERVER, rcl: 8, owned: true, cap: 'observer',
		shape: shape(
			'hits', 'hitsMax', 'id', 'my', 'owner', 'pos', 'room',
			'structureType',
		),
	},
	{
		structureType: STRUCTURE_FACTORY, rcl: 7, owned: true, cap: 'factory',
		shape: shape(
			'cooldown', 'hits', 'hitsMax', 'id', 'level', 'my', 'owner',
			'pos', 'room', 'store', 'storeCapacity', 'structureType',
		),
	},
	{
		structureType: STRUCTURE_NUKER, rcl: 8, owned: true, cap: 'nuke',
		extra: { store: { energy: 100 } },
		shape: shape(
			'cooldown', 'energy', 'energyCapacity', 'ghodium',
			'ghodiumCapacity', 'hits', 'hitsMax', 'id', 'my', 'owner',
			'pos', 'room', 'store', 'structureType',
		),
	},
	{
		structureType: STRUCTURE_POWER_SPAWN, rcl: 8, owned: true, cap: 'powerCreeps',
		extra: { store: { energy: 100 } },
		shape: shape(
			'energy', 'energyCapacity', 'hits', 'hitsMax', 'id', 'my',
			'owner', 'pos', 'power', 'powerCapacity', 'room', 'store',
			'structureType',
		),
	},
] as const;

// ── NPC / special structures ─────────────────────────────────────────
// These use placeObject() rather than placeStructure(), so they are
// kept in a separate array with a different placement interface.

export interface NpcShapeEntry {
	catalogId: string;
	objectType: string;
	shape: readonly string[];
	/** Adapter limitation that gates placement. */
	limitation?: string;
	/** Adapter capability that gates placement. */
	cap?: CapabilityName;
	/** Spec fields for placeObject. */
	spec: Record<string, unknown>;
}

export const npcShapes: readonly NpcShapeEntry[] = [
	{
		catalogId: 'SHAPE-NPC-001',
		objectType: 'keeperLair', limitation: 'npcStructures',
		spec: { pos: [25, 25], nextSpawnTime: 100 },
		shape: shape(
			'hits', 'hitsMax', 'id', 'my', 'owner', 'pos', 'room',
			'structureType', 'ticksToSpawn',
		),
	},
	{
		catalogId: 'SHAPE-NPC-002',
		objectType: 'invaderCore', limitation: 'npcStructures',
		spec: { pos: [25, 25], level: 2, deployTime: 100 },
		shape: shape(
			'effects', 'hits', 'hitsMax', 'id', 'level', 'my', 'owner',
			'pos', 'room', 'spawning', 'structureType', 'ticksToDeploy',
		),
	},
	{
		catalogId: 'SHAPE-NPC-003',
		objectType: 'powerBank', cap: 'powerCreeps',
		spec: { pos: [25, 25], store: { power: 1000 }, hits: 10000000, hitsMax: 10000000, decayTime: 50000 },
		shape: shape(
			'hits', 'hitsMax', 'id', 'my', 'owner', 'pos', 'power',
			'room', 'structureType', 'ticksToDecay',
		),
	},
	{
		catalogId: 'SHAPE-NPC-004',
		objectType: 'portal', limitation: 'portalPlacement',
		spec: { pos: [25, 25], destination: { x: 25, y: 25, room: 'W3N3' }, decayTime: 50000 },
		shape: shape(
			'destination', 'hits', 'hitsMax', 'id', 'pos', 'room',
			'structureType', 'ticksToDecay',
		),
	},
] as const;
