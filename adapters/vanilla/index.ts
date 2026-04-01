import type {
	ScreepsOkAdapter, AdapterCapabilities, ShardSpec, PlayerReturnValue,
	CreepSpec, StructureSpec, SiteSpec, SourceSpec, MineralSpec,
	FlagSpec, TombstoneSpec, RuinSpec, DroppedResourceSpec, TerrainSpec,
} from '../../src/adapter.js';
import type { ObjectSnapshot } from '../../src/snapshots/common.js';
import type { PlayerCode } from '../../src/code.js';
import { RunPlayerError } from '../../src/errors.js';
import { snapshotObject, snapshotRoomObjects } from './snapshots.js';

// @ts-expect-error -- screeps-server-mockup has no type declarations
import { ScreepsServer, TerrainMatrix } from 'screeps-server-mockup';

// Shared server instance (reused across tests in the same file)
let sharedServer: any = null;

async function getServer(): Promise<any> {
	if (!sharedServer) {
		sharedServer = new ScreepsServer();
		await sharedServer.world.reset();
		await sharedServer.start();
	}
	return sharedServer;
}

const playerSlots = ['p1_user', 'p2_user', 'p3_user', 'p4_user'];

class VanillaAdapter implements ScreepsOkAdapter {
	readonly capabilities: AdapterCapabilities = {
		chemistry: true,
		powerCreeps: true,
		factory: true,
		market: true,
		observer: true,
		nuke: true,
	};

	private server: any = null;
	private playerMap = new Map<string, string>();   // handle → db user _id
	private reversePlayerMap = new Map<string, string>();
	private users = new Map<string, any>();           // handle → User instance
	private rooms: string[] = [];
	private idCounter = 0;
	private db: any = null;

	private nextId(): string {
		return `sok${++this.idCounter}`;
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
		this.server = await getServer();
		await this.server.world.reset();
		this.db = this.server.common.storage.db;

		this.rooms = spec.rooms.map(r => r.name);

		// Create rooms with terrain
		for (const roomSpec of spec.rooms) {
			await this.server.world.addRoom(roomSpec.name);

			if (roomSpec.terrain) {
				const matrix = new TerrainMatrix();
				for (let i = 0; i < roomSpec.terrain.length && i < 2500; i++) {
					const x = i % 50;
					const y = Math.floor(i / 50);
					const val = roomSpec.terrain[i];
					if (val === 1) matrix.set(x, y, 'wall');
					else if (val === 2) matrix.set(x, y, 'swamp');
				}
				await this.server.world.setTerrain(roomSpec.name, matrix);
			} else {
				await this.server.world.setTerrain(roomSpec.name, new TerrainMatrix());
			}

			// Every room needs a controller for the engine to process it
			await this.server.world.addRoomObject(roomSpec.name, 'controller', 1, 1, {
				level: roomSpec.rcl ?? 0,
			});
		}

		// Create players
		for (let i = 0; i < spec.players.length; i++) {
			const handle = spec.players[i];
			const username = playerSlots[i] ?? `player_${i}`;

			// Find a room owned by this player for addBot, or use first room
			const ownedRoom = spec.rooms.find(r => r.owner === handle);
			const roomName = ownedRoom?.name ?? spec.rooms[0].name;

			const bot = await this.server.world.addBot({
				username,
				room: roomName,
				x: 25,
				y: 25,
				modules: {
					main: `module.exports.loop = function() {
						if (global.__screepsOkCode) {
							const fn = new Function('Game', global.__screepsOkCode);
							global.__screepsOkResult = fn(Game);
							global.__screepsOkCode = null;
						}
					}`,
				},
			});

			this.playerMap.set(handle, bot.id);
			this.reversePlayerMap.set(bot.id, handle);
			this.users.set(handle, bot);

			// If the room has an RCL > 1, update the controller
			if (ownedRoom && ownedRoom.rcl && ownedRoom.rcl > 1) {
				await this.db['rooms.objects'].update(
					{ $and: [{ room: roomName }, { type: 'controller' }] },
					{ $set: { level: ownedRoom.rcl } },
				);
			}
		}
	}

	async placeCreep(roomName: string, spec: CreepSpec): Promise<string> {
		const userId = this.resolvePlayer(spec.owner);
		const name = spec.name ?? `creep-${this.nextId()}`;

		const body = spec.body.map(type => ({
			type,
			hits: 100,
		}));

		const attrs: Record<string, any> = {
			user: userId,
			name,
			body,
			hits: body.length * 100,
			hitsMax: body.length * 100,
			fatigue: 0,
			spawning: false,
			store: spec.store ?? {},
			storeCapacity: body.reduce((sum: number, p: any) => {
				return sum + (p.type === 'carry' ? 50 : 0);
			}, 0),
			ticksToLive: spec.ticksToLive ?? 1500,
			ageTime: (spec.ticksToLive ?? 1500) + 1,
		};

		const result = await this.db['rooms.objects'].insert({
			room: roomName,
			type: 'creep',
			x: spec.pos[0],
			y: spec.pos[1],
			...attrs,
		});

		return result._id ?? result.id ?? name;
	}

