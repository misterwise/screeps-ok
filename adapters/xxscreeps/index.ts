import { Game, GameState, runForUser, runOneShot, runWithState } from 'xxscreeps/game/index.js';
import { UserSandbox } from './sandbox-runner.js';
import { Room } from 'xxscreeps/game/room/index.js';
import type {
	ScreepsOkAdapter, AdapterCapabilities, ShardSpec, PlayerReturnValue,
	CreepSpec, StructureSpec, SiteSpec, SourceSpec, MineralSpec,
	FlagSpec, TombstoneSpec, RuinSpec, DroppedResourceSpec,
	PowerCreepSpec, NukeSpec, MarketOrderSpec, TerrainSpec,
} from '../../src/adapter.js';
import type { ObjectSnapshot } from '../../src/snapshots/common.js';
import type { PlayerCode } from '../../src/code.js';
import { RunPlayerError } from '../../src/errors.js';
import { selectorFromFindConstant } from '../../src/find.js';
import { withCornerWalls } from '../../src/terrain-fixture.js';
import { RoomPosition } from 'xxscreeps/game/position.js';
import { search as pfSearch, CostMatrix } from 'xxscreeps/game/pathfinder/index.js';
import * as C from 'xxscreeps/game/constants/index.js';

// Build synthetic PathFinder object matching the Screeps global API.
// `use` is a no-op mirroring xxscreeps/game/pathfinder/index.js —
// Screeps exposes it for legacy/new-pathfinder toggling but xxscreeps
// only ships the new pathfinder, so toggling has no effect.
const PathFinder = { search: pfSearch, CostMatrix, use: (_: boolean) => {} };
import assert from 'node:assert';
import { instantiateTestShard } from 'xxscreeps/test/import.js';
import { consumeSet, consumeSortedSet } from 'xxscreeps/engine/db/async.js';
import { begetRoomProcessQueue, finalizeExtraRoomsSetKey, processRoomsSetKey, updateUserRoomRelationships, userToIntentRoomsSetKey, userToVisibleRoomsSetKey } from 'xxscreeps/engine/processor/model.js';
import { RoomProcessor } from 'xxscreeps/engine/processor/room.js';
import { Fn } from 'xxscreeps/functional/fn.js';
import { flushUsers } from 'xxscreeps/game/room/room.js';
import { getOrSet } from 'xxscreeps/utility/utility.js';
import { TerrainWriter, packExits } from 'xxscreeps/game/terrain.js';
import { loadTerrain } from 'xxscreeps/driver/pathfinder.js';
import * as MapSchema from 'xxscreeps/game/map.js';
import { makeWriter } from 'xxscreeps/schema/write.js';
import { snapshotObject, snapshotRoom, getStructureType } from './snapshots.js';
import {
	insertRoomObject, removeRoomObject, iterateRoomObjects,
	setRoomLevel, getRoomLevel, setRoomOwner, setControllerOwner,
	setRoomSafeModeUntil, setControllerDowngradeTime,
	resetControllerTimers, resetRoomControllerFlags,
	bindObjectPos, setCreepAgeTime,
	setSourceNextRegenerationTime, setMineralNextRegenerationTime,
	setStructureNextDecayTime,
	primeTombstoneCorpse, primeRuinStructure,
	setKeeperLairNextSpawnTime,
	storeAdd, storeSubtract, storeEntries, setStoreCapacity,
} from './engine-internals.js';

// Object creation imports
import { create as createCreep, calculateCarry } from 'xxscreeps/mods/creep/creep.js';
import { create as createSpawn } from 'xxscreeps/mods/spawn/spawn.js';
import { create as createExtension } from 'xxscreeps/mods/spawn/extension.js';
import { create as createSite } from 'xxscreeps/mods/construction/construction-site.js';
import { structureFactories } from 'xxscreeps/mods/construction/symbols.js';
import { Source } from 'xxscreeps/mods/source/source.js';
import { Mineral } from 'xxscreeps/mods/mineral/mineral.js';
import { create as createLab } from 'xxscreeps/mods/chemistry/lab.js';
import { create as createObserver } from 'xxscreeps/mods/observer/observer.js';
import { create as createTower } from 'xxscreeps/mods/defense/tower.js';
import { create as createRampart } from 'xxscreeps/mods/defense/rampart.js';
import { create as createWall } from 'xxscreeps/mods/defense/wall.js';
import { create as createStorage } from 'xxscreeps/mods/logistics/storage.js';
import { create as createLink } from 'xxscreeps/mods/logistics/link.js';
import { create as createContainer } from 'xxscreeps/mods/resource/container.js';
import { create as createRoad } from 'xxscreeps/mods/road/road.js';
import { create as createExtractor } from 'xxscreeps/mods/mineral/extractor.js';
import { create as createKeeperLair } from 'xxscreeps/mods/source/keeper-lair.js';
import { create as createResource } from 'xxscreeps/mods/resource/resource.js';
import { read as readFlagBlob, write as writeFlagBlob } from 'xxscreeps/mods/flag/game.js';
import { Flag } from 'xxscreeps/mods/flag/flag.js';
import { loadUserFlagBlob, saveUserFlagBlobForNextTick } from 'xxscreeps/mods/flag/model.js';
import { activateNPC } from 'xxscreeps/mods/npc/processor.js';
import { instantiate } from 'xxscreeps/utility/utility.js';
import { Tombstone } from 'xxscreeps/mods/creep/tombstone.js';
import { Ruin } from 'xxscreeps/mods/structure/ruin.js';
import { create as createObject } from 'xxscreeps/game/object.js';
import { OpenStore } from 'xxscreeps/mods/resource/store.js';
import { StructureController } from 'xxscreeps/mods/controller/controller.js';

// Optional mods — not all xxscreeps builds include these exports.
// Use variable-named dynamic imports so TS doesn't statically require the
// module, and so a missing named export degrades to `undefined` instead of
// a type error. Factory is an optional mod; terminal.js in the pinned
// xxscreeps build defines `create` locally but does not export it.
let createFactory: ((pos: any, owner: string) => any) | undefined;
let createTerminal: ((pos: any, owner: string) => any) | undefined;
let createPortal: ((pos: any, destination: any, decayTime?: number) => any) | undefined;
for (const [name, assign] of [
	['xxscreeps/mods/factory/factory.js', (m: any) => { createFactory = m.create; }],
	['xxscreeps/mods/market/terminal.js', (m: any) => { createTerminal = m.create; }],
	['xxscreeps/mods/portal/portal.js', (m: any) => { createPortal = m.create; }],
] as const) {
	try { assign(await import(name)); } catch {}
}

