import type { PlayerCode } from './code.js';
import type {
	ObjectSnapshot, CreepSnapshot, StructureSnapshot, SiteSnapshot,
	SourceSnapshot, MineralSnapshot, TombstoneSnapshot, RuinSnapshot,
	DroppedResourceSnapshot,
} from './snapshots/common.js';
import type { SupportedFindConstant } from './find.js';
import {
	FIND_CREEPS, FIND_STRUCTURES, FIND_CONSTRUCTION_SITES, FIND_SOURCES,
	FIND_MINERALS, FIND_TOMBSTONES, FIND_RUINS, FIND_DROPPED_RESOURCES,
} from './constants.js';

// ── Setup types ──────────────────────────────────────────────

export interface ShardSpec {
	players: (string | PlayerSpec)[];
	rooms: RoomSpec[];
}

export interface PlayerSpec {
	name: string;
	/**
	 * Override the player's GCL at user creation. Defaults to a high value
	 * (~10M) so multi-room claim tests aren't blocked by the cap. Set this
	 * to a low number to honestly trigger ERR_GCL_NOT_ENOUGH on extra claims.
	 *
	 * Honored by adapters that expose a GCL override; the limitations gate
	 * `playerGclControl` reports which adapters do.
	 */
	gcl?: number;
}

export interface RoomSpec {
	name: string;
	terrain?: TerrainSpec;
	rcl?: number;
	owner?: string;
	safeModeAvailable?: number;
	/**
	 * Pre-set the controller's active safe-mode timer in ticks remaining.
	 * Useful for tests that need to observe expiration without ticking
	 * SAFE_MODE_DURATION (20000) times. Adapters convert this to the
	 * engine's absolute `safeMode` field at createShard time.
	 */
	safeMode?: number;
	/** Set the controller's initial downgrade timer (ticks until level loss). */
	ticksToDowngrade?: number;
}

export type TerrainSpec = (0 | 1 | 2)[];

export interface CreepSpec {
	pos: [number, number];
	owner: string;
	body: string[];
	name?: string;
	store?: Record<string, number>;
	ticksToLive?: number;
}

export interface StructureSpec {
	pos: [number, number];
	structureType: string;
	owner?: string;
	hits?: number;
	store?: Record<string, number>;
	ticksToDecay?: number;
}

export interface SiteSpec {
	pos: [number, number];
	owner: string;
	structureType: string;
	progress?: number;
}

export interface SourceSpec {
	pos: [number, number];
	energy?: number;
	energyCapacity?: number;
	ticksToRegeneration?: number;
}

export interface MineralSpec {
	pos: [number, number];
	mineralType: string;
	mineralAmount?: number;
	ticksToRegeneration?: number;
}

export interface FlagSpec {
	pos: [number, number];
	owner: string;
	name: string;
	color?: number;
	secondaryColor?: number;
}

export interface TombstoneSpec {
	pos: [number, number];
	creepName: string;
	deathTime?: number;
	store?: Record<string, number>;
	ticksToDecay?: number;
}

export interface RuinSpec {
	pos: [number, number];
	structureType: string;
	destroyTime?: number;
	store?: Record<string, number>;
	ticksToDecay?: number;
}

export interface DroppedResourceSpec {
	pos: [number, number];
	resourceType: string;
	amount: number;
}

export interface PowerCreepSpec {
	pos: [number, number];
	owner: string;
	name?: string;
	/** Map of PWR_* constant to level (1-5). */
	powers: Record<number, number>;
	store?: Record<string, number>;
}

export interface NukeSpec {
	pos: [number, number];
	launchRoomName: string;
	timeToLand: number;
}

// ── Capabilities ─────────────────────────────────────────────

export interface AdapterCapabilities {
	/** Labs, reactions, minerals in labs, and related chemistry APIs. */
	chemistry: boolean;
	/** Power creeps and their public gameplay APIs. */
	powerCreeps: boolean;
	/** Factory structure and production APIs. */
	factory: boolean;
	/** Market and terminal-driven market interactions. */
	market: boolean;
	/** Observer structure and room observation APIs. */
	observer: boolean;
	/** Nuker structure and nuke APIs. */
	nuke: boolean;
	/** Deposit objects and harvest cooldown lifecycle. */
	deposit: boolean;
	/** Custom terrain setup through RoomSpec.terrain / setTerrain. */
	terrain: boolean;
}

