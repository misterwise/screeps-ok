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
	GCL_MULTIPLY, GCL_POW,
} from './constants.js';

// ── Setup types ──────────────────────────────────────────────

export interface ShardSpec {
	players: (string | PlayerSpec)[];
	rooms: RoomSpec[];
}

export interface PlayerSpec {
	name: string;
	/**
	 * The player's GCL, as `Game.gcl` reads it. Defaults to
	 * `{ level: max(rooms the player owns + 1, 2) }`, room for one more claim.
	 * The engine stores it as points; `gclPoints` converts.
	 */
	gcl?: GclSpec;
	/**
	 * The player's processed account power in points, from which the engine
	 * derives `Game.gpl`. Defaults to 10,000,000.
	 */
	power?: number;
}

export interface GclSpec {
	/** `Game.gcl.level`. */
	level: number;
	/** Whole points past the level's threshold, `ceil(GCL_MULTIPLY * (level - 1) ** GCL_POW)`. Defaults to 0. */
	progress?: number;
}

/** Throws for a room without a controller that sets a controller setting. */
export function checkRoomSpec(room: RoomSpec): void {
	if (room.controller !== false) return;
	const set = (['rcl', 'owner', 'safeMode', 'safeModeAvailable', 'ticksToDowngrade', 'powerEnabled'] as const)
		.filter(key => room[key] !== undefined);
	if (set.length > 0) throw new Error(`RoomSpec ${room.name}: controller: false takes no ${set.join(', ')}`);
}

/** The engine's GCL points for a spec; throws for one no point total reads back as. */
export function gclPoints({ level, progress = 0 }: GclSpec): number {
	const threshold = (l: number) => Math.ceil(GCL_MULTIPLY * (l - 1) ** GCL_POW);
	const points = threshold(level) + progress;
	const readsBack = Math.floor((points / GCL_MULTIPLY) ** (1 / GCL_POW)) + 1 === level;
	if (!Number.isInteger(level) || level < 1 || !Number.isInteger(progress) || progress < 0
		|| points >= threshold(level + 1) || !readsBack) {
		throw new Error(`PlayerSpec.gcl { level: ${level}, progress: ${progress} }: progress must be a whole number below ${threshold(level + 1) - threshold(level)}`);
	}
	return points;
}

export type RoomStatusSpec = 'normal' | 'novice' | 'respawn' | 'closed';

export interface RoomSpec {
	name: string;
	terrain?: TerrainSpec;
	/**
	 * `false` makes a room with no controller, as a source keeper room or a
	 * highway room has none. It then takes none of the controller settings
	 * below (`rcl`, `owner`, safe mode, `ticksToDowngrade`, `powerEnabled`).
	 * Defaults to true: one controller at (1, 1).
	 */
	controller?: boolean;
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
	/**
	 * Set the controller's `isPowerEnabled`. Placement never enables power, so
	 * a power creep can `usePower` in a controlled room only when this is set.
	 */
	powerEnabled?: boolean;
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
	/** Defaults to full. */
	energy?: number;
	/**
	 * Defaults to what the room's state gives a source: `SOURCE_ENERGY_KEEPER_CAPACITY`
	 * without a controller, `SOURCE_ENERGY_CAPACITY` owned or reserved, else
	 * `SOURCE_ENERGY_NEUTRAL_CAPACITY`.
	 */
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
	/** Map of PWR_* constant to level (1-5), optionally with remaining cooldown.
	 *  The creep's level is their sum; hits and store capacity follow from it. */
	powers: Record<number, number | { level: number; cooldown?: number }>;
	store?: Record<string, number>;
}

export interface NukeSpec {
	pos: [number, number];
	launchRoomName: string;
	timeToLand: number;
}

// `placeObject` specs. Timers are relative ticks named for the getter that reads them.

export interface PortalSpec {
	pos: [number, number];
	/** A room position on this shard, or a room on another shard. */
	destination: { room: string; x: number; y: number } | { shard: string; room: string };
	/** Omitted, the portal never decays and `ticksToDecay` is undefined. */
	ticksToDecay?: number;
}

export interface DepositSpec {
	pos: [number, number];
	depositType: string;
	/** Total harvested so far, which sets the next harvest's cooldown (and `lastCooldown`). Defaults to 0. */
	harvested?: number;
	/** Defaults to 0: harvestable now. */
	cooldown?: number;
	/** Defaults to `DEPOSIT_DECAY_TIME`, a fresh deposit's timer. */
	ticksToDecay?: number;
}

export interface KeeperLairSpec {
	pos: [number, number];
	/** Omitted, no spawn is scheduled and `ticksToSpawn` is undefined. */
	ticksToSpawn?: number;
}