// Module-level initialization
import { importMods } from 'xxscreeps/config/mods/index.js';
import { initializeIntentConstraints } from 'xxscreeps/engine/processor/index.js';
import { initializeGameEnvironment } from 'xxscreeps/game/index.js';
import 'xxscreeps/config/mods/import/game.js';

// `driver` mods register `runnerConnector` hooks (flag, memory, visual,
// controller). These must be imported before `createSimulation` runs so the
// sandbox wiring in `UserSandbox.create` can iterate them.
await importMods('driver');
await importMods('processor');
initializeGameEnvironment();
initializeIntentConstraints();

// Convert a desired `Game.gcl.level` to the `payload.gcl` progress value the
// controller mod's gameInitializer consumes to produce that level.
// Inverse of `mods/controller/game.ts:64`:
//     level = floor((gcl / GCL_MULTIPLY) ** (1 / GCL_POW))
//     Game.gcl.level = level + 1
// So pick gcl = (desiredLevel - 1)^GCL_POW * GCL_MULTIPLY, floored to 0.
function gclLevelToProgress(desiredLevel: number): number {
	const floor = Math.max(0, desiredLevel - 1);
	return Math.floor(floor ** 2.4 * 1_000_000);
}

// Player handle → xxscreeps user ID
const playerSlots = ['100', '101', '102', '103'];

// Reserved NPC handles that resolve to short engine user IDs independent of
// spec.players. The rate=0 path in `mods/creep/processor.ts` fires when the
// creep's engine user id has length <= 2 — seeding these handles lets tests
// hit the rate=0 tombstone path (CREEP-DEATH-011) through placeCreep's
// existing `owner: string` contract. Placing a creep with an NPC handle also
// `activateNPC`s the room so the matching NPC loop runs (e.g. the Invader
// AI at mods/invader/loop/find-attack.ts auto-suicides in owned rooms).
const NPC_HANDLES: Record<string, string> = {
	sk: '2',
};

// Structure types the engine always attributes to a user. Omitting `owner`
// in placeStructure for these produces a cryptic engine-internal crash
// (e.g. null-destructure in createSpawn), so reject at the boundary.
const STRUCTURE_TYPES_UNOWNED = new Set(['container', 'road', 'constructedWall']);
const STRUCTURE_TYPES_REQUIRING_OWNER = new Set([
	'spawn', 'extension', 'tower', 'lab', 'link', 'storage', 'terminal',
	'factory', 'observer', 'rampart', 'extractor', 'nuker', 'powerSpawn',
]);

class XxscreepsAdapter implements ScreepsOkAdapter {
	readonly capabilities: AdapterCapabilities = {
		chemistry: true,
		powerCreeps: false,
		factory: !!createFactory,
		market: false,
		observer: true,
		nuke: false,
		deposit: false,
		terrain: true,
		// Portal mod is optional in pinned xxscreeps. Capability tracks
		// the dynamic import result so PORTAL-* tests skip cleanly when
		// the mod is absent and run when it lands upstream.
		portals: !!createPortal,
		// xxscreeps has no invader-core mod — `StructureInvaderCore` is a
		// bare stub at game/runtime.ts:13.
		invaderCore: false,
		// xxscreeps has no multi-shard runtime, no InterShardMemory module,
		// and no Game.cpu.shardLimits / setShardLimits. See
		// docs/xxscreeps-parity-gaps.md.
		multiShard: false,
		interShardMemory: false,
		cpuShardLimits: false,
		// xxscreeps's GameMap is constructed from the World schema each time
		// it's read, so getWorldSize always reflects the current room set.
		liveWorldSize: true,
	};

	readonly limitations = {
		// xxscreeps pull(self) enters an infinite loop in the recursive
		// circular-pull check, hanging the test runner.
		pullSelfHang: true,
	};

	private playerMap = new Map<string, string>();
	private reversePlayerMap = new Map<string, string>();
	// PlayerSpec.gcl overrides, keyed by handle. When set, runPlayer uses
	// this level for `Game.gcl.level` instead of the `ownedRoomCount+1`
	// polyfill, so tests with `gcl: 0` can honestly trigger
	// ERR_GCL_NOT_ENOUGH (see `mods/controller/creep.ts:137` —
	// `level <= #roomCount` fails).
	private playerGcl = new Map<string, number>();
	private pendingSetup = new Map<string, Array<(room: Room) => void>>();
	private rooms: string[] = [];
	private simulation: Awaited<ReturnType<typeof createSimulation>> | null = null;
	private shardSpec: ShardSpec | null = null;
	private idCounter = 0;
	private firstTickRun = false;

	private nextId(): string {
		return (++this.idCounter).toString(16).padStart(24, '0');
	}

	private resolvePlayer(handle: string): string {
		const id = this.playerMap.get(handle);
		if (!id) throw new Error(`Unknown player handle: ${handle}`);
		return id;
	}

	resolvePlayerReverse(userId: string): string {
		return this.reversePlayerMap.get(userId) ?? userId;
	}

	private pokeQueue: Array<{ room: string; fn: (room: any) => void }> = [];

	// Keep every room in the processor queue and every player's intentRooms
	// set so idle ticks don't silently drop intent routing. visibleRooms is
	// scoped to rooms the player owns per shardSpec; the engine's `flushUsers`
	// (`xxscreeps/game/room/room.ts`) and observer processor populate the
	// rest after the first processed tick. Seeding every room here was the
	// root cause of observer-room-always-visible.
	private async keepRoomsActive(): Promise<void> {
		if (!this.simulation) return;
		const { scratch } = this.simulation.shard;
		for (const roomName of this.rooms) {
			await scratch.zadd('processor/activeRooms', [[1, roomName]]);
		}
		const ownedByEngineId = new Map<string, string[]>();
		for (const roomSpec of this.shardSpec?.rooms ?? []) {
			if (!roomSpec.owner) continue;
			const engineId = this.playerMap.get(roomSpec.owner);
			if (!engineId) continue;
			let rooms = ownedByEngineId.get(engineId);
			if (!rooms) { rooms = []; ownedByEngineId.set(engineId, rooms); }
			rooms.push(roomSpec.name);
		}
		for (const [, engineId] of this.playerMap) {
			for (const roomName of this.rooms) {
				await scratch.sadd(`user/${engineId}/intentRooms`, [roomName]);
			}
			const owned = ownedByEngineId.get(engineId);
			if (owned && owned.length > 0) {
				await scratch.sadd(`user/${engineId}/visibleRooms`, owned);
			}
		}
	}

	private queueOp(room: string, fn: (room: Room) => void): void {
		if (this.simulation) {
			// Simulation already running — queue for poke
			this.pokeQueue.push({ room, fn });
			return;
		}
		let ops = this.pendingSetup.get(room);
		if (!ops) {
			ops = [];
			this.pendingSetup.set(room, ops);
		}
		ops.push(fn);
	}