export type CapabilityName = keyof AdapterCapabilities;

// ── Return value constraints ─────────────────────────────────

export type PlayerReturnValue =
	| number
	| string
	| boolean
	| null
	| { [key: string]: PlayerReturnValue }
	| PlayerReturnValue[];

// ── Core adapter interface ───────────────────────────────────

export interface ScreepsOkAdapter {
	/** Feature areas the adapter can exercise honestly. Tests skip on false. */
	readonly capabilities: AdapterCapabilities;

	/** Create a fresh isolated shard for a single test. */
	createShard(spec: ShardSpec): Promise<void>;

	/** Place a creep with exact initial state as described by spec. */
	placeCreep(room: string, spec: CreepSpec): Promise<string>;
	/** Place a structure with exact initial state as described by spec. */
	placeStructure(room: string, spec: StructureSpec): Promise<string>;
	placeSite(room: string, spec: SiteSpec): Promise<string>;
	placeSource(room: string, spec: SourceSpec): Promise<string>;
	placeMineral(room: string, spec: MineralSpec): Promise<string>;
	placeFlag(room: string, spec: FlagSpec): Promise<string>;
	placeTombstone(room: string, spec: TombstoneSpec): Promise<string>;
	placeRuin(room: string, spec: RuinSpec): Promise<string>;
	placeDroppedResource(room: string, spec: DroppedResourceSpec): Promise<string>;
	placePowerCreep(room: string, spec: PowerCreepSpec): Promise<string>;
	placeNuke(room: string, spec: NukeSpec): Promise<string>;
	/** Escape hatch for uncommon or newly-added public object types. */
	placeObject(room: string, type: string, spec: Record<string, unknown>): Promise<string>;

	/** Update room terrain, if the adapter supports post-creation terrain mutation. */
	setTerrain(room: string, terrain: TerrainSpec): Promise<void>;

	/**
	 * Execute player code for a single test handle.
	 *
	 * The last expression becomes the return value. Only JSON-safe values are
	 * allowed; a top-level undefined return is normalized to null; gameplay
	 * return codes are normal results, not errors.
	 */
	runPlayer(userId: string, playerCode: PlayerCode): Promise<PlayerReturnValue>;
	/**
	 * Execute player code for multiple test handles against the same game state.
	 *
	 * Adapters should preserve same-tick observation semantics for all supplied
	 * players rather than advancing gameplay between evaluations. Return-value
	 * rules match runPlayer, including top-level undefined normalization.
	 */
	runPlayers(codesByUser: Record<string, PlayerCode>): Promise<Record<string, PlayerReturnValue>>;
	/** Advance gameplay processing by N ticks. */
	tick(count?: number): Promise<void>;

	/** Return a plain JSON snapshot for one object, or null if it no longer exists. */
	getObject(id: string): Promise<ObjectSnapshot | null>;

	/** Perspective-neutral room inspection using supported Screeps FIND_* constants. */
	findInRoom(room: string, type: typeof FIND_CREEPS): Promise<CreepSnapshot[]>;
	findInRoom(room: string, type: typeof FIND_STRUCTURES): Promise<StructureSnapshot[]>;
	findInRoom(room: string, type: typeof FIND_CONSTRUCTION_SITES): Promise<SiteSnapshot[]>;
	findInRoom(room: string, type: typeof FIND_SOURCES): Promise<SourceSnapshot[]>;
	findInRoom(room: string, type: typeof FIND_MINERALS): Promise<MineralSnapshot[]>;
	findInRoom(room: string, type: typeof FIND_TOMBSTONES): Promise<TombstoneSnapshot[]>;
	findInRoom(room: string, type: typeof FIND_RUINS): Promise<RuinSnapshot[]>;
	findInRoom(room: string, type: typeof FIND_DROPPED_RESOURCES): Promise<DroppedResourceSnapshot[]>;
	findInRoom(room: string, type: SupportedFindConstant): Promise<ObjectSnapshot[]>;

	/** Current game time / tick number. */
	getGameTime(): Promise<number>;

	/** Get the controller position for a room. Returns null if no controller. */
	getControllerPos(room: string): Promise<{ x: number; y: number } | null>;

	/** Release any shard, runtime, or process resources held by the adapter. */
	teardown(): Promise<void>;
}
