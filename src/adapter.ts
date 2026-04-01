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
	chemistry: boolean;
	powerCreeps: boolean;
	factory: boolean;
	market: boolean;
	observer: boolean;
	nuke: boolean;
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
	readonly capabilities: AdapterCapabilities;

	createShard(spec: ShardSpec): Promise<void>;

	placeCreep(room: string, spec: CreepSpec): Promise<string>;
	placeStructure(room: string, spec: StructureSpec): Promise<string>;
	placeSite(room: string, spec: SiteSpec): Promise<string>;
	placeSource(room: string, spec: SourceSpec): Promise<string>;
	placeMineral(room: string, spec: MineralSpec): Promise<string>;
	placeFlag(room: string, spec: FlagSpec): Promise<string>;
	placeTombstone(room: string, spec: TombstoneSpec): Promise<string>;
	placeRuin(room: string, spec: RuinSpec): Promise<string>;
	placeDroppedResource(room: string, spec: DroppedResourceSpec): Promise<string>;
	placeObject(room: string, type: string, spec: Record<string, unknown>): Promise<string>;

	setTerrain(room: string, terrain: TerrainSpec): Promise<void>;

	runPlayer(userId: string, playerCode: PlayerCode): Promise<PlayerReturnValue>;
	tick(count?: number): Promise<void>;

	getObject(id: string): Promise<ObjectSnapshot | null>;

	findInRoom(room: string, type: 'creeps'): Promise<CreepSnapshot[]>;
	findInRoom(room: string, type: 'structures'): Promise<StructureSnapshot[]>;
	findInRoom(room: string, type: 'constructionSites'): Promise<SiteSnapshot[]>;
	findInRoom(room: string, type: 'sources'): Promise<SourceSnapshot[]>;
	findInRoom(room: string, type: 'minerals'): Promise<MineralSnapshot[]>;
	findInRoom(room: string, type: 'tombstones'): Promise<TombstoneSnapshot[]>;
	findInRoom(room: string, type: 'ruins'): Promise<RuinSnapshot[]>;
	findInRoom(room: string, type: 'droppedResources'): Promise<DroppedResourceSnapshot[]>;
	findInRoom(room: string, type: string): Promise<ObjectSnapshot[]>;

	getGameTime(): Promise<number>;
	teardown(): Promise<void>;
}
