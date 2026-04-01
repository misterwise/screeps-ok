import type { GameConstructor } from 'xxscreeps/game/index.js';
import type { Room } from 'xxscreeps/game/room/index.js';
import type {
	ScreepsOkAdapter, AdapterCapabilities, ShardSpec, PlayerReturnValue,
	CreepSpec, StructureSpec, SiteSpec, SourceSpec, MineralSpec,
	FlagSpec, TombstoneSpec, RuinSpec, DroppedResourceSpec, TerrainSpec,
} from '../../src/adapter.js';
import type { ObjectSnapshot, CreepSnapshot, StructureSnapshot, SiteSnapshot,
	SourceSnapshot, MineralSnapshot, TombstoneSnapshot, RuinSnapshot,
	DroppedResourceSnapshot,
} from '../../src/snapshots/common.js';
import type { PlayerCode } from '../../src/code.js';
import { RunPlayerError } from '../../src/errors.js';
import { RoomPosition } from 'xxscreeps/game/position.js';
import * as C from 'xxscreeps/game/constants/index.js';
import { importMods } from 'xxscreeps/config/mods/index.js';
import { initializeIntentConstraints } from 'xxscreeps/engine/processor/index.js';
import { initializeGameEnvironment } from 'xxscreeps/game/index.js';
import { simulate } from 'xxscreeps/test/simulate.js';
import { snapshotObject, snapshotRoom } from './snapshots.js';

// Module-level initialization (runs once)
await importMods('processor');
initializeGameEnvironment();
initializeIntentConstraints();

// Player handle → xxscreeps user ID
const playerSlots = ['100', '101', '102', '103'];

interface PendingOp {
	fn: (room: Room) => void;
	idRef?: { id: string };
}

class XxscreepsAdapter implements ScreepsOkAdapter {
	readonly capabilities: AdapterCapabilities = {
		chemistry: true,
		powerCreeps: false,
		factory: true,
		market: false,
		observer: true,
		nuke: false,
	};

	private playerMap = new Map<string, string>();
	private reversePlayerMap = new Map<string, string>();
	private pendingSetup = new Map<string, PendingOp[]>();
	private rooms: string[] = [];
	private simulation: Awaited<ReturnType<typeof createSimulation>> | null = null;
	private shardSpec: ShardSpec | null = null;
	private setupFlushed = false;
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

