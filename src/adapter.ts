import type { PlayerCode } from './code.js';
import type {
	ObjectSnapshot, CreepSnapshot, StructureSnapshot, SiteSnapshot,
	SourceSnapshot, MineralSnapshot, DepositSnapshot, TombstoneSnapshot, RuinSnapshot,
	DroppedResourceSnapshot,
} from './snapshots/common.js';
import type { SupportedFindConstant } from './find.js';
import {
	FIND_CREEPS, FIND_STRUCTURES, FIND_CONSTRUCTION_SITES, FIND_SOURCES,
	FIND_MINERALS, FIND_TOMBSTONES, FIND_DEPOSITS, FIND_RUINS, FIND_DROPPED_RESOURCES,
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
	 */
	gcl?: number;
	/**
	 * Override the player's processed account power at user creation. Vanilla
	 * derives Game.gpl from this value. Defaults high enough to allow existing
	 * power creep tests to create and upgrade power creeps.
	 */
	power?: number;
}

export type RoomStatusSpec = 'normal' | 'novice' | 'respawn' | 'closed';

export interface RoomSpec {
	name: string;
	terrain?: TerrainSpec;
	rcl?: number;
	owner?: string;
	/**
	 * Seed public room status for Game.map.getRoomStatus() and engine guards
	 * that consult novice/respawn protection. Defaults to `normal`.
	 */
	status?: RoomStatusSpec;
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
	/**
	 * Pre-apply boosts to body parts. Map key is the body-part index (0-based,
	 * matching the order in `body`); value is the boost mineral type (e.g. 'UH').
	 * The adapter must set `body[index].boost = mineralType` and extend
	 * `storeCapacity` for any boost whose effect is `capacity > 1` (carry
	 * boosts: KH, KH2O, XKH2O).
	 */
	boosts?: Record<number, string>;
}

export interface StructureSpec {
	pos: [number, number];
	structureType: string;
	owner?: string;
	hits?: number;
	store?: Record<string, number>;
	ticksToDecay?: number;
	/** Pre-set a relative cooldown timer in ticks for structures that expose one. */
	cooldown?: number;
	/** Pre-set factory level for tests that need exact factory validation state. */
	level?: number;
}

export interface SiteSpec {
	pos: [number, number];
	owner: string;
	structureType: string;
	progress?: number;
	/** Optional construction site name. Currently only `STRUCTURE_SPAWN` accepts
	 *  a name; the engine passes it through to the structure on completion. */
	name?: string;
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
	/**
	 * Mineral density level: `DENSITY_LOW` (1), `DENSITY_MODERATE` (2),
	 * `DENSITY_HIGH` (3), or `DENSITY_ULTRA` (4). Defaults to
	 * `DENSITY_HIGH`. When `mineralAmount` is omitted, the placed amount
	 * is `MINERAL_DENSITY[density]`.
	 */
	density?: number;
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
	/** Override the destroyed structure id exposed through `ruin.structure.id`. */
	structureId?: string;
	/** Override the destroyed structure hitsMax exposed through `ruin.structure.hitsMax`. */
	structureHitsMax?: number;
	/** Owner handle for the destroyed structure, when it was an OwnedStructure. */
	structureOwner?: string;
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
	/** Map of PWR_* constant to level (1-5), optionally with remaining cooldown. */
	powers: Record<number, number | { level: number; cooldown?: number }>;
	store?: Record<string, number>;
}

export interface NukeSpec {
	pos: [number, number];
	launchRoomName: string;
	timeToLand: number;
}

export interface MarketOrderSpec {
	owner: string;
	type: 'buy' | 'sell';
	resourceType: string;
	price: number;
	totalAmount: number;
	roomName?: string;
	/** Wall-clock ms. Defaults to Date.now() at placement. */
	createdTimestamp?: number;
	/** Defaults to true so `getAllOrders` returns it. */
	active?: boolean;
	/** Defaults to current gameTime at placement. */
	created?: number;
}