	private resetRoomToCanonicalLayout(room: Room, roomName: string): void {
		for (const obj of [...iterateRoomObjects(room)]) {
			removeRoomObject(room, obj);
		}

		setRoomLevel(room, 0);
		setRoomOwner(room, null);
		resetRoomControllerFlags(room);

		const controller = new StructureController();
		controller.id = this.nextId();
		bindObjectPos(controller, new RoomPosition(1, 1, roomName));
		controller.safeModeAvailable = 0;
		resetControllerTimers(controller);
		insertRoomObject(room, controller, true);
	}

	async createShard(spec: ShardSpec): Promise<void> {
		this.shardSpec = spec;
		this.rooms = spec.rooms.map(r => r.name);

		for (const [handle, engineId] of Object.entries(NPC_HANDLES)) {
			this.playerMap.set(handle, engineId);
			this.reversePlayerMap.set(engineId, handle);
		}

		for (let i = 0; i < spec.players.length; i++) {
			if (i >= playerSlots.length) throw new Error(`Max ${playerSlots.length} players`);
			const entry = spec.players[i];
			const handle = typeof entry === 'string' ? entry : entry.name;
			this.playerMap.set(handle, playerSlots[i]);
			this.reversePlayerMap.set(playerSlots[i], handle);
			if (typeof entry !== 'string' && entry.gcl !== undefined) {
				this.playerGcl.set(handle, entry.gcl);
			}
		}

		for (const roomSpec of spec.rooms) {
			if (roomSpec.owner || roomSpec.rcl) {
				const owner = roomSpec.owner ? this.resolvePlayer(roomSpec.owner) : undefined;
				const rcl = roomSpec.rcl ?? (roomSpec.owner ? 1 : 0);
				const safeModeAvail = roomSpec.safeModeAvailable ?? 0;
				const safeModeRemaining = roomSpec.safeMode ?? 0;
				const ticksToDowngrade = roomSpec.ticksToDowngrade ?? 0;
				const rName = roomSpec.name;
				this.queueOp(rName, room => {
					if (rcl > 0 && owner) {
						// shard.json rooms may lack a controller — create one
						if (!room.controller) {
							const ctrl = new StructureController();
							ctrl.id = this.nextId();
							bindObjectPos(ctrl, new RoomPosition(1, 1, rName));
							setRoomOwner(room, null);
							insertRoomObject(room, ctrl, true);
						}
						setRoomLevel(room, rcl);
						setRoomOwner(room, owner);
						setControllerOwner(room.controller!, owner);
					}
					if (safeModeAvail > 0 && room.controller) {
						room.controller.safeModeAvailable = safeModeAvail;
					}
					if (safeModeRemaining > 0 && room.controller) {
						setRoomSafeModeUntil(room, Game.time, safeModeRemaining);
					}
					if (ticksToDowngrade > 0 && room.controller) {
						setControllerDowngradeTime(room.controller, Game.time, ticksToDowngrade);
					}
				});
			}
		}
	}

	async placeCreep(roomName: string, spec: CreepSpec): Promise<string> {
		const id = this.nextId();
		const userId = this.resolvePlayer(spec.owner);
		const name = spec.name ?? `creep-${id}`;
		this.nameToSyntheticId.set(name, id);
		// NPC-owned creeps (short engine user ids like '2') need their room
		// to be flagged active in `#npcData` so the NPC processor runs the
		// registered loop for that user on subsequent ticks. Without this,
		// an Invader-owned creep just sits idle and never triggers its
		// built-in suicide/attack intents.
		const isNpc = userId.length <= 2;

		this.queueOp(roomName, room => {
			const creep = createCreep(
				new RoomPosition(spec.pos[0], spec.pos[1], roomName),
				spec.body as any,
				name,
				userId,
			);
			if (spec.boosts) {
				for (const [idx, boost] of Object.entries(spec.boosts)) {
					(creep.body[Number(idx)] as any).boost = boost;
				}
				// createCreep set store capacity from the unboosted body; resize
				// now that boosts may have extended CARRY capacity.
				setStoreCapacity(creep.store, calculateCarry(creep.body));
			}
			if (spec.ticksToLive !== undefined) {
				setCreepAgeTime(creep, Game.time, spec.ticksToLive);
			}
			if (spec.store) {
				for (const [resource, amount] of Object.entries(spec.store)) {
					storeAdd(creep.store, resource, amount);
				}
			}
			insertRoomObject(room, creep);
			if (isNpc) activateNPC(room, userId);
		});

		return id;
	}

	async placeStructure(roomName: string, spec: StructureSpec): Promise<string> {
		if (!spec.owner && STRUCTURE_TYPES_REQUIRING_OWNER.has(spec.structureType)) {
			throw new Error(
				`placeStructure: owner is required for structureType '${spec.structureType}'. ` +
				`Unowned structures: ${[...STRUCTURE_TYPES_UNOWNED].join(', ')}.`,
			);
		}
		const id = this.nextId();
		const userId = spec.owner ? this.resolvePlayer(spec.owner) : undefined;
		this.posToSyntheticId.set(`${roomName}:${spec.pos[0]}:${spec.pos[1]}:${spec.structureType}`, id);

		this.queueOp(roomName, room => {
			const pos = new RoomPosition(spec.pos[0], spec.pos[1], roomName);
			const structure = buildStructure(spec.structureType, pos, userId, getRoomLevel(room));
			structure.id = id;
			if (spec.hits !== undefined) {
				structure.hits = spec.hits;
			}
			if (spec.store) {
				setStoreContentsExact(structure.store, spec.store);
			}
			if (spec.ticksToDecay !== undefined) {
				setStructureNextDecayTime(structure, this.simulation!.shard.time, spec.ticksToDecay);
			}
			insertRoomObject(room, structure);
		});

		return id;
	}

	async placeSite(roomName: string, spec: SiteSpec): Promise<string> {
		const id = this.nextId();
		const userId = this.resolvePlayer(spec.owner);
		this.posToSyntheticId.set(`${roomName}:${spec.pos[0]}:${spec.pos[1]}:constructionSite`, id);

		this.queueOp(roomName, room => {
			const pos = new RoomPosition(spec.pos[0], spec.pos[1], roomName);
			const progressTotal = structureFactories.get(spec.structureType)?.checkPlacement(room, pos)
				?? C.CONSTRUCTION_COST[spec.structureType as keyof typeof C.CONSTRUCTION_COST]
				?? 0;
			const site = createSite(pos, spec.structureType as any, userId, progressTotal);
			site.id = id;
			if (spec.progress !== undefined) {
				site.progress = spec.progress;
			}
			insertRoomObject(room, site);
		});

		return id;
	}

