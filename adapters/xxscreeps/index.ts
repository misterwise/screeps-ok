import type { GameConstructor } from 'xxscreeps/game/index.js';
import { Game, GameState, runForUser, runOneShot, runWithState } from 'xxscreeps/game/index.js';
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
import { RoomPosition } from 'xxscreeps/game/position.js';
import { search as pfSearch, CostMatrix } from 'xxscreeps/game/path-finder/index.js';
import * as C from 'xxscreeps/game/constants/index.js';

// Build synthetic PathFinder object matching the Screeps global API
const PathFinder = { search: pfSearch, CostMatrix };
import assert from 'node:assert';
import { instantiateTestShard } from 'xxscreeps/test/import.js';
import { consumeSet, consumeSortedSet } from 'xxscreeps/engine/db/async.js';
import { begetRoomProcessQueue, finalizeExtraRoomsSetKey, processRoomsSetKey, updateUserRoomRelationships, userToIntentRoomsSetKey, userToVisibleRoomsSetKey } from 'xxscreeps/engine/processor/model.js';
import { RoomProcessor } from 'xxscreeps/engine/processor/room.js';
import { Fn } from 'xxscreeps/functional/fn.js';
import { flushUsers } from 'xxscreeps/game/room/room.js';
import { getOrSet } from 'xxscreeps/utility/utility.js';
import { TerrainWriter, packExits } from 'xxscreeps/game/terrain.js';
import { loadTerrain } from 'xxscreeps/driver/path-finder.js';
import * as MapSchema from 'xxscreeps/game/map.js';
import { makeWriter } from 'xxscreeps/schema/write.js';
import { snapshotObject, snapshotRoom, getStructureType } from './snapshots.js';

// Object creation imports
import { create as createCreep, calculateCarry } from 'xxscreeps/mods/creep/creep.js';
import { create as createSpawn } from 'xxscreeps/mods/spawn/spawn.js';
import { create as createExtension } from 'xxscreeps/mods/spawn/extension.js';
import { create as createSite } from 'xxscreeps/mods/construction/construction-site.js';
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
import { create as createTerminal } from 'xxscreeps/mods/market/terminal.js';
import { create as createExtractor } from 'xxscreeps/mods/mineral/extractor.js';
import { create as createResource } from 'xxscreeps/mods/resource/resource.js';
import { createFlag } from 'xxscreeps/mods/flag/game.js';
import { Tombstone } from 'xxscreeps/mods/creep/tombstone.js';
import { Ruin } from 'xxscreeps/mods/structure/ruin.js';
import { create as createObject } from 'xxscreeps/game/object.js';
import { OpenStore } from 'xxscreeps/mods/resource/store.js';
import { StructureController } from 'xxscreeps/mods/controller/controller.js';

// Optional mods — not all xxscreeps builds include these
let createFactory: ((pos: any, owner: string) => any) | undefined;
try {
	({ create: createFactory } = await import('xxscreeps/mods/factory/factory.js'));
} catch {}

// Module-level initialization
import { importMods } from 'xxscreeps/config/mods/index.js';
import { initializeIntentConstraints } from 'xxscreeps/engine/processor/index.js';
import { initializeGameEnvironment } from 'xxscreeps/game/index.js';
import 'xxscreeps/config/mods/import/game.js';

await importMods('processor');
initializeGameEnvironment();
initializeIntentConstraints();