export interface InvaderRaidRoomStateSpec {
	/**
	 * Seed the room's aggregate source-harvest raid budget. Adapters translate
	 * this to their internal source-side accounting; snapshots must not expose
	 * the backing field.
	 */
	harvestedEnergy?: number;
	/**
	 * Seed the effective room raid threshold. `null` clears the room-specific
	 * override so the engine falls back to its default threshold.
	 */
	raidGoal?: number | null;
	/** Whether the room is present in the backend active-room set. */
	active?: boolean;
	/** Seed the backend room status used by the inactive-room raid spawner. */
	status?: string;
	/**
	 * Seed or clear the room controller reservation. Used for adjacent-room exit
	 * qualification tests.
	 */
	controllerReservation?: { owner: string; ticksToEnd?: number } | null;
}

export interface InvaderRaidSpawnerOptions {
	/**
	 * Deterministic values consumed in order by the raid spawner's Math.random()
	 * calls. Adapters should fail the helper if the sequence is exhausted.
	 */
	random?: readonly number[];
}

export interface TickOptions {
	/**
	 * Deterministic values consumed in order by the engine processor's
	 * Math.random() calls during this tick(count) call. Each value must lie in
	 * `[0, 1)`. The same sequence is consumed across all `count` ticks; once
	 * exhausted, adapters must throw rather than falling back to the original
	 * Math.random. Requires the `randomInjection` capability.
	 */
	random?: readonly number[];
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
	/** Public room-status setup through RoomSpec.status. */
	roomStatus: boolean;
	/** Portal structures and inter-room/inter-shard teleport mechanics. */
	portals: boolean;
	/** Invader core structures (level, deploy timer, collapse lifecycle). */
	invaderCore: boolean;
	/** Per-room inactive Invader raid spawning orchestration. */
	invaderRaidSpawner: boolean;
	/** Two or more shards orchestrated within a single test (createShard with
	 *  multiple shards, cross-shard creep traversal, per-shard Memory). */
	multiShard: boolean;
	/** InterShardMemory.{getLocal,setLocal,getRemote} APIs. The local half
	 *  is single-shard testable; getRemote requires multiShard. */
	interShardMemory: boolean;
	/** Game.cpu.shardLimits read and Game.cpu.setShardLimits write APIs. */
	cpuShardLimits: boolean;
	/** `Game.map.getWorldSize()` reflects the current shard's room set rather
	 *  than a value cached at engine boot. Vanilla computes worldSize from
	 *  `db.rooms` when the engine_runner subprocess connects via
	 *  `@screeps/driver`, and exposes no refresh path; tests that assert the
	 *  inclusive-span semantic must require this capability. */
	liveWorldSize: boolean;
	/** Normalized capture of the room-history/client action-log payload. */
	actionLogCapture: boolean;
	/**
	 * `tick({ random: [...] })` deterministically feeds the engine processor's
	 * Math.random() calls for the duration of the call. Required for tests that
	 * exercise stochastic processor branches (e.g. mineral redensify gate).
	 */
	randomInjection: boolean;
	/**
	 * Vanilla's `register.deprecated` per-tick log notices for deprecated
	 * Game.map / PathFinder / findPath / renewCreep APIs (catalog §28). The
	 * notice is emitted to the caller's console and dedup'd per tick.
	 * `captureConsoleLogs(handle)` exposes the captured strings.
	 */
	deprecationNotices: boolean;
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

export type ActionLogPayloadValue =
	| number
	| string
	| boolean
	| null
	| { [key: string]: ActionLogPayloadValue }
	| ActionLogPayloadValue[];

export interface ActionLogObjectSnapshot {
	room: string;
	tick: number;
	id: string;
	type: string;
	structureType?: string;
	name?: string;
	pos: { x: number; y: number; roomName: string };
	actionLog: Record<string, ActionLogPayloadValue>;
}

export interface RoomActionLogCapture {
	room: string;
	tick: number;
	objects: ActionLogObjectSnapshot[];
}

// ── Core adapter interface ───────────────────────────────────

export interface ScreepsOkAdapter {
	/** Feature areas the adapter can exercise honestly. Tests skip on false. */
	readonly capabilities: AdapterCapabilities;