	async placeSource(roomName: string, spec: SourceSpec): Promise<string> {
		const id = this.nextId();
		this.posToSyntheticId.set(`${roomName}:${spec.pos[0]}:${spec.pos[1]}:source`, id);

		this.queueOp(roomName, room => {
			const source = new Source();
			source.id = id;
			bindObjectPos(source, new RoomPosition(spec.pos[0], spec.pos[1], roomName));
			source.energyCapacity = spec.energyCapacity ?? 3000;
			source.energy = spec.energy ?? source.energyCapacity;
			// Set regen timer if source is depleted
			if (spec.ticksToRegeneration !== undefined && spec.ticksToRegeneration > 0) {
				setSourceNextRegenerationTime(source, Game.time, spec.ticksToRegeneration);
			} else if (source.energy < source.energyCapacity) {
				setSourceNextRegenerationTime(source, Game.time, 300); // ENERGY_REGEN_TIME
			}
			insertRoomObject(room, source);
		});

		return id;
	}

	async placeMineral(roomName: string, spec: MineralSpec): Promise<string> {
		const id = this.nextId();
		this.posToSyntheticId.set(`${roomName}:${spec.pos[0]}:${spec.pos[1]}:mineral`, id);
		const ticksToRegen = spec.ticksToRegeneration;

		this.queueOp(roomName, room => {
			const mineral = new Mineral();
			mineral.id = id;
			bindObjectPos(mineral, new RoomPosition(spec.pos[0], spec.pos[1], roomName));
			mineral.mineralType = spec.mineralType as any;
			mineral.mineralAmount = spec.mineralAmount ?? 100000;
			mineral.density = 3; // DENSITY_HIGH — matches vanilla default
			if (ticksToRegen !== undefined) {
				setMineralNextRegenerationTime(mineral, this.simulation!.shard.time, ticksToRegen);
			}
			insertRoomObject(room, mineral);
		});

		return id;
	}

	async placeFlag(roomName: string, spec: FlagSpec): Promise<string> {
		const name = spec.name;
		this.nameToSyntheticId.set(name, name); // flags use name as ID

		// Flags live in a per-user blob keyed `user/<id>/flags`. The blob is
		// loaded once at sandbox init (runnerConnector.initialize, see
		// mods/flag/driver.ts:29) and never re-read — so same-tick visibility
		// of Game.flags[name] requires the blob to be in the DB BEFORE the
		// user's sandbox is created. Queue the spec; the next flushDeferredFlags
		// writes all pending flags via the flag mod's public persistence API
		// and invalidates any cached sandbox for the owner so the fresh blob
		// is loaded at re-init.
		this.deferredFlagOps.push({
			owner: spec.owner,
			roomName,
			name,
			x: spec.pos[0],
			y: spec.pos[1],
			color: spec.color ?? 1,
			secondaryColor: spec.secondaryColor ?? (spec.color ?? 1),
		});

		return name;
	}

	private deferredFlagOps: Array<{
		owner: string;
		roomName: string;
		name: string;
		x: number;
		y: number;
		color: number;
		secondaryColor: number;
	}> = [];

	async placeTombstone(roomName: string, spec: TombstoneSpec): Promise<string> {
		const id = this.nextId();
		this.posToSyntheticId.set(`${roomName}:${spec.pos[0]}:${spec.pos[1]}:tombstone`, id);

		this.queueOp(roomName, room => {
			const pos = new RoomPosition(spec.pos[0], spec.pos[1], roomName);
			const tombstone = createObject(new Tombstone(), pos);
			tombstone.id = id;
			tombstone.deathTime = spec.deathTime ?? 0;
			tombstone.store = new OpenStore();
			if (spec.store) {
				for (const [resource, amount] of Object.entries(spec.store)) {
					if (amount > 0) storeAdd(tombstone.store, resource, amount);
				}
			}
			primeTombstoneCorpse(
				tombstone,
				{
					body: [],
					id,
					name: spec.creepName,
					saying: undefined as any,
					ticksToLive: 0,
					user: '',
				},
				this.simulation!.shard.time + (spec.ticksToDecay ?? 500),
			);
			insertRoomObject(room, tombstone);
		});

		return id;
	}

	async placeRuin(roomName: string, spec: RuinSpec): Promise<string> {
		const id = this.nextId();
		this.posToSyntheticId.set(`${roomName}:${spec.pos[0]}:${spec.pos[1]}:ruin`, id);

		this.queueOp(roomName, room => {
			const pos = new RoomPosition(spec.pos[0], spec.pos[1], roomName);
			const ruin = createObject(new Ruin(), pos);
			ruin.id = id;
			ruin.destroyTime = spec.destroyTime ?? 0;
			ruin.store = new OpenStore();
			if (spec.store) {
				for (const [resource, amount] of Object.entries(spec.store)) {
					if (amount > 0) storeAdd(ruin.store, resource, amount);
				}
			}
			primeRuinStructure(
				ruin,
				{
					id,
					hitsMax: 0,
					type: spec.structureType,
					user: null as any,
				},
				this.simulation!.shard.time + (spec.ticksToDecay ?? 500),
			);
			insertRoomObject(room, ruin);
		});

		return id;
	}

	async placeDroppedResource(roomName: string, spec: DroppedResourceSpec): Promise<string> {
		const id = this.nextId();
		this.posToSyntheticId.set(`${roomName}:${spec.pos[0]}:${spec.pos[1]}:resource`, id);

		this.queueOp(roomName, room => {
			const resource = createResource(
				new RoomPosition(spec.pos[0], spec.pos[1], roomName),
				spec.resourceType as any,
				spec.amount,
			);
			resource.id = id;
			insertRoomObject(room, resource);
		});

		return id;
	}

	async placePowerCreep(_room: string, _spec: PowerCreepSpec): Promise<string> {
		throw new Error('placePowerCreep not yet implemented for xxscreeps');
	}

	async placeNuke(_room: string, _spec: NukeSpec): Promise<string> {
		throw new Error('placeNuke not yet implemented for xxscreeps');
	}

	async placeMarketOrder(_spec: MarketOrderSpec): Promise<string> {
		throw new Error('placeMarketOrder not yet implemented for xxscreeps');
	}

	async placeObject(roomName: string, type: string, spec: Record<string, unknown>): Promise<string> {
		switch (type) {
			case 'keeperLair':
				return this.placeKeeperLair(roomName, spec);
			case 'portal':
				return this.placePortal(roomName, spec);
			default:
				throw new Error(
					`placeObject: type '${type}' is not supported by the xxscreeps adapter. ` +
					`Supported types: keeperLair, portal.`,
				);
		}
	}