	async createShard(spec: ShardSpec): Promise<void> {
		this.shardSpec = spec;
		this.rooms = spec.rooms.map(r => r.name);

		// Map player handles to xxscreeps user IDs
		for (let i = 0; i < spec.players.length; i++) {
			if (i >= playerSlots.length) throw new Error(`Max ${playerSlots.length} players`);
			this.playerMap.set(spec.players[i], playerSlots[i]);
			this.reversePlayerMap.set(playerSlots[i], spec.players[i]);
		}

		// Queue room ownership setup
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

	private queueOp(room: string, fn: (room: Room) => void, idRef?: { id: string }): void {
		let ops = this.pendingSetup.get(room);
		if (!ops) {
			ops = [];
			this.pendingSetup.set(room, ops);
		}
		ops.push({ fn, idRef });
	}

	async placeCreep(roomName: string, spec: CreepSpec): Promise<string> {
		const id = this.nextId();
		const userId = this.resolvePlayer(spec.owner);
		const name = spec.name ?? `creep-${id}`;
		const ref = { id };

		this.queueOp(roomName, room => {
			// Dynamic import at queue time is too late; we import at module top
			// The create function must be imported from the creep module
			const { create } = require('xxscreeps/mods/creep/creep.js');
			const creep = create(
				new RoomPosition(spec.pos[0], spec.pos[1], roomName),
				spec.body,
				name,
				userId,
			);
			// Override the generated ID with our stable one
			creep.id = ref.id;
			if (spec.ticksToLive !== undefined) {
				creep['#ageTime'] = (spec.ticksToLive) + 1; // xxscreeps uses ageTime
			}
			if (spec.store) {
				for (const [resource, amount] of Object.entries(spec.store)) {
					creep.store['#add'](resource, amount);
				}
			}
			room['#insertObject'](creep);
		}, ref);

		return id;
	}

	async placeStructure(roomName: string, spec: StructureSpec): Promise<string> {
		const id = this.nextId();
		const userId = spec.owner ? this.resolvePlayer(spec.owner) : undefined;
		const ref = { id };

		this.queueOp(roomName, room => {
			// Structure creation varies by type — use a factory approach
			const structure = createStructure(
				spec.structureType,
				new RoomPosition(spec.pos[0], spec.pos[1], roomName),
				userId,
			);
			structure.id = ref.id;
			if (spec.hits !== undefined) {
				structure.hits = spec.hits;
			}
			if (spec.store) {
				for (const [resource, amount] of Object.entries(spec.store)) {
					structure.store['#add'](resource, amount);
				}
			}
			room['#insertObject'](structure);
		}, ref);

		return id;
	}

	async placeSite(roomName: string, spec: SiteSpec): Promise<string> {
		const id = this.nextId();
		const userId = this.resolvePlayer(spec.owner);
		const ref = { id };

		this.queueOp(roomName, room => {
			const { create } = require('xxscreeps/mods/construction/construction-site.js');
			const site = create(
				new RoomPosition(spec.pos[0], spec.pos[1], roomName),
				spec.structureType,
				userId,
			);
			site.id = ref.id;
			if (spec.progress !== undefined) {
				site.progress = spec.progress;
			}
			room['#insertObject'](site);
		}, ref);

		return id;
	}

	async placeSource(roomName: string, spec: SourceSpec): Promise<string> {
		const id = this.nextId();
		const ref = { id };

		this.queueOp(roomName, room => {
			const { Source } = require('xxscreeps/mods/source/source.js');
			const source = new Source();
			source.id = ref.id;
			source.pos = new RoomPosition(spec.pos[0], spec.pos[1], roomName);
			source['#posId'] = source.pos['#id'];
			source.energyCapacity = spec.energyCapacity ?? 3000;
			source.energy = spec.energy ?? source.energyCapacity;
			room['#insertObject'](source);
		}, ref);

		return id;
	}

	async placeMineral(roomName: string, spec: MineralSpec): Promise<string> {
		const id = this.nextId();
		const ref = { id };

		this.queueOp(roomName, room => {
			const { Mineral } = require('xxscreeps/mods/mineral/mineral.js');
			const mineral = new Mineral();
			mineral.id = ref.id;
			mineral.pos = new RoomPosition(spec.pos[0], spec.pos[1], roomName);
			mineral['#posId'] = mineral.pos['#id'];
			mineral.mineralType = spec.mineralType;
			mineral.mineralAmount = spec.mineralAmount ?? 100000;
			room['#insertObject'](mineral);
		}, ref);

		return id;
	}

	async placeFlag(_roomName: string, _spec: FlagSpec): Promise<string> {
		throw new Error('placeFlag not yet implemented for xxscreeps adapter');
	}

	async placeTombstone(_roomName: string, _spec: TombstoneSpec): Promise<string> {
		throw new Error('placeTombstone not yet implemented for xxscreeps adapter');
	}

	async placeRuin(_roomName: string, _spec: RuinSpec): Promise<string> {
		throw new Error('placeRuin not yet implemented for xxscreeps adapter');
	}

	async placeDroppedResource(_roomName: string, _spec: DroppedResourceSpec): Promise<string> {
		throw new Error('placeDroppedResource not yet implemented for xxscreeps adapter');
	}

	async placeObject(_room: string, _type: string, _spec: Record<string, unknown>): Promise<string> {
		throw new Error('placeObject not yet implemented for xxscreeps adapter');
	}

	async setTerrain(_room: string, _terrain: TerrainSpec): Promise<void> {
		throw new Error('setTerrain not yet implemented for xxscreeps adapter');
	}

	private async ensureSimulation(): Promise<void> {
		if (this.simulation) return;
		if (!this.shardSpec) throw new Error('createShard not called');

		// Build room init callbacks from pending setup
		const roomInits: Record<string, (room: Room) => void> = {};
		for (const roomName of this.rooms) {
			const ops = this.pendingSetup.get(roomName);
			roomInits[roomName] = room => {
				if (ops) {
					for (const op of ops) op.fn(room);
				}
			};
		}

		this.simulation = await createSimulation(roomInits);
		this.pendingSetup.clear();
		this.setupFlushed = true;
	}

	async runPlayer(userId: string, playerCode: PlayerCode): Promise<PlayerReturnValue> {
		await this.ensureSimulation();
		const engineUserId = this.resolvePlayer(userId);
		let result: PlayerReturnValue = null;

		try {
			await this.simulation!.player(engineUserId, (Game: GameConstructor) => {
				// Evaluate the code string in the game context
				// Game and all constants are available via the game module
				const fn = new Function('Game', `with({}) { return (function() { ${String(playerCode)} })(); }`);
				result = fn(Game) as PlayerReturnValue;

				// Validate return is JSON-safe
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
		await this.simulation!.tick(count);
	}

	async getObject(id: string): Promise<ObjectSnapshot | null> {
		await this.ensureSimulation();
		for (const roomName of this.rooms) {
			const snapshot = await this.simulation!.peekRoom(roomName, room => {
				for (const obj of room['#objects']) {
					if (obj.id === id) return snapshotObject(obj, this);
				}
				return null;
			});
			if (snapshot) return snapshot;
		}
		return null;
	}

	async findInRoom(roomName: string, type: string): Promise<ObjectSnapshot[]> {
		await this.ensureSimulation();
		return this.simulation!.peekRoom(roomName, room => {
			return snapshotRoom(room, type, this);
		});
	}

	async getGameTime(): Promise<number> {
		await this.ensureSimulation();
		return this.simulation!.shard.time;
	}

	async teardown(): Promise<void> {
		if (this.simulation) {
			this.simulation.shard.disconnect();
			this.simulation.db.disconnect();
			this.simulation = null;
		}
		this.pendingSetup.clear();
		this.playerMap.clear();
		this.reversePlayerMap.clear();
		this.setupFlushed = false;
		this.idCounter = 0;
	}
}

// Structure factory — maps structureType to the right create function
function createStructure(structureType: string, pos: RoomPosition, owner?: string) {
	switch (structureType) {
		case 'spawn': {
			const { create } = require('xxscreeps/mods/spawn/spawn.js');
			return create(pos, owner!, `Spawn-${pos.x}-${pos.y}`);
		}
		case 'extension': {
			const { create } = require('xxscreeps/mods/spawn/extension.js');
			return create(pos, 8, owner!);
		}
		case 'tower': {
			const { create } = require('xxscreeps/mods/defense/tower.js');
			return create(pos, owner!);
		}
		case 'lab': {
			const { create } = require('xxscreeps/mods/chemistry/lab.js');
			return create(pos, owner!);
		}
		case 'observer': {
			const { create } = require('xxscreeps/mods/observer/observer.js');
			return create(pos, owner!);
		}
		case 'storage': {
			const { create } = require('xxscreeps/mods/logistics/storage.js');
			return create(pos, owner!);
		}
		case 'link': {
			const { create } = require('xxscreeps/mods/logistics/link.js');
			return create(pos, owner!);
		}
		case 'terminal': {
			const { create } = require('xxscreeps/mods/logistics/terminal.js');
			return create(pos, owner!);
		}
		case 'container': {
			const { create } = require('xxscreeps/mods/logistics/container.js');
			return create(pos);
		}
		case 'road': {
			const { create } = require('xxscreeps/mods/road/road.js');
			return create(pos);
		}
		case 'constructedWall': {
			const { create } = require('xxscreeps/mods/defense/wall.js');
			return create(pos, owner!);
		}
		case 'rampart': {
			const { create } = require('xxscreeps/mods/defense/rampart.js');
			return create(pos, owner!);
		}
		default:
			throw new Error(`Unsupported structure type: ${structureType}`);
	}
}

// Create a simulation instance using xxscreeps simulate()
async function createSimulation(roomInits: Record<string, (room: Room) => void>) {
	let refs: {
		db: any;
		shard: any;
		world: any;
		player: any;
		poke: any;
		tick: any;
		peekRoom: any;
	} | null = null;

	const factory = simulate(roomInits);

	// We start the simulation and capture the refs, but don't resolve
	// the body promise until teardown
	let resolveBody: () => void;
	const bodyPromise = new Promise<void>(resolve => { resolveBody = resolve; });

	const simPromise = factory(async simulation => {
		refs = simulation;
		await bodyPromise;
	});

	// Wait for simulation to initialize
	// The simulate() callback runs synchronously up to the first await in body
	await new Promise<void>(resolve => {
		const check = () => {
			if (refs) resolve();
			else setTimeout(check, 1);
		};
		check();
	});

	return {
		...refs!,
		dispose() {
			resolveBody!();
			return simPromise;
		},
	};
}

export async function createAdapter(): Promise<ScreepsOkAdapter> {
	return new XxscreepsAdapter();
}
