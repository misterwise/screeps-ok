import type { PlayerCode } from './code.js';
import type {
	ObjectSnapshot, CreepSnapshot, StructureSnapshot, SiteSnapshot,
	SourceSnapshot, MineralSnapshot, TombstoneSnapshot, RuinSnapshot,
	DroppedResourceSnapshot,
} from './snapshots/common.js';

// ── Setup types ──────────────────────────────────────────────

export interface ShardSpec {
	players: string[];
	rooms: RoomSpec[];
}

export interface RoomSpec {
	name: string;
	terrain?: TerrainSpec;
	rcl?: number;
	owner?: string;
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
	/** Custom terrain setup through RoomSpec.terrain / setTerrain. */
	terrain: boolean;
}

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
	/** Escape hatch for uncommon or newly-added public object types. */
	placeObject(room: string, type: string, spec: Record<string, unknown>): Promise<string>;

	/** Update room terrain, if the adapter supports post-creation terrain mutation. */
	setTerrain(room: string, terrain: TerrainSpec): Promise<void>;

	/**
	 * Execute player code for a single test handle.
	 *
	 * The last expression becomes the return value. Only JSON-safe values are
	 * allowed; gameplay return codes are normal results, not errors.
	 */
	runPlayer(userId: string, playerCode: PlayerCode): Promise<PlayerReturnValue>;
	/** Advance gameplay processing by N ticks. */
	tick(count?: number): Promise<void>;

	/** Return a plain JSON snapshot for one object, or null if it no longer exists. */
	getObject(id: string): Promise<ObjectSnapshot | null>;

	/** Perspective-neutral room inspection using string selectors. */
	findInRoom(room: string, type: 'creeps'): Promise<CreepSnapshot[]>;
	findInRoom(room: string, type: 'structures'): Promise<StructureSnapshot[]>;
	findInRoom(room: string, type: 'constructionSites'): Promise<SiteSnapshot[]>;
	findInRoom(room: string, type: 'sources'): Promise<SourceSnapshot[]>;
	findInRoom(room: string, type: 'minerals'): Promise<MineralSnapshot[]>;
	findInRoom(room: string, type: 'tombstones'): Promise<TombstoneSnapshot[]>;
	findInRoom(room: string, type: 'ruins'): Promise<RuinSnapshot[]>;
	findInRoom(room: string, type: 'droppedResources'): Promise<DroppedResourceSnapshot[]>;
	findInRoom(room: string, type: string): Promise<ObjectSnapshot[]>;

	/** Current game time / tick number. */
	getGameTime(): Promise<number>;

	/** Get the controller position for a room. Returns null if no controller. */
	getControllerPos(room: string): Promise<{ x: number; y: number } | null>;

	/** Release any shard, runtime, or process resources held by the adapter. */
	teardown(): Promise<void>;
}