	private async placeKeeperLair(roomName: string, spec: Record<string, unknown>): Promise<string> {
		const id = this.nextId();
		const pos = spec.pos as [number, number];
		this.posToSyntheticId.set(`${roomName}:${pos[0]}:${pos[1]}:keeperLair`, id);
		const nextSpawnTime = typeof spec.nextSpawnTime === 'number' ? spec.nextSpawnTime : undefined;

		this.queueOp(roomName, room => {
			const lair = createKeeperLair(new RoomPosition(pos[0], pos[1], roomName));
			lair.id = id;
			if (nextSpawnTime !== undefined) {
				setKeeperLairNextSpawnTime(lair, this.simulation!.shard.time, nextSpawnTime);
			}
			insertRoomObject(room, lair);
		});

		return id;
	}

	private async placePortal(roomName: string, spec: Record<string, unknown>): Promise<string> {
		if (!createPortal) {
			throw new Error(
				`placePortal: pinned xxscreeps build has no portal mod (xxscreeps/mods/portal/portal.js missing). ` +
				`PORTAL-* tests are registered as expected failures in parity.json until the mod lands upstream.`,
			);
		}
		const id = this.nextId();
		const pos = spec.pos as [number, number];
		const dest = spec.destination as { room?: string; x?: number; y?: number; shard?: string } | undefined;
		if (!dest || !dest.room) throw new Error('placePortal: destination.room is required');
		this.posToSyntheticId.set(`${roomName}:${pos[0]}:${pos[1]}:portal`, id);
		// Cross-shard: { shard, room }. Same-shard: { room, x, y }.
		const destination = dest.shard !== undefined
			? { shard: dest.shard, room: dest.room }
			: new RoomPosition(dest.x ?? 0, dest.y ?? 0, dest.room);
		const decayTicks = typeof spec.decayTime === 'number' ? spec.decayTime : 0;

		this.queueOp(roomName, room => {
			const decayTime = decayTicks > 0 ? this.simulation!.shard.time + decayTicks : 0;
			const portal = createPortal!(new RoomPosition(pos[0], pos[1], roomName), destination, decayTime);
			portal.id = id;
			insertRoomObject(room, portal);
		});

		return id;
	}

	async setTerrain(roomName: string, terrain: TerrainSpec): Promise<void> {
		// Cached per-user sandboxes snapshot `terrainBlob` at initialize()
		// and never refresh it (driver/sandbox/nodejs.ts:createContext).
		// After a user-facing tick, at least one sandbox has likely been
		// built, so a post-tick setTerrain would land in the DB but remain
		// invisible to player code — a silent divergence. Spec §Terrain
		// requires explicit failure when the engine can't honor the
		// mutation.
		if (this.firstTickRun) {
			throw new Error(
				`xxscreeps adapter: setTerrain('${roomName}') called after a user-facing tick. ` +
				`Player sandboxes snapshot terrainBlob at creation and do not ` +
				`refresh it, so post-tick terrain mutations are invisible to ` +
				`Room.getTerrain and PathFinder. Pass terrain via RoomSpec.terrain ` +
				`at createShard time, or call setTerrain before the first runPlayer/tick.`,
			);
		}
		await this.ensureSimulation();
		await this.simulation!.updateTerrain(roomName, withCornerWalls(terrain));
	}

	// Map our synthetic IDs → engine-generated IDs (populated during setup flush)
	private idMap = new Map<string, string>();

	private async ensureSimulation(): Promise<void> {
		if (this.simulation) return;
		if (!this.shardSpec) throw new Error('createShard not called');

		const idMap = this.idMap;

		// Compute terrain for each room: explicit from spec, or all-plain
		// (matching vanilla's TerrainMatrix() default). Corners are always
		// walled to match canonical map-generator semantics.
		const terrainOverrides: Record<string, TerrainSpec> = {};
		const allPlain = new Array(2500).fill(0) as TerrainSpec;
		for (const roomSpec of this.shardSpec.rooms) {
			terrainOverrides[roomSpec.name] = withCornerWalls(roomSpec.terrain ?? allPlain);
		}

		// Create simulation with bare rooms (no test objects) and terrain
		// overrides, then run a warm-up tick matching vanilla's init pattern.
		const bareInits: Record<string, (room: any) => void> = {};
		for (const roomName of this.rooms) {
			bareInits[roomName] = () => {};
		}
		this.simulation = await createSimulation(bareInits, terrainOverrides);
		await this.simulation.tick(1);

		await this.keepRoomsActive();

		// Now apply all pending setup ops via poke on top of the canonical
		// sparse room layout used by the adapter contract: plain terrain
		// (handled above), one controller at (1,1), and no ambient objects.
		for (const roomName of this.rooms) {
			const ops = this.pendingSetup.get(roomName);
			const stripAndSetup = (room: any) => {
				this.resetRoomToCanonicalLayout(room, roomName);
				if (ops) {
					for (const op of ops) op(room);
				}
			};
			this.pokeQueue.push({ room: roomName, fn: stripAndSetup });
		}
		this.pendingSetup.clear();
		await this.flushPokeQueue();

		// After simulation init, objects have been saved and reloaded.
		// Build the ID map by scanning rooms for objects placed by name/position.
		for (const roomName of this.rooms) {
			await this.simulation.peekRoom(roomName, (room: any) => {
				for (const obj of iterateRoomObjects(room)) {
					// Match by name for creeps
					if (obj.name && this.nameToSyntheticId.has(obj.name)) {
						idMap.set(this.nameToSyntheticId.get(obj.name)!, obj.id);
					}
					// Match by pos+type for structures/sites/sources/minerals
					// Try multiple key formats since type identification varies
					const x = obj.pos?.x;
					const y = obj.pos?.y;
					if (x !== undefined && y !== undefined) {
						// Build keys specific to the object's actual type to avoid
						// co-located objects (e.g. mineral + extractor) cross-matching.
						const keys: string[] = [];
						if (obj.structureType) {
							keys.push(`${roomName}:${x}:${y}:${obj.structureType}`);
						} else if (obj.mineralType !== undefined) {
							keys.push(`${roomName}:${x}:${y}:mineral`);
						} else if (obj.energyCapacity !== undefined) {
							keys.push(`${roomName}:${x}:${y}:source`);
						} else {
							keys.push(`${roomName}:${x}:${y}:${obj.constructor?.name}`);
							keys.push(`${roomName}:${x}:${y}:constructionSite`);
						}
						for (const key of keys) {
							if (this.posToSyntheticId.has(key)) {
								idMap.set(this.posToSyntheticId.get(key)!, obj.id);
							}
						}
					}
				}
			});
		}

	}