export interface InvaderCoreSpec {
	pos: [number, number];
	level: number;
	/** Omitted, the core is deployed. */
	ticksToDeploy?: number;
	/** The `EFFECT_COLLAPSE_TIMER` effect's `ticksRemaining`. Omitted, the core has none. */
	ticksToCollapse?: number;
	/** A defender spawn in progress, as `spawning` reads it. `body` defaults to `[MOVE]`, and
	 *  `needTime` to `INVADER_CORE_CREEP_SPAWN_TIME[level]` per part. */
	spawning?: { name: string; body?: string[]; needTime?: number; remainingTime: number };
	/** The stronghold bunker a deploy places (`strongholdDeploy`). */
	templateName?: string;
	/** The engine's tag for a stronghold's structures; an engine that groups them otherwise ignores it. */
	strongholdId?: string;
}

export interface PowerBankSpec {
	pos: [number, number];
	power: number;
	/** Defaults to `POWER_BANK_HITS`; `hitsMax` is always `POWER_BANK_HITS`. */
	hits?: number;
	/** Defaults to `POWER_BANK_DECAY`. */
	ticksToDecay?: number;
}

export interface PlaceObjectSpecs {
	portal: PortalSpec;
	deposit: DepositSpec;
	keeperLair: KeeperLairSpec;
	invaderCore: InvaderCoreSpec;
	powerBank: PowerBankSpec;
}

/** The spec `placeObject` takes for a type: typed for `PlaceObjectSpecs`' types, untyped otherwise. */
export type PlaceObjectSpec<T extends string> = T extends keyof PlaceObjectSpecs ? PlaceObjectSpecs[T] : Record<string, unknown>;

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
	/**
	 * Checked before each of the `count` ticks; once aborted the call throws
	 * `signal.reason` without starting another tick. The fixture passes its own.
	 */
	signal?: AbortSignal;
}

// ── Capabilities ─────────────────────────────────────────────

export interface AdapterCapabilities {
	/** Labs, reactions, minerals in labs, and related chemistry APIs. */
	chemistry: boolean;
	/** A spawned power creep exists in a room and acts through its own verbs:
	 *  placement, `Game.powerCreeps`, FIND/LOOK, move, say, resource transfer,
	 *  renew, suicide, enableRoom, and `usePower(PWR_GENERATE_OPS)`. */
	powerCreeps: boolean;
	/** Account-level power-creep management from game code: `PowerCreep.create`
	 *  plus the `rename` / `upgrade` / `delete` instance methods, and the
	 *  unspawned-roster states only they can reach. An engine may implement the
	 *  roster but expose it solely through an out-of-game account API. */
	powerCreepAccountApi: boolean;
	/** `usePower` applies its `PWR_*` effect to the target: the `effects` array
	 *  on the host, the gameplay consequence, and the ops/cooldown the use
	 *  costs. Distinct from `powerCreeps` because `PWR_GENERATE_OPS` needs no
	 *  effect substrate and an engine may land the powers one at a time. */
	powerEffects: boolean;
	/** Power spawn structure, processPower(), and Game.gpl account power. */
	powerSpawn: boolean;
	/** Factory structure and production APIs. */
	factory: boolean;
	/** Terminal structure placement, construction, store, room shortcut, and
	 *  public object shape. */
	terminal: boolean;
	/** Self-contained Game.market surface that needs no seeded order book:
	 *  public object shape, calcTransactionCost(), and invalid-resource query
	 *  filtering. */
	marketBasics: boolean;
	/** Full market order lifecycle, deals, history, and adapter-side order
	 *  placement. */
	market: boolean;
	/** StructureTerminal.send: energy cost, cooldown, delivery, and
	 *  transaction recording — independent of the market order book. */
	terminalSend: boolean;
	/** Observer structure and room observation APIs. */
	observer: boolean;
	/** Nuker structure and nuke APIs. */
	nuke: boolean;
	/** Deposit objects and harvest cooldown lifecycle. */
	deposit: boolean;
	/** Power Bank placement, public shape, combat, decay, and destruction loot. */
	powerBank: boolean;
	/** Custom terrain setup through RoomSpec.terrain / setTerrain. */
	terrain: boolean;
	/** Public room-status setup through RoomSpec.status. */
	roomStatus: boolean;
	/** Portal structures and inter-room/inter-shard teleport mechanics. */
	portals: boolean;
	/** Invader core structures (level, deploy timer, collapse lifecycle). */
	invaderCore: boolean;
	/** Engine-driven stronghold deployment: the deploy trigger placing the
	 *  canonical template layout for a seeded `templateName`. */
	strongholdDeploy: boolean;
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
	 * Intentional object-shape divergences from the canonical vanilla
	 * surface that upstream has declined to change. Shape tests fold the
	 * declared extras into their expected key sets via `expectedShape`,
	 * so the remaining surface stays asserted. Distinct from parity.json
	 * `expected_failures`, which tracks genuine gaps awaiting a fix.
	 * See `ShapeDivergences` in `shape-divergences.ts` for the catalog.
	 */
	readonly shapeDivergences?: import('./shape-divergences.js').ShapeDivergences;

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
	/**
	 * Place a public object the typed helpers don't cover, with the spec
	 * `PlaceObjectSpecs` names for its type. Any other type is an escape hatch
	 * with an untyped spec, which an adapter may reject.
	 */
	placeObject<T extends string>(room: string, type: T, spec: PlaceObjectSpec<T>): Promise<string>;

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