	async placeStructure(roomName: string, spec: StructureSpec): Promise<string> {
		const userId = spec.owner ? this.resolvePlayer(spec.owner) : undefined;

		const attrs: Record<string, any> = {};
		if (userId) attrs.user = userId;
		if (spec.hits !== undefined) attrs.hits = spec.hits;
		if (spec.store) attrs.store = spec.store;

		const result = await this.server.world.addRoomObject(
			roomName,
			spec.structureType,
			spec.pos[0],
			spec.pos[1],
			attrs,
		);

		return result._id ?? result.id;
	}

	async placeSite(roomName: string, spec: SiteSpec): Promise<string> {
		const userId = this.resolvePlayer(spec.owner);

		const result = await this.db['rooms.objects'].insert({
			room: roomName,
			type: 'constructionSite',
			x: spec.pos[0],
			y: spec.pos[1],
			user: userId,
			structureType: spec.structureType,
			progress: spec.progress ?? 0,
			progressTotal: this.getProgressTotal(spec.structureType),
		});

		return result._id ?? result.id;
	}

	async placeSource(roomName: string, spec: SourceSpec): Promise<string> {
		const result = await this.server.world.addRoomObject(
			roomName, 'source', spec.pos[0], spec.pos[1], {
				energy: spec.energy ?? spec.energyCapacity ?? 3000,
				energyCapacity: spec.energyCapacity ?? 3000,
				ticksToRegeneration: spec.ticksToRegeneration ?? 0,
			},
		);
		return result._id ?? result.id;
	}

	async placeMineral(roomName: string, spec: MineralSpec): Promise<string> {
		const result = await this.server.world.addRoomObject(
			roomName, 'mineral', spec.pos[0], spec.pos[1], {
				mineralType: spec.mineralType,
				mineralAmount: spec.mineralAmount ?? 100000,
				density: 3,
			},
		);
		return result._id ?? result.id;
	}

	async placeFlag(_roomName: string, _spec: FlagSpec): Promise<string> {
		throw new Error('placeFlag not yet implemented');
	}

	async placeTombstone(_roomName: string, _spec: TombstoneSpec): Promise<string> {
		throw new Error('placeTombstone not yet implemented');
	}

	async placeRuin(_roomName: string, _spec: RuinSpec): Promise<string> {
		throw new Error('placeRuin not yet implemented');
	}

	async placeDroppedResource(_roomName: string, _spec: DroppedResourceSpec): Promise<string> {
		throw new Error('placeDroppedResource not yet implemented');
	}

	async placeObject(_room: string, _type: string, _spec: Record<string, unknown>): Promise<string> {
		throw new Error('generic placeObject not yet implemented');
	}

	async setTerrain(room: string, terrain: TerrainSpec): Promise<void> {
		const matrix = new TerrainMatrix();
		for (let i = 0; i < terrain.length && i < 2500; i++) {
			const x = i % 50;
			const y = Math.floor(i / 50);
			if (terrain[i] === 1) matrix.set(x, y, 'wall');
			else if (terrain[i] === 2) matrix.set(x, y, 'swamp');
		}
		await this.server.world.setTerrain(room, matrix);
	}

	async runPlayer(userId: string, playerCode: PlayerCode): Promise<PlayerReturnValue> {
		const handle = userId;
		const user = this.users.get(handle);
		if (!user) throw new Error(`Unknown player: ${handle}`);

		// Inject code via console command that sets a global
		// The bot's main loop checks for it and executes it
		const codeStr = String(playerCode).trimEnd().replace(/;$/, '');
		const escaped = JSON.stringify(codeStr);
		await user.console(`global.__screepsOkCode = ${escaped}`);

		// Tick to execute the code
		// Note: the console command runs, then the main loop sees __screepsOkCode
		// We need two ticks: one to set the global, one to execute it
		// Actually the console command executes within the tick's user phase,
		// and main loop also runs in the same tick. Let's try one tick first.

		return null; // Return value retrieval is complex with vanilla - defer for now
	}

	async tick(count = 1): Promise<void> {
		for (let i = 0; i < count; i++) {
			await this.server.tick();
		}
	}

	async getObject(id: string): Promise<ObjectSnapshot | null> {
		const obj = await this.db['rooms.objects'].findOne({ _id: id });
		if (!obj) return null;
		return snapshotObject(obj, this);
	}

	async findInRoom(roomName: string, type: string): Promise<any[]> {
		const objects = await this.server.world.roomObjects(roomName);
		return snapshotRoomObjects(objects, type, this);
	}

	async getGameTime(): Promise<number> {
		return this.server.world.gameTime;
	}

	async teardown(): Promise<void> {
		// Don't stop the server — it's shared across tests in the file.
		// Just clear our state.
		this.playerMap.clear();
		this.reversePlayerMap.clear();
		this.users.clear();
		this.rooms = [];
		this.db = null;
		this.idCounter = 0;
	}

	private getProgressTotal(structureType: string): number {
		const C = this.server.constants;
		return C.CONSTRUCTION_COST?.[structureType.toUpperCase()] ?? 300;
	}
}

export async function createAdapter(): Promise<ScreepsOkAdapter> {
	return new VanillaAdapter();
}