	// Tracking maps for ID resolution
	private nameToSyntheticId = new Map<string, string>();
	private posToSyntheticId = new Map<string, string>();

	private resolveId(syntheticId: string): string {
		return this.idMap.get(syntheticId) ?? syntheticId;
	}

	private async flushPokeQueue(): Promise<void> {
		if (!this.simulation || this.pokeQueue.length === 0) return;
		// Group by room for efficiency
		const byRoom = new Map<string, Array<(room: any) => void>>();
		for (const { room, fn } of this.pokeQueue) {
			let ops = byRoom.get(room);
			if (!ops) { ops = []; byRoom.set(room, ops); }
			ops.push(fn);
		}
		this.pokeQueue.length = 0;

		for (const [roomName, ops] of byRoom) {
			await this.simulation.poke(roomName, undefined, (_game: any, room: any) => {
				for (const op of ops) op(room);
			});
		}

		// Rebuild ID map after poke (new objects need mapping)
		for (const roomName of this.rooms) {
			await this.simulation.peekRoom(roomName, (room: any) => {
				for (const obj of iterateRoomObjects(room)) {
					if (obj.name && this.nameToSyntheticId.has(obj.name)) {
						this.idMap.set(this.nameToSyntheticId.get(obj.name)!, obj.id);
					}
					const x = obj.pos?.x;
					const y = obj.pos?.y;
					if (x !== undefined && y !== undefined) {
						const keys = [
							`${roomName}:${x}:${y}:${getStructureType(obj)}`,
							`${roomName}:${x}:${y}:constructionSite`,
							`${roomName}:${x}:${y}:source`,
							`${roomName}:${x}:${y}:mineral`,
						];
						for (const key of keys) {
							if (this.posToSyntheticId.has(key)) {
								this.idMap.set(this.posToSyntheticId.get(key)!, obj.id);
							}
						}
					}
				}
			});
		}
	}

	async runPlayer(userId: string, playerCode: PlayerCode): Promise<PlayerReturnValue> {
		await this.ensureSimulation();
		await this.flushDeferredFlags();
		await this.flushPokeQueue();
		await this.keepRoomsActive();
		const engineUserId = this.resolvePlayer(userId);
		const ownedRoomCount = this.shardSpec?.rooms.filter(room => room.owner === userId).length ?? 0;

		// Replace synthetic IDs with engine IDs in the code string.
		let codeStr = String(playerCode);
		for (const [syntheticId, engineId] of this.idMap) {
			codeStr = codeStr.replaceAll(JSON.stringify(syntheticId), JSON.stringify(engineId));
		}
		const trimmed = codeStr.trimEnd().replace(/;$/, '');

		// Game.gcl.level: PlayerSpec.gcl override if set (honest value for
		// tests that need ERR_GCL_NOT_ENOUGH), else a generous polyfill so
		// multi-room claim tests aren't blocked by the cap.
		const gclLevel = this.playerGcl.get(userId) ?? Math.max(ownedRoomCount + 1, 2);
		const result = await this.simulation!.player(engineUserId, trimmed, {
			gclBaseline: gclLevelToProgress(gclLevel),
			controlledRoomCount: ownedRoomCount,
		});

		// Contract: runPlayer advances exactly 1 tick.
		// simulation.player() only collects intents — tick() processes them.
		await this.keepRoomsActive();
		await this.simulation!.tick(1);
		this.firstTickRun = true;

		return result ?? null;
	}

	async runPlayers(codesByUser: Record<string, PlayerCode>): Promise<Record<string, PlayerReturnValue>> {
		await this.ensureSimulation();
		await this.flushDeferredFlags();
		await this.flushPokeQueue();
		await this.keepRoomsActive();

		const results: Record<string, PlayerReturnValue> = {};
		const errors: Array<{ handle: string; error: RunPlayerError }> = [];

		// Phase 1: collect intents from all players without ticking.
		// simulation.player() queues intents; simulation.tick() processes them.
		for (const [userId, playerCode] of Object.entries(codesByUser)) {
			const engineUserId = this.resolvePlayer(userId);
			const ownedRoomCount = this.shardSpec?.rooms.filter(room => room.owner === userId).length ?? 0;

			let codeStr = String(playerCode);
			for (const [syntheticId, engineId] of this.idMap) {
				codeStr = codeStr.replaceAll(JSON.stringify(syntheticId), JSON.stringify(engineId));
			}
			const trimmed = codeStr.trimEnd().replace(/;$/, '');

			const gclLevel = this.playerGcl.get(userId) ?? Math.max(ownedRoomCount + 1, 2);
			try {
				results[userId] = await this.simulation!.player(engineUserId, trimmed, {
					gclBaseline: gclLevelToProgress(gclLevel),
					controlledRoomCount: ownedRoomCount,
				});
			} catch (err) {
				if (err instanceof RunPlayerError) {
					errors.push({ handle: userId, error: err });
				} else {
					const error = err as Error;
					const kind = error instanceof SyntaxError ? 'syntax' as const : 'runtime' as const;
					errors.push({ handle: userId, error: new RunPlayerError(kind, error.message) });
				}
			}
		}

		// Surface first error
		if (errors.length > 0) throw errors[0].error;

		// Phase 2: process all collected intents in a single tick.
		await this.keepRoomsActive();
		await this.simulation!.tick(1);
		this.firstTickRun = true;

		// Normalize undefined → null
		for (const key of Object.keys(results)) {
			results[key] = results[key] ?? null;
		}
		return results;
	}

	async tick(count = 1): Promise<void> {
		await this.ensureSimulation();
		await this.flushDeferredFlags();
		await this.flushPokeQueue();
		for (let i = 0; i < count; i++) {
			await this.keepRoomsActive();
			await this.simulation!.tick(1);
		}
		if (count > 0) this.firstTickRun = true;
	}