// Player handle → xxscreeps user ID
const playerSlots = ['100', '101', '102', '103'];

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
	};

	private playerMap = new Map<string, string>();
	private reversePlayerMap = new Map<string, string>();
	private pendingSetup = new Map<string, Array<(room: Room) => void>>();
	private rooms: string[] = [];
	private simulation: Awaited<ReturnType<typeof createSimulation>> | null = null;
	private shardSpec: ShardSpec | null = null;
	private idCounter = 0;

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

	// xxscreeps deactivates rooms and clears user-room associations after
	// idle ticks (ticks where no player code ran). In a test harness every
	// room must stay processable and every player must keep intent/vision
	// access regardless of idle gaps. Re-add both before every tick.
	private async keepRoomsActive(): Promise<void> {
		if (!this.simulation) return;
		const { scratch } = this.simulation.shard;
		for (const roomName of this.rooms) {
			await scratch.zadd('processor/activeRooms', [[1, roomName]]);
		}
		for (const [, engineId] of this.playerMap) {
			for (const roomName of this.rooms) {
				await scratch.sadd(`user/${engineId}/intentRooms`, [roomName]);
				await scratch.sadd(`user/${engineId}/visibleRooms`, [roomName]);
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

	async createShard(spec: ShardSpec): Promise<void> {
		this.shardSpec = spec;
		this.rooms = spec.rooms.map(r => r.name);

		for (let i = 0; i < spec.players.length; i++) {
			if (i >= playerSlots.length) throw new Error(`Max ${playerSlots.length} players`);
			const entry = spec.players[i];
			const handle = typeof entry === 'string' ? entry : entry.name;
			// PlayerSpec.gcl is intentionally ignored: xxscreeps synthesizes
			// Game.gcl from owned room count and exposes no override, so the
			// `playerGclControl` limitation stays gated for this adapter.
			this.playerMap.set(handle, playerSlots[i]);
			this.reversePlayerMap.set(playerSlots[i], handle);
		}

		for (const roomSpec of spec.rooms) {
			if (roomSpec.owner || roomSpec.rcl) {
				const owner = roomSpec.owner ? this.resolvePlayer(roomSpec.owner) : undefined;
				const rcl = roomSpec.rcl ?? (roomSpec.owner ? 1 : 0);
				const safeModeAvail = roomSpec.safeModeAvailable ?? 0;
				const safeModeRemaining = roomSpec.safeMode ?? 0;
				const rName = roomSpec.name;
				this.queueOp(rName, room => {
					if (rcl > 0 && owner) {
						// shard.json rooms may lack a controller — create one
						if (!room.controller) {
							const ctrl = new StructureController();
							ctrl.id = this.nextId();
							ctrl.pos = new RoomPosition(1, 1, rName);
							ctrl['#posId'] = ctrl.pos['#id'];
							room['#user'] = null;
							room['#insertObject'](ctrl, true);
						}
						room['#level'] = rcl;
						room['#user'] = room.controller!['#user'] = owner;
					}
					if (safeModeAvail > 0 && room.controller) {
						room.controller.safeModeAvailable = safeModeAvail;
					}
					if (safeModeRemaining > 0 && room.controller) {
						// xxscreeps stores active safe mode as `#safeModeUntil`
						// on the room object (absolute tick); the getter at
						// `xxscreeps/src/mods/controller/controller.ts:28`
						// reports `Math.max(0, #safeModeUntil - Game.time)`.
						(room as any)['#safeModeUntil'] = Game.time + safeModeRemaining;
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
				(creep.store as any)['#capacity'] = calculateCarry(creep.body);
			}
			if (spec.ticksToLive !== undefined) {
				creep['#ageTime'] = Game.time + spec.ticksToLive;
			}
			if (spec.store) {
				for (const [resource, amount] of Object.entries(spec.store)) {
					creep.store['#add'](resource, amount);
				}
			}
			room['#insertObject'](creep);
		});

		return id;
	}

	async placeStructure(roomName: string, spec: StructureSpec): Promise<string> {
		const id = this.nextId();
		const userId = spec.owner ? this.resolvePlayer(spec.owner) : undefined;
		this.posToSyntheticId.set(`${roomName}:${spec.pos[0]}:${spec.pos[1]}:${spec.structureType}`, id);

		this.queueOp(roomName, room => {
			const pos = new RoomPosition(spec.pos[0], spec.pos[1], roomName);
			const structure = buildStructure(spec.structureType, pos, userId, room['#level'] ?? 0);
			structure.id = id;
			if (spec.hits !== undefined) {
				structure.hits = spec.hits;
			}
			if (spec.store) {
				setStoreContentsExact(structure.store, spec.store);
			}
			if (spec.ticksToDecay !== undefined) {
				(structure as any)['#nextDecayTime'] = this.simulation!.shard.time + spec.ticksToDecay;
			}
			room['#insertObject'](structure);
		});

		return id;
	}

	async placeSite(roomName: string, spec: SiteSpec): Promise<string> {
		const id = this.nextId();
		const userId = this.resolvePlayer(spec.owner);
		this.posToSyntheticId.set(`${roomName}:${spec.pos[0]}:${spec.pos[1]}:constructionSite`, id);

		this.queueOp(roomName, room => {
			const site = createSite(
				new RoomPosition(spec.pos[0], spec.pos[1], roomName),
				spec.structureType as any,
				userId,
			);
			site.id = id;
			if (spec.progress !== undefined) {
				site.progress = spec.progress;
			}
			room['#insertObject'](site);
		});

		return id;
	}

	async placeSource(roomName: string, spec: SourceSpec): Promise<string> {
		const id = this.nextId();
		this.posToSyntheticId.set(`${roomName}:${spec.pos[0]}:${spec.pos[1]}:source`, id);

		this.queueOp(roomName, room => {
			const source = new Source();
			source.id = id;
			source.pos = new RoomPosition(spec.pos[0], spec.pos[1], roomName);
			source['#posId'] = source.pos['#id'];
			source.energyCapacity = spec.energyCapacity ?? 3000;
			source.energy = spec.energy ?? source.energyCapacity;
			// Set regen timer if source is depleted
			if (spec.ticksToRegeneration !== undefined && spec.ticksToRegeneration > 0) {
				source['#nextRegenerationTime'] = Game.time + spec.ticksToRegeneration;
			} else if (source.energy < source.energyCapacity) {
				source['#nextRegenerationTime'] = Game.time + 300; // ENERGY_REGEN_TIME
			}
			room['#insertObject'](source);
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
			mineral.pos = new RoomPosition(spec.pos[0], spec.pos[1], roomName);
			mineral['#posId'] = mineral.pos['#id'];
			mineral.mineralType = spec.mineralType as any;
			mineral.mineralAmount = spec.mineralAmount ?? 100000;
			mineral.density = 3; // DENSITY_HIGH — matches vanilla default
			if (ticksToRegen !== undefined) {
				(mineral as any)['#nextRegenerationTime'] = this.simulation!.shard.time + ticksToRegen;
			}
			room['#insertObject'](mineral);
		});

		return id;
	}

	async placeFlag(roomName: string, spec: FlagSpec): Promise<string> {
		const name = spec.name;
		this.nameToSyntheticId.set(name, name); // flags use name as ID

		// Flags are stored in a per-user blob, not in room objects.
		// Create them via player code so the runtime flag system handles
		// persistence correctly.
		const owner = spec.owner;
		const color = spec.color ?? 1;
		const secondaryColor = spec.secondaryColor ?? color;
		const x = spec.pos[0];
		const y = spec.pos[1];

		this.deferredFlagOps.push(async () => {
			const { code } = await import('../../src/code.js');
			await this.runPlayer(owner, code`
				new RoomPosition(${x}, ${y}, ${roomName}).createFlag(${name}, ${color}, ${secondaryColor})
			`);
		});

		return name;
	}

	private deferredFlagOps: Array<() => Promise<void>> = [];

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
					if (amount > 0) tombstone.store['#add'](resource as any, amount);
				}
			}
			tombstone['#creep'] = {
				body: [],
				id: id,
				name: spec.creepName,
				saying: undefined as any,
				ticksToLive: 0,
				user: '',
			};
			tombstone['#decayTime'] = (spec.deathTime ?? 0) + (spec.ticksToDecay ?? 500);
			room['#insertObject'](tombstone);
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
					if (amount > 0) ruin.store['#add'](resource as any, amount);
				}
			}
			ruin['#decayTime'] = (spec.destroyTime ?? 0) + (spec.ticksToDecay ?? 500);
			ruin['#structure'] = {
				id: id,
				hitsMax: 0,
				type: spec.structureType,
				user: null as any,
			};
			room['#insertObject'](ruin);
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
			room['#insertObject'](resource);
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

	async placeObject(_room: string, _type: string, _spec: Record<string, unknown>): Promise<string> {
		throw new Error('generic placeObject not yet implemented — use typed helpers');
	}

	async setTerrain(roomName: string, terrain: TerrainSpec): Promise<void> {
		await this.ensureSimulation();
		await this.simulation!.updateTerrain(roomName, terrain);
	}

	// Map our synthetic IDs → engine-generated IDs (populated during setup flush)
	private idMap = new Map<string, string>();

	private async ensureSimulation(): Promise<void> {
		if (this.simulation) return;
		if (!this.shardSpec) throw new Error('createShard not called');

		const idMap = this.idMap;

		// Compute terrain for each room: explicit from spec, or all-plain
		// (matching vanilla's TerrainMatrix() default).
		const terrainOverrides: Record<string, TerrainSpec> = {};
		const allPlain = new Array(2500).fill(0) as TerrainSpec;
		for (const roomSpec of this.shardSpec.rooms) {
			terrainOverrides[roomSpec.name] = roomSpec.terrain ?? allPlain;
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

		// Now apply all pending setup ops via poke: strip default
		// sources/minerals, set controller ownership, place objects.
		for (const roomName of this.rooms) {
			const ops = this.pendingSetup.get(roomName);
			const stripAndSetup = (room: any) => {
				for (const obj of [...room['#objects']]) {
					try {
						const st = getStructureType(obj);
						if (!st && obj.energyCapacity !== undefined) room['#removeObject'](obj);
						if (obj.mineralType !== undefined) room['#removeObject'](obj);
					} catch {}
				}
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
				for (const obj of room['#objects']) {
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
				for (const obj of room['#objects']) {
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
		await this.flushPokeQueue();
		await this.keepRoomsActive();
		const engineUserId = this.resolvePlayer(userId);
		const ownedRoomCount = this.shardSpec?.rooms.filter(room => room.owner === userId).length ?? 0;
		let result: PlayerReturnValue = null;
		let executed = false;

		// Replace synthetic IDs with engine IDs in the code string
		let codeStr = String(playerCode);
		for (const [syntheticId, engineId] of this.idMap) {
			codeStr = codeStr.replaceAll(JSON.stringify(syntheticId), JSON.stringify(engineId));
		}

		// Read GCL from DB before invoking player code — the engine
		// increments gcl in the DB (controller/processor.ts:239) but
		// simulate().player() never populates Game.gcl from it.
		const gclRaw = await this.simulation!.shard.db.data.hget(
			`user/${engineUserId}`, 'gcl');
		const gclProgress = Number(gclRaw) || 0;

		try {
			await this.simulation!.player(engineUserId, (Game: GameConstructor) => {
				// Build a context with Game + all Screeps constants + globals
				const trimmed = codeStr.trimEnd().replace(/;$/, '');

				// xxscreeps simulate() doesn't currently populate Game.gcl, but controller
				// APIs assume it exists during claim checks. Read progress from DB.
				if (!(Game as any).gcl) {
					(Game as any).gcl = {
						level: Math.max(ownedRoomCount + 1, 2),
						progress: gclProgress,
						progressTotal: 1,
						'#roomCount': ownedRoomCount,
					};
				}

				// Collect all available globals from the game environment
				const globals: Record<string, any> = { Game, RoomPosition, PathFinder, Room };
				// Add all constants (TOP, WORK, FIND_MY_CREEPS, etc.)
				Object.assign(globals, C);
				// Add registered globals (Memory, RawMemory, structure classes, etc.)
				// that were placed on globalThis by xxscreeps registerGlobal
				for (const name of ['Memory', 'RawMemory', 'Mineral', 'Flag',
					'Creep', 'Tombstone', 'Ruin', 'Source', 'Resource', 'Store',
					'Room', 'RoomObject', 'ConstructionSite',
					'Structure', 'OwnedStructure',
					'StructureSpawn', 'StructureExtension', 'StructureTower',
					'StructureLink', 'StructureStorage', 'StructureTerminal',
					'StructureContainer', 'StructureExtractor', 'StructureRampart',
					'StructureWall', 'StructureRoad', 'StructureController',
					'StructureLab', 'StructureObserver', 'StructureFactory',
					'StructureKeeperLair',
					'RoomVisual', 'MapVisual', '_',
				] as const) {
					if ((globalThis as any)[name] !== undefined) {
						globals[name] = (globalThis as any)[name];
					}
				}

				const names = Object.keys(globals);
				const values = Object.values(globals);
				const fn = new Function(...names,
					`return eval(${JSON.stringify(trimmed)})`);
				result = fn(...values) as PlayerReturnValue;
				executed = true;

				// Detect game objects: non-plain objects that serialize lossily.
				// Allow null-prototype objects (Object.create(null)) which
				// xxscreeps APIs like Fn.fromEntries return — they're plain data.
				if (result !== null && typeof result === 'object'
					&& !Array.isArray(result)
					&& result.constructor !== Object
					&& result.constructor !== undefined) {
					throw new RunPlayerError('serialization',
						`Return value is a ${result.constructor?.name ?? 'non-plain'} object, not a plain JSON value`);
				}
				if (result !== null && typeof result === 'object') {
					try {
						JSON.stringify(result);
					} catch {
						throw new RunPlayerError('serialization', 'Return value is not JSON-serializable');
					}
				}
			});
		} catch (err) {
			if (err instanceof RunPlayerError) throw err;
			const error = err as Error;
			if (error instanceof SyntaxError) {
				throw new RunPlayerError('syntax', error.message);
			}
			throw new RunPlayerError('runtime', error.message);
		}

		if (!executed) {
			throw new Error(
				`runPlayer: task for '${userId}' was not invoked by the simulation. ` +
				`Check that engine user ID '${engineUserId}' is active.`,
			);
		}

		// Contract: runPlayer advances exactly 1 tick.
		// simulation.player() only collects intents — tick() processes them.
		await this.keepRoomsActive();
		await this.simulation!.tick(1);

		return result ?? null;
	}

	async runPlayers(codesByUser: Record<string, PlayerCode>): Promise<Record<string, PlayerReturnValue>> {
		await this.ensureSimulation();
		await this.flushPokeQueue();
		await this.keepRoomsActive();

		const results: Record<string, PlayerReturnValue> = {};
		const executedPlayers = new Set<string>();
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

			const gclRaw = await this.simulation!.shard.db.data.hget(
				`user/${engineUserId}`, 'gcl');
			const gclProgress = Number(gclRaw) || 0;

			try {
				await this.simulation!.player(engineUserId, (Game: GameConstructor) => {
					executedPlayers.add(userId);
					const trimmed = codeStr.trimEnd().replace(/;$/, '');

					if (!(Game as any).gcl) {
						(Game as any).gcl = {
							level: Math.max(ownedRoomCount + 1, 2),
							progress: gclProgress, progressTotal: 1,
							'#roomCount': ownedRoomCount,
						};
					}
					const globals: Record<string, any> = { Game, RoomPosition, PathFinder, Room };
					Object.assign(globals, C);
					for (const name of ['Memory', 'RawMemory', 'Mineral', 'Flag',
						'Creep', 'Tombstone', 'Ruin', 'Source', 'Resource', 'Store',
						'Room', 'RoomObject', 'ConstructionSite',
						'Structure', 'OwnedStructure',
						'StructureSpawn', 'StructureExtension', 'StructureTower',
						'StructureLink', 'StructureStorage', 'StructureTerminal',
						'StructureContainer', 'StructureExtractor', 'StructureRampart',
						'StructureWall', 'StructureRoad', 'StructureController',
						'StructureLab', 'StructureObserver', 'StructureFactory',
						'StructureKeeperLair',
						'RoomVisual', 'MapVisual', '_',
					] as const) {
						if ((globalThis as any)[name] !== undefined) {
							globals[name] = (globalThis as any)[name];
						}
					}
					const names = Object.keys(globals);
					const values = Object.values(globals);
					const fn = new Function(...names, `return eval(${JSON.stringify(trimmed)})`);
					results[userId] = fn(...values) as PlayerReturnValue;

					const val = results[userId];
					if (val !== null && typeof val === 'object'
						&& !Array.isArray(val)
						&& val.constructor !== Object
						&& val.constructor !== undefined) {
						throw new RunPlayerError('serialization',
							`Return value is a ${val.constructor?.name ?? 'non-plain'} object, not a plain JSON value`);
					}
					if (val !== null && typeof val === 'object') {
						try { JSON.stringify(val); }
						catch { throw new RunPlayerError('serialization', 'Return value is not JSON-serializable'); }
					}
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

		// Execution confirmation
		for (const handle of Object.keys(codesByUser)) {
			if (!executedPlayers.has(handle)) {
				throw new Error(
					`runPlayers: task for '${handle}' was not invoked by the simulation.`,
				);
			}
		}

		// Phase 2: process all collected intents in a single tick.
		await this.keepRoomsActive();
		await this.simulation!.tick(1);

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
	}

	private async flushDeferredFlags(): Promise<void> {
		if (this.deferredFlagOps.length === 0) return;
		// Flags live in per-user blobs, not room objects. Create them via
		// player code after the simulation is running and game state is
		// initialized. Must tick after creation so the flag blob is persisted.
		for (const op of this.deferredFlagOps) {
			await op();
		}
		this.deferredFlagOps.length = 0;
		await this.simulation!.tick(1);
	}

	async getObject(id: string): Promise<ObjectSnapshot | null> {
		await this.ensureSimulation();
		await this.flushPokeQueue();
		const engineId = this.resolveId(id);
		for (const roomName of this.rooms) {
			const snapshot = await this.simulation!.peekRoom(roomName, (room: any) => {
				for (const obj of room['#objects']) {
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
			for (const obj of room['#objects']) {
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
		this.idMap.clear();
		this.nameToSyntheticId.clear();
		this.posToSyntheticId.clear();
		this.idCounter = 0;
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
		case 'terminal': return createTerminal(pos, owner!);
		case 'factory':
			if (!createFactory) throw new Error('factory mod not available in this xxscreeps build');
			return createFactory(pos, owner!);
		case 'extractor': return createExtractor(pos, owner!);
		default: throw new Error(`Unsupported structure type: ${structureType}`);
	}
}

function setStoreContentsExact(store: any, desired: Record<string, number>): void {
	const entries = typeof store?.['#entries'] === 'function'
		? [...store['#entries']()]
		: Object.entries(store ?? {});
	for (const [resource, amount] of entries) {
		if (typeof amount === 'number' && amount > 0) {
			store['#subtract'](resource, amount);
		}
	}
	for (const [resource, amount] of Object.entries(desired)) {
		if (amount > 0) {
			store['#add'](resource, amount);
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
	const { db, shard } = await instantiateTestShard();

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

			async player(userId: string, task: (game: GameConstructor) => void): Promise<void> {
				assert(!playersThisTick.has(userId), `player '${userId}' already invoked this tick`);
				playersThisTick.add(userId);

				const [intentRooms, visibleRooms] = await Promise.all([
					shard.scratch.smembers(userToIntentRoomsSetKey(userId)),
					shard.scratch.smembers(userToVisibleRoomsSetKey(userId)),
				]);
				const rooms = await Promise.all(Fn.map(visibleRooms, (rn: string) => shard.loadRoom(rn)));
				const state = new GameState(world, shard.time, rooms);
				const [intents] = runForUser(userId, state, task);

				for (const roomName of intentRooms) {
					const roomIntents = intents.getIntentsForRoom(roomName);
					if (roomIntents) {
						getOrSet(intentsByRoom, roomName, () => []).push({ userId, intents: roomIntents });
					}
				}
			},

			async tick(count = 1, players: Record<string, (game: GameConstructor) => void> = {}): Promise<void> {
				for (let ii = 0; ii < count; ++ii) {
					for (const [userId, task] of Object.entries(players)) {
						await sim.player(userId, task);
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
						const room = roomInstances.get(roomName) ?? await shard.loadRoom(roomName);
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
			async dispose() {
				shard.disconnect();
				db.disconnect();
			},
		};
	} catch (err) {
		shard.disconnect();
		db.disconnect();
		throw err;
	}
}

export async function createAdapter(): Promise<ScreepsOkAdapter> {
	return new XxscreepsAdapter();
}