	/**
	 * Documented engine quirks that require skipping specific tests (not
	 * asserting failure). Distinct from capabilities: a limitation says the
	 * engine implements the feature but misbehaves in a way that would hang
	 * or corrupt the runner if the test ran. Omitted flags default to false.
	 * See `AdapterLimitation` in `limitations.ts` for the catalog.
	 */
	readonly limitations?: import('./limitations.js').AdapterLimitations;

	/**
	 * Intentional object-shape divergences from the canonical vanilla
	 * surface that upstream has declined to change. Shape tests fold the
	 * declared extras into their expected key sets via `expectedShape`,
	 * so the remaining surface stays asserted. Distinct from parity.json
	 * `expected_failures`, which tracks genuine gaps awaiting a fix.
	 * See `ShapeDivergences` in `limitations.ts` for the catalog.
	 */
	readonly shapeDivergences?: import('./limitations.js').ShapeDivergences;

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
	placeMarketOrder(spec: MarketOrderSpec): Promise<string>;
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
	tick(count?: number, options?: TickOptions): Promise<void>;

	/** Return a plain JSON snapshot for one object, or null if it no longer exists. */
	getObject(id: string): Promise<ObjectSnapshot | null>;

	/** Perspective-neutral room inspection using supported Screeps FIND_* constants. */
	findInRoom(room: string, type: typeof FIND_CREEPS): Promise<CreepSnapshot[]>;
	findInRoom(room: string, type: typeof FIND_STRUCTURES): Promise<StructureSnapshot[]>;
	findInRoom(room: string, type: typeof FIND_CONSTRUCTION_SITES): Promise<SiteSnapshot[]>;
	findInRoom(room: string, type: typeof FIND_SOURCES): Promise<SourceSnapshot[]>;
	findInRoom(room: string, type: typeof FIND_MINERALS): Promise<MineralSnapshot[]>;
	findInRoom(room: string, type: typeof FIND_TOMBSTONES): Promise<TombstoneSnapshot[]>;
	findInRoom(room: string, type: typeof FIND_DEPOSITS): Promise<DepositSnapshot[]>;
	findInRoom(room: string, type: typeof FIND_RUINS): Promise<RuinSnapshot[]>;
	findInRoom(room: string, type: typeof FIND_DROPPED_RESOURCES): Promise<DroppedResourceSnapshot[]>;
	findInRoom(room: string, type: SupportedFindConstant): Promise<ObjectSnapshot[]>;

	/** Current game time / tick number. */
	getGameTime(): Promise<number>;

	/**
	 * Capture the room-history/client action-log payload rendered for the
	 * current tick. This is not Room.getEventLog(); it is the per-object
	 * visual/history action marker surface exposed to clients and replays.
	 */
	captureActionLog(room: string): Promise<RoomActionLogCapture>;

	/** Seed backend-only raid-spawner state through a typed test setup surface. */
	setInvaderRaidState(room: string, spec: InvaderRaidRoomStateSpec): Promise<void>;
	/** Execute one inactive-room Invader raid spawner pass, without cron timing. */
	runInvaderRaidSpawner(options?: InvaderRaidSpawnerOptions): Promise<void>;
	/** Remove Invader-owned raid creeps from the room for follow-up setup. */
	clearInvaderRaidCreeps(room: string): Promise<void>;

	/** Get the controller position for a room. Returns null if no controller. */
	getControllerPos(room: string): Promise<{ x: number; y: number } | null>;

	/**
	 * Strings emitted to the player's in-game console during the most recent
	 * `runPlayer`/`runPlayers` call (in emission order). Excludes the
	 * adapter's internal result-marker entry. Adapters without
	 * `deprecationNotices` may return an empty array.
	 */
	captureConsoleLogs(handle: string): Promise<string[]>;

	/** Release any shard, runtime, or process resources held by the adapter. */
	teardown(): Promise<void>;
}