	private async flushDeferredFlags(): Promise<void> {
		if (this.deferredFlagOps.length === 0) return;
		const ops = this.deferredFlagOps;
		this.deferredFlagOps = [];
		const shard = this.simulation!.shard;

		// Group ops by owner so each user's blob is loaded, mutated, and
		// saved once. The flag mod's public persistence path:
		//   loadUserFlagBlob → readFlagBlob → mutate → writeFlagBlob →
		//   saveUserFlagBlobForNextTick. This is the same path mods/flag/
		//   driver.ts:38 uses from the backend.
		const byOwner = new Map<string, typeof ops>();
		for (const op of ops) {
			const list = byOwner.get(op.owner) ?? [];
			list.push(op);
			byOwner.set(op.owner, list);
		}

		for (const [ownerHandle, ownerOps] of byOwner) {
			const engineUserId = this.resolvePlayer(ownerHandle);
			const existingBlob = await loadUserFlagBlob(shard, engineUserId);
			const flags = existingBlob ? readFlagBlob(existingBlob) : Object.create(null);

			for (const op of ownerOps) {
				const pos = new RoomPosition(op.x, op.y, op.roomName);
				const flag = instantiate(Flag, {
					id: null as never,
					pos,
					name: op.name,
					color: op.color as any,
					secondaryColor: op.secondaryColor as any,
				});
				bindObjectPos(flag, pos);
				(flags as Record<string, any>)[op.name] = flag;
			}

			await saveUserFlagBlobForNextTick(shard, engineUserId, writeFlagBlob(flags));

			// Cached sandbox (if any) holds the pre-write flag state in its
			// module-level `flags` var (mods/flag/game.ts:37). Dispose so
			// the next runPlayer re-creates the sandbox and initialize()
			// reloads the fresh blob from DB.
			await this.simulation!.disposeUserSandbox(engineUserId);
		}
	}

	async getObject(id: string): Promise<ObjectSnapshot | null> {
		await this.ensureSimulation();
		await this.flushPokeQueue();
		const engineId = this.resolveId(id);
		for (const roomName of this.rooms) {
			const snapshot = await this.simulation!.peekRoom(roomName, (room: any) => {
				for (const obj of iterateRoomObjects(room)) {
					if (obj.id === engineId) return snapshotObject(obj, this);
				}
				return null;
			});
			if (snapshot) return snapshot;
		}
		return null;
	}

	async findInRoom(roomName: string, type: number): Promise<any[]> {
		await this.ensureSimulation();
		await this.flushPokeQueue();
		const selector = selectorFromFindConstant(type);
		return this.simulation!.peekRoom(roomName, (room: any) => {
			return snapshotRoom(room, selector, this);
		});
	}

	async getGameTime(): Promise<number> {
		await this.ensureSimulation();
		return this.simulation!.shard.time;
	}

	async getControllerPos(roomName: string): Promise<{ x: number; y: number } | null> {
		await this.ensureSimulation();
		await this.flushPokeQueue();
		return this.simulation!.peekRoom(roomName, (room: any) => {
			for (const obj of iterateRoomObjects(room)) {
				try {
					if (obj.structureType === 'controller') {
						return { x: obj.pos.x, y: obj.pos.y };
					}
				} catch {}
			}
			return null;
		});
	}

	async teardown(): Promise<void> {
		if (this.simulation) {
			await this.simulation.dispose();
			this.simulation = null;
		}
		this.pendingSetup.clear();
		this.pokeQueue.length = 0;
		this.deferredFlagOps.length = 0;
		this.playerMap.clear();
		this.reversePlayerMap.clear();
		this.playerGcl.clear();
		this.idMap.clear();
		this.nameToSyntheticId.clear();
		this.posToSyntheticId.clear();
		this.idCounter = 0;
		this.firstTickRun = false;
	}
}

function buildStructure(structureType: string, pos: any, owner?: string, rcl = 8): any {
	switch (structureType) {
		case 'spawn': return createSpawn(pos, owner!, `Spawn-${pos.x}-${pos.y}`);
		case 'extension': return createExtension(pos, rcl, owner!);
		case 'tower': return createTower(pos, owner!);
		case 'lab': return createLab(pos, owner!);
		case 'observer': return createObserver(pos, owner!);
		case 'storage': return createStorage(pos, owner!);
		case 'link': return createLink(pos, owner!);
		case 'container': return createContainer(pos);
		case 'road': return createRoad(pos);
		case 'constructedWall': return createWall(pos);
		case 'rampart': return createRampart(pos, owner!);
		case 'terminal':
			if (!createTerminal) throw new Error('terminal create() not exported by this xxscreeps build');
			return createTerminal(pos, owner!);
		case 'factory':
			if (!createFactory) throw new Error('factory mod not available in this xxscreeps build');
			return createFactory(pos, owner!);
		case 'extractor': return createExtractor(pos, owner!);
		default: throw new Error(`Unsupported structure type: ${structureType}`);
	}
}

function setStoreContentsExact(store: any, desired: Record<string, number>): void {
	for (const [resource, amount] of [...storeEntries(store)]) {
		if (typeof amount === 'number' && amount > 0) {
			storeSubtract(store, resource, amount);
		}
	}
	for (const [resource, amount] of Object.entries(desired)) {
		if (amount > 0) {
			storeAdd(store, resource, amount);
		}
	}
}

function buildTerrainEntry(spec: TerrainSpec): { exits: number; terrain: TerrainWriter } {
	const writer = new TerrainWriter();
	for (let i = 0; i < 2500; i++) {
		const mask = spec[i];
		if (mask === 1) writer.set(i % 50, Math.floor(i / 50), C.TERRAIN_MASK_WALL);
		else if (mask === 2) writer.set(i % 50, Math.floor(i / 50), C.TERRAIN_MASK_SWAMP);
	}
	return { exits: packExits(writer), terrain: writer };
}

