import type { GameConstructor } from 'xxscreeps/game/index.js';
import type { Room } from 'xxscreeps/game/room/index.js';
import type {
	ScreepsOkAdapter, AdapterCapabilities, ShardSpec, PlayerReturnValue,
	CreepSpec, StructureSpec, SiteSpec, SourceSpec, MineralSpec,
	FlagSpec, TombstoneSpec, RuinSpec, DroppedResourceSpec, TerrainSpec,
} from '../../src/adapter.js';
import type { ObjectSnapshot } from '../../src/snapshots/common.js';
import type { PlayerCode } from '../../src/code.js';
import { RunPlayerError } from '../../src/errors.js';
import { RoomPosition } from 'xxscreeps/game/position.js';
import { search as pfSearch, CostMatrix } from 'xxscreeps/game/path-finder/index.js';
import * as C from 'xxscreeps/game/constants/index.js';

// Build synthetic PathFinder object matching the Screeps global API
const PathFinder = { search: pfSearch, CostMatrix };
import { simulate } from 'xxscreeps/test/simulate.js';
import { snapshotObject, snapshotRoom, getStructureType } from './snapshots.js';

// Object creation imports
import { create as createCreep } from 'xxscreeps/mods/creep/creep.js';
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
		factory: true,
		market: false,
		observer: true,
		nuke: false,
		terrain: false,
	};

	private playerMap = new Map<string, string>();
	private reversePlayerMap = new Map<string, string>();
	private pendingSetup = new Map<string, Array<(room: Room) => void>>();
	private rooms: string[] = [];
	private simulation: Awaited<ReturnType<typeof createSimulation>> | null = null;
	private shardSpec: ShardSpec | null = null;
	private idCounter = 0;

	private nextId(): string {
		return `screeps-ok-${++this.idCounter}`;
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
			this.playerMap.set(spec.players[i], playerSlots[i]);
			this.reversePlayerMap.set(playerSlots[i], spec.players[i]);
		}

		for (const roomSpec of spec.rooms) {
			if (roomSpec.owner || roomSpec.rcl) {
				const owner = roomSpec.owner ? this.resolvePlayer(roomSpec.owner) : undefined;
				const rcl = roomSpec.rcl ?? (roomSpec.owner ? 1 : 0);
				this.queueOp(roomSpec.name, room => {
					if (rcl > 0 && owner) {
						room['#level'] = rcl;
						room['#user'] = room.controller!['#user'] = owner;
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
			if (spec.ticksToLive !== undefined) {
				creep['#ageTime'] = spec.ticksToLive + 1;
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
			const structure = buildStructure(spec.structureType, pos, userId);
			structure.id = id;
			if (spec.hits !== undefined) {
				structure.hits = spec.hits;
			}
			if (spec.store) {
				for (const [resource, amount] of Object.entries(spec.store)) {
					structure.store['#add'](resource, amount);
				}
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
				source['#nextRegenerationTime'] = 1 + spec.ticksToRegeneration; // game starts at tick 1
			} else if (source.energy < source.energyCapacity) {
				source['#nextRegenerationTime'] = 1 + 300; // ENERGY_REGEN_TIME
			}
			room['#insertObject'](source);
		});

		return id;
	}

	async placeMineral(roomName: string, spec: MineralSpec): Promise<string> {
		const id = this.nextId();
		this.posToSyntheticId.set(`${roomName}:${spec.pos[0]}:${spec.pos[1]}:mineral`, id);

		this.queueOp(roomName, room => {
			const mineral = new Mineral();
			mineral.id = id;
			mineral.pos = new RoomPosition(spec.pos[0], spec.pos[1], roomName);
			mineral['#posId'] = mineral.pos['#id'];
			mineral.mineralType = spec.mineralType as any;
			mineral.mineralAmount = spec.mineralAmount ?? 100000;
			room['#insertObject'](mineral);
		});

		return id;
	}

	async placeFlag(roomName: string, spec: FlagSpec): Promise<string> {
		const name = spec.name;
		this.nameToSyntheticId.set(name, name); // flags use name as ID

		this.queueOp(roomName, room => {
			const pos = new RoomPosition(spec.pos[0], spec.pos[1], roomName);
			const flag = createFlag(
				name,
				pos['#id'],
				(spec.color ?? 1) as any,
				(spec.secondaryColor ?? spec.color ?? 1) as any,
			);
			room['#insertObject'](flag);
		});

		return name;
	}

	async placeTombstone(roomName: string, spec: TombstoneSpec): Promise<string> {
		const id = this.nextId();
		this.posToSyntheticId.set(`${roomName}:${spec.pos[0]}:${spec.pos[1]}:tombstone`, id);

		this.queueOp(roomName, room => {
			// Create a minimal tombstone-like object directly
			const tombstone: any = Object.create(null);
			tombstone.id = id;
			tombstone.pos = new RoomPosition(spec.pos[0], spec.pos[1], roomName);
			tombstone['#posId'] = tombstone.pos['#id'];
			tombstone.deathTime = spec.deathTime ?? 0;
			tombstone.ticksToDecay = spec.ticksToDecay ?? 500;
			tombstone.creepName = spec.creepName;
			// Store as plain object — tombstone stores are read-only
			tombstone.store = {};
			if (spec.store) {
				for (const [resource, amount] of Object.entries(spec.store)) {
					tombstone.store[resource] = amount;
				}
			}
			room['#insertObject'](tombstone);
		});

		return id;
	}

	async placeRuin(roomName: string, spec: RuinSpec): Promise<string> {
		const id = this.nextId();
		this.posToSyntheticId.set(`${roomName}:${spec.pos[0]}:${spec.pos[1]}:ruin`, id);

		this.queueOp(roomName, room => {
			const ruin: any = Object.create(null);
			ruin.id = id;
			ruin.pos = new RoomPosition(spec.pos[0], spec.pos[1], roomName);
			ruin['#posId'] = ruin.pos['#id'];
			ruin.structureType = spec.structureType;
			ruin.destroyTime = spec.destroyTime ?? 0;
			ruin.ticksToDecay = spec.ticksToDecay ?? 500;
			ruin.store = {};
			if (spec.store) {
				for (const [resource, amount] of Object.entries(spec.store)) {
					ruin.store[resource] = amount;
				}
			}
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

	async placeObject(_room: string, _type: string, _spec: Record<string, unknown>): Promise<string> {
		throw new Error('generic placeObject not yet implemented — use typed helpers');
	}

	async setTerrain(_room: string, _terrain: TerrainSpec): Promise<void> {
		// xxscreeps terrain is baked into the shard.json world data at simulation creation.
		// Modifying it post-creation requires TerrainWriter which isn't exposed via simulate().
		throw new Error('setTerrain not supported on xxscreeps adapter — use RoomSpec.terrain in createShard');
	}

	// Map our synthetic IDs → engine-generated IDs (populated during setup flush)
	private idMap = new Map<string, string>();

	private async ensureSimulation(): Promise<void> {
		if (this.simulation) return;
		if (!this.shardSpec) throw new Error('createShard not called');

		const idMap = this.idMap;
		const roomInits: Record<string, (room: any) => void> = {};
		for (const roomName of this.rooms) {
			const ops = this.pendingSetup.get(roomName);
			roomInits[roomName] = (room: any) => {
				// Strip shard.json sources and minerals — tests place their own
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
		}

		this.simulation = await createSimulation(roomInits);
		this.pendingSetup.clear();

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
						const keys = [
							`${roomName}:${x}:${y}:${obj.structureType}`,
							`${roomName}:${x}:${y}:${obj.constructor?.name}`,
							`${roomName}:${x}:${y}:constructionSite`,
							`${roomName}:${x}:${y}:source`,
							`${roomName}:${x}:${y}:mineral`,
						];
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
		const engineUserId = this.resolvePlayer(userId);
		let result: PlayerReturnValue = null;

		// Replace synthetic IDs with engine IDs in the code string
		let codeStr = String(playerCode);
		for (const [syntheticId, engineId] of this.idMap) {
			codeStr = codeStr.replaceAll(JSON.stringify(syntheticId), JSON.stringify(engineId));
		}

		try {
			await this.simulation!.player(engineUserId, (Game: GameConstructor) => {
				// Build a context with Game + all Screeps constants + globals
				const trimmed = codeStr.trimEnd().replace(/;$/, '');

				// Collect all available globals from the game environment
				const globals: Record<string, any> = { Game, RoomPosition, PathFinder };
				// Add all constants (TOP, WORK, FIND_MY_CREEPS, etc.)
				Object.assign(globals, C);

				const names = Object.keys(globals);
				const values = Object.values(globals);
				const fn = new Function(...names,
					`return eval(${JSON.stringify(trimmed)})`);
				result = fn(...values) as PlayerReturnValue;

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

		return result;
	}

	async tick(count = 1): Promise<void> {
		await this.ensureSimulation();
		await this.flushPokeQueue();
		await this.simulation!.tick(count);
	}

	async getObject(id: string): Promise<ObjectSnapshot | null> {
		await this.ensureSimulation();
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

	async findInRoom(roomName: string, type: string): Promise<any[]> {
		await this.ensureSimulation();
		return this.simulation!.peekRoom(roomName, (room: any) => {
			return snapshotRoom(room, type, this);
		});
	}

	async getGameTime(): Promise<number> {
		await this.ensureSimulation();
		return this.simulation!.shard.time;
	}

	async getControllerPos(roomName: string): Promise<{ x: number; y: number } | null> {
		await this.ensureSimulation();
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
		this.playerMap.clear();
		this.reversePlayerMap.clear();
		this.idMap.clear();
		this.nameToSyntheticId.clear();
		this.posToSyntheticId.clear();
		this.idCounter = 0;
	}
}

function buildStructure(structureType: string, pos: any, owner?: string): any {
	switch (structureType) {
		case 'spawn': return createSpawn(pos, owner!, `Spawn-${pos.x}-${pos.y}`);
		case 'extension': return createExtension(pos, 8, owner!);
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

async function createSimulation(roomInits: Record<string, (room: Room) => void>) {
	let refs: any = null;
	let resolveBody!: () => void;
	const bodyPromise = new Promise<void>(resolve => { resolveBody = resolve; });

	const factory = simulate(roomInits);
	const simPromise = factory(async simulation => {
		refs = simulation;
		await bodyPromise;
	});

	// Wait for refs to be assigned (simulate runs init synchronously)
	await new Promise<void>(resolve => {
		const check = () => refs ? resolve() : setTimeout(check, 1);
		check();
	});

	return {
		...refs! as { db: any; shard: any; world: any; player: any; poke: any; tick: any; peekRoom: any },
		async dispose() {
			resolveBody();
			await simPromise;
		},
	};
}

export async function createAdapter(): Promise<ScreepsOkAdapter> {
	return new XxscreepsAdapter();
}