// Inlined from xxscreeps/src/test/simulate.ts with terrain override support.
// The original simulate() captures `world` by closure, preventing terrain
// replacement. This version injects overrides between shard creation and
// room initialization, and exposes updateTerrain for post-creation changes.
async function createSimulation(
	roomInits: Record<string, (room: any) => void>,
	terrainOverrides?: Record<string, TerrainSpec>,
) {
	const testShard = await instantiateTestShard();
	const { db, shard } = testShard;

	// Mutable terrain map — always maintained so updateTerrain can modify
	// individual rooms and rebuild the world.
	const terrainMap = new Map<string, { exits: number; terrain: TerrainWriter }>();

	// Base: all shard.json rooms start with blank (all-plain) terrain
	const existingRooms = await shard.data.smembers('rooms');
	for (const roomName of existingRooms) {
		const writer = new TerrainWriter();
		terrainMap.set(roomName, { exits: packExits(writer), terrain: writer });
	}

	// Apply overrides (explicit terrain or all-plain from the test spec)
	if (terrainOverrides) {
		for (const [roomName, spec] of Object.entries(terrainOverrides)) {
			terrainMap.set(roomName, buildTerrainEntry(spec));
		}
		await shard.data.sadd('rooms', Object.keys(terrainOverrides));
	}

	// Build world from terrain map
	let blob = makeWriter(MapSchema.schema)(terrainMap);
	let world = new MapSchema.World('test', blob);
	loadTerrain(world);
	await shard.data.set('terrain', blob);

	// Rebuild world after terrain map mutation
	async function rebuildWorld() {
		blob = makeWriter(MapSchema.schema)(terrainMap);
		world = new MapSchema.World('test', blob);
		loadTerrain(world);
		await shard.data.set('terrain', blob);
	}

	try {
		// Initialize rooms (inlined from xxscreeps/src/test/simulate.ts:76-86)
		await Promise.all(Fn.map(Object.entries(roomInits), async ([roomName, callback]) => {
			let room;
			try {
				room = await shard.loadRoom(roomName, shard.time);
			} catch {
				// Room not in shard.json — create a blank room
				room = new Room();
				room.name = roomName;
				await shard.data.sadd('rooms', [roomName]);
			}
			runOneShot(world, room, shard.time, '', () => callback(room));
			room['#flushObjects'](null);
			const previousUsers = flushUsers(room);
			await Promise.all([
				shard.saveRoom(room.name, shard.time + 1, room),
				shard.saveRoom(room.name, shard.time, room),
				updateUserRoomRelationships(shard, room, previousUsers),
			]);
		}));

		// Simulation state (inlined from xxscreeps/src/test/simulate.ts:89-183)
		const intentsByRoom = new Map<string, { userId: string; intents: any }[]>();
		const playersThisTick = new Set<string>();
		let roomInstances = new Map<string, any>();
		// Sandbox cache: one NodejsSandbox per user, created lazily on first
		// `player()` call and reused across ticks. Module-level state inside
		// each sandbox (flags, memory) persists naturally.
		const userSandboxes = new Map<string, UserSandbox>();

		const sim = {
			db,
			shard,
			world,

			async peekRoom<T>(roomName: string, task: (room: any, game: any) => T): Promise<T> {
				const room = await shard.loadRoom(roomName);
				return runOneShot(world, room, shard.time, '', () => task(room, Game));
			},

			async poke<T>(roomName: string, userId: string | undefined, task: (game: any, room: any) => T): Promise<T> {
				const room = await shard.loadRoom(roomName);
				const state = new GameState(world, shard.time, [room]);
				const [, result] = runWithState(state, () =>
					runForUser(userId ?? '', state, (G: any) => task(G, room)));
				room['#flushObjects'](state);
				const previousUsers = flushUsers(room);
				await Promise.all([
					shard.saveRoom(room.name, shard.time, room),
					updateUserRoomRelationships(shard, room, previousUsers),
				]);
				roomInstances.delete(roomName);
				return result;
			},

			async player(userId: string, codeSource: string, opts: {
				gclBaseline?: number;
				controlledRoomCount?: number;
				usernames?: Record<string, string>;
			} = {}): Promise<PlayerReturnValue> {
				assert(!playersThisTick.has(userId), `player '${userId}' already invoked this tick`);
				playersThisTick.add(userId);

				const [intentRooms, visibleRooms] = await Promise.all([
					shard.scratch.smembers(userToIntentRoomsSetKey(userId)),
					shard.scratch.smembers(userToVisibleRoomsSetKey(userId)),
				]);
				const roomBlobs = await Promise.all(Fn.map(visibleRooms,
					(rn: string) => shard.loadRoomBlob(rn, shard.time)));

				let sandbox = userSandboxes.get(userId);
				if (!sandbox) {
					sandbox = await UserSandbox.create(shard, world, userId);
					userSandboxes.set(userId, sandbox);
				}

				const { value, intentPayloads } = await sandbox.run(codeSource, {
					time: shard.time,
					roomBlobs,
					usernames: opts.usernames,
					gclBaseline: opts.gclBaseline,
					controlledRoomCount: opts.controlledRoomCount,
				});

				const intentRoomSet = new Set(intentRooms);
				for (const [roomName, roomIntents] of Object.entries(intentPayloads)) {
					if (intentRoomSet.has(roomName) && roomIntents) {
						getOrSet(intentsByRoom, roomName, () => []).push({ userId, intents: roomIntents });
					}
				}

				return value;
			},

			async tick(count = 1, players: Record<string, string> = {}): Promise<void> {
				for (let ii = 0; ii < count; ++ii) {
					for (const [userId, code] of Object.entries(players)) {
						await sim.player(userId, code);
					}
					playersThisTick.clear();

					const time = shard.time + 1;
					const processorTime = await begetRoomProcessQueue(shard, time, time - 1);
					assert.equal(time, processorTime);
					const nextRoomInstances = new Map<string, any>();
					const contexts = new Map<string, any>();

					// First phase
					for await (const roomName of consumeSortedSet(shard.scratch, processRoomsSetKey(time), 0, Infinity)) {
						const room = roomInstances.get(roomName) ?? await shard.loadRoom(roomName);
						nextRoomInstances.set(roomName, room);
						const context = new RoomProcessor(shard, world, room, time);
						contexts.set(roomName, context);
						for (const { userId, intents } of intentsByRoom.get(roomName) ?? []) {
							context.saveIntents(userId, intents);
						}
						await context.process();
					}
					roomInstances = nextRoomInstances;
					intentsByRoom.clear();

					// Second phase
					await Promise.all(Fn.map(contexts.values(), (ctx: any) => ctx.finalize(false)));
					for await (const roomName of consumeSet(shard.scratch, finalizeExtraRoomsSetKey(time))) {
						let room;
						try {
							room = roomInstances.get(roomName) ?? await shard.loadRoom(roomName);
						} catch {
							continue;
						}
						const context = new RoomProcessor(shard, world, room, time);
						await context.process(true);
						await context.finalize(true);
						nextRoomInstances.set(roomName, room);
					}

					await shard.data.set('time', time);
					await shard.channel.publish({ type: 'tick', time });
					shard.time = time;
				}
			},
		};

		return {
			...sim,
			async updateTerrain(roomName: string, spec: TerrainSpec): Promise<void> {
				terrainMap.set(roomName, buildTerrainEntry(spec));
				await shard.data.sadd('rooms', [roomName]);
				await rebuildWorld();
			},
			async disposeUserSandbox(userId: string): Promise<void> {
				const sandbox = userSandboxes.get(userId);
				if (!sandbox) return;
				try { sandbox.dispose(); } catch {}
				userSandboxes.delete(userId);
			},
			async dispose() {
				for (const sandbox of userSandboxes.values()) {
					try { sandbox.dispose(); } catch {}
				}
				userSandboxes.clear();
				disposeTestShard(testShard);
			},
		};
	} catch (err) {
		disposeTestShard(testShard);
		throw err;
	}
}

function disposeTestShard(testShard: any): void {
	const dispose = testShard[(Symbol as any).dispose];
	if (typeof dispose === 'function') {
		dispose.call(testShard);
		return;
	}
	testShard.shard?.disconnect?.();
	testShard.db?.disconnect?.();
}

export async function createAdapter(): Promise<ScreepsOkAdapter> {
	return new XxscreepsAdapter();
}
