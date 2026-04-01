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
	private playerMap = new Map<string, string>();
	private reversePlayerMap = new Map<string, string>();
	private users = new Map<string, any>();
	private rooms: string[] = [];
	private idCounter = 0;
	private db: any = null;
	private env: any = null;
	private ticksConsumed = 0;

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
		const storage = this.server.common.storage;
		this.db = storage.db;
		this.env = storage.env;

		this.rooms = spec.rooms.map(r => r.name);

		// Create rooms with terrain and controllers
		for (const roomSpec of spec.rooms) {
			await this.server.world.addRoom(roomSpec.name);
			await this.server.world.setTerrain(roomSpec.name,
				roomSpec.terrain ? this.buildTerrain(roomSpec.terrain) : new TerrainMatrix());
			await this.server.world.addRoomObject(roomSpec.name, 'controller', 1, 1, {
				level: roomSpec.rcl ?? 0,
			});
		}

		// Create players manually (no addBot — avoids phantom spawns and controller overwrites)
		const loopCode = `module.exports.loop = function() {
			if (Memory._screepsOk) {
				try {
					var result = eval(Memory._screepsOk);
					Memory._screepsOkResult = JSON.stringify({ ok: true, value: result });
				} catch (e) {
					Memory._screepsOkResult = JSON.stringify({ ok: false, error: e.message });
				}
				delete Memory._screepsOk;
			}
		}`;

		for (let i = 0; i < spec.players.length; i++) {
			const handle = spec.players[i];
			const username = playerSlots[i] ?? `player_${i}`;
			const ownedRoom = spec.rooms.find(r => r.owner === handle);
			const roomName = ownedRoom?.name ?? spec.rooms[0].name;

			// Insert user directly
			const user = await this.db.users.insert({
				username,
				cpu: 100,
				cpuAvailable: 10000,
				gcl: 1,
				active: 10000,
				badge: { type: 1, color1: '#000', color2: '#000', color3: '#000', flip: false, param: 0 },
			});

			await Promise.all([
				this.env.set(this.env.keys.MEMORY + user._id, '{}'),
				this.db['users.code'].insert({
					user: user._id,
					branch: 'default',
					modules: { main: loopCode },
					activeWorld: true,
				}),
			]);

			// Set controller ownership only for rooms this player owns
			if (ownedRoom) {
				await this.db['rooms.objects'].update(
					{ $and: [{ room: roomName }, { type: 'controller' }] },
					{ $set: {
						user: user._id,
						level: ownedRoom.rcl ?? 1,
						progress: 0,
						downgradeTime: null,
						safeMode: null,
						safeModeAvailable: 0,
						safeModeCooldown: 0,
					} },
				);
				// Mark room as active
				await this.db.rooms.update(
					{ _id: roomName },
					{ $set: { active: true } },
				);
				await this.env.sadd(this.env.keys.ACTIVE_ROOMS, [roomName]);
			}

			// Create User object for pubsub (needed for console event listening)
			// @ts-expect-error -- no type declarations
			const UserClass = (await import('screeps-server-mockup')).default?.User
				?? (await import('screeps-server-mockup/dist/src/user.js')).default;
			let userObj: any;
			try {
				userObj = new UserClass(this.server, { _id: user._id, username });
				await userObj.init();
			} catch {
				// User class might not be separately importable — store raw data
				userObj = { id: user._id, username };
			}

			this.playerMap.set(handle, user._id);
			this.reversePlayerMap.set(user._id, handle);
			this.users.set(handle, userObj);
		}
	}

	async placeCreep(roomName: string, spec: CreepSpec): Promise<string> {
		const userId = this.resolvePlayer(spec.owner);
		const name = spec.name ?? `creep-${this.nextId()}`;

		const body = spec.body.map(type => ({ type, hits: 100 }));
		const storeCapacity = body.reduce((sum: number, p: any) =>
			sum + (p.type === 'carry' ? 50 : 0), 0);

		const result = await this.db['rooms.objects'].insert({
			room: roomName,
			type: 'creep',
			x: spec.pos[0],
			y: spec.pos[1],
			user: userId,
			name,
			body,
			hits: body.length * 100,
			hitsMax: body.length * 100,
			fatigue: 0,
			spawning: false,
			store: spec.store ?? {},
			storeCapacityResource: { energy: storeCapacity },
			storeCapacity,
			ticksToLive: spec.ticksToLive ?? 1500,
			ageTime: (spec.ticksToLive ?? 1500) + 1,
			actionLog: {},
			notifyWhenAttacked: true,
		});

		// Activate room if not already active
		await this.db.rooms.update({ _id: roomName }, { $set: { active: true } });
		await this.env.sadd(this.env.keys.ACTIVE_ROOMS, [roomName]);

		return result._id;
	}

	async placeStructure(roomName: string, spec: StructureSpec): Promise<string> {
		const userId = spec.owner ? this.resolvePlayer(spec.owner) : undefined;
		const defaults = this.getStructureDefaults(spec.structureType);
		const attrs: Record<string, any> = { ...defaults };

		if (userId) attrs.user = userId;
		if (spec.hits !== undefined) attrs.hits = spec.hits;
		if (spec.store) attrs.store = spec.store;

		const result = await this.server.world.addRoomObject(
			roomName, spec.structureType, spec.pos[0], spec.pos[1], attrs);
		return result._id;
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
		return result._id;
	}

	async placeSource(roomName: string, spec: SourceSpec): Promise<string> {
		const energy = spec.energy ?? spec.energyCapacity ?? 3000;
		const capacity = spec.energyCapacity ?? 3000;
		const gameTime = await this.server.world.gameTime;

		const attrs: Record<string, any> = {
			energy,
			energyCapacity: capacity,
			ticksToRegeneration: 0,
		};

		// If source is depleted, set nextRegenerationTime
		if (spec.ticksToRegeneration !== undefined && spec.ticksToRegeneration > 0) {
			attrs.nextRegenerationTime = gameTime + spec.ticksToRegeneration;
		} else if (energy < capacity) {
			attrs.nextRegenerationTime = gameTime + 300; // ENERGY_REGEN_TIME
		}

		const result = await this.server.world.addRoomObject(
			roomName, 'source', spec.pos[0], spec.pos[1], attrs);
		return result._id;
	}

	async placeMineral(roomName: string, spec: MineralSpec): Promise<string> {
		const result = await this.server.world.addRoomObject(
			roomName, 'mineral', spec.pos[0], spec.pos[1], {
				mineralType: spec.mineralType,
				mineralAmount: spec.mineralAmount ?? 100000,
				density: 3,
			});
		return result._id;
	}

	async placeFlag(_r: string, _s: FlagSpec): Promise<string> { throw new Error('not implemented'); }
	async placeTombstone(_r: string, _s: TombstoneSpec): Promise<string> { throw new Error('not implemented'); }
	async placeRuin(_r: string, _s: RuinSpec): Promise<string> { throw new Error('not implemented'); }
	async placeDroppedResource(_r: string, _s: DroppedResourceSpec): Promise<string> { throw new Error('not implemented'); }
	async placeObject(_r: string, _t: string, _s: Record<string, unknown>): Promise<string> { throw new Error('not implemented'); }

	async setTerrain(room: string, terrain: TerrainSpec): Promise<void> {
		await this.server.world.setTerrain(room, this.buildTerrain(terrain));
	}

	async runPlayer(userId: string, playerCode: PlayerCode): Promise<PlayerReturnValue> {
		const handle = userId;
		const user = this.users.get(handle);
		if (!user) throw new Error(`Unknown player: ${handle}`);

		const codeStr = String(playerCode).trimEnd().replace(/;$/, '');
		const botId = this.resolvePlayer(handle);

		// Inject code into Memory for the bot's main loop to execute
		const memRaw = await this.env.get(this.env.keys.MEMORY + botId) || '{}';
		const mem = JSON.parse(memRaw);
		mem._screepsOk = codeStr;
		delete mem._screepsOkResult;
		await this.env.set(this.env.keys.MEMORY + botId, JSON.stringify(mem));

		// Tick to execute — the main loop evals Memory._screepsOk and stores result
		await this.server.tick();
		this.ticksConsumed++;

		// Read result from Memory
		const memAfter = JSON.parse(
			await this.env.get(this.env.keys.MEMORY + botId) || '{}');
		const resultJson = memAfter._screepsOkResult;

		if (!resultJson) {
			return null;
		}

		const parsed = JSON.parse(resultJson);
		if (!parsed.ok) {
			throw new RunPlayerError('runtime', parsed.error);
		}

		return parsed.value ?? null;
	}

	async tick(count = 1): Promise<void> {
		// Subtract ticks already consumed by runPlayer calls
		const remaining = Math.max(0, count - this.ticksConsumed);
		this.ticksConsumed = 0;
		for (let i = 0; i < remaining; i++) {
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
		this.playerMap.clear();
		this.reversePlayerMap.clear();
		this.users.clear();
		this.rooms = [];
		this.db = null;
		this.env = null;
		this.idCounter = 0;
		this.ticksConsumed = 0;
	}

	private buildTerrain(terrain: TerrainSpec): any {
		const matrix = new TerrainMatrix();
		for (let i = 0; i < terrain.length && i < 2500; i++) {
			const x = i % 50;
			const y = Math.floor(i / 50);
			if (terrain[i] === 1) matrix.set(x, y, 'wall');
			else if (terrain[i] === 2) matrix.set(x, y, 'swamp');
		}
		return matrix;
	}

	private getProgressTotal(structureType: string): number {
		const C = this.server.constants;
		return C?.CONSTRUCTION_COST?.[structureType.toUpperCase()] ?? 300;
	}

	private getStructureDefaults(structureType: string): Record<string, any> {
		const C = this.server.constants;
		switch (structureType) {
			case 'spawn': return {
				hits: C.SPAWN_HITS, hitsMax: C.SPAWN_HITS,
				store: { energy: C.SPAWN_ENERGY_START },
				storeCapacityResource: { energy: C.SPAWN_ENERGY_CAPACITY },
				storeCapacity: C.SPAWN_ENERGY_CAPACITY,
				spawning: null, name: `Spawn-${this.nextId()}`,
				notifyWhenAttacked: true,
			};
			case 'extension': return {
				hits: C.EXTENSION_HITS, hitsMax: C.EXTENSION_HITS,
				store: { energy: 0 },
				storeCapacityResource: { energy: C.EXTENSION_ENERGY_CAPACITY?.[8] ?? 200 },
			};
			case 'tower': return {
				hits: C.TOWER_HITS, hitsMax: C.TOWER_HITS,
				store: { energy: 0 },
				storeCapacityResource: { energy: C.TOWER_CAPACITY },
				storeCapacity: C.TOWER_CAPACITY,
				actionLog: { attack: null, heal: null, repair: null },
			};
			case 'storage': return {
				hits: C.STORAGE_HITS, hitsMax: C.STORAGE_HITS,
				store: {},
				storeCapacity: C.STORAGE_CAPACITY,
			};
			case 'link': return {
				hits: C.LINK_HITS, hitsMax: C.LINK_HITS_MAX,
				store: { energy: 0 },
				storeCapacityResource: { energy: C.LINK_CAPACITY },
				storeCapacity: C.LINK_CAPACITY,
				cooldown: 0,
				actionLog: { transferEnergy: null },
			};
			case 'container': return {
				hits: C.CONTAINER_HITS, hitsMax: C.CONTAINER_HITS,
				store: {},
				storeCapacity: C.CONTAINER_CAPACITY ?? 2000,
			};
			case 'road': return {
				hits: C.ROAD_HITS, hitsMax: C.ROAD_HITS,
				nextDecayTime: 0,
			};
			case 'constructedWall': return {
				hits: 1, hitsMax: C.WALL_HITS_MAX,
			};
			case 'rampart': return {
				hits: 1, hitsMax: C.RAMPART_HITS_MAX?.[8] ?? 300000000,
				isPublic: false, nextDecayTime: 0,
			};
			case 'lab': return {
				hits: C.LAB_HITS ?? 500, hitsMax: C.LAB_HITS ?? 500,
				store: { energy: 0 },
				storeCapacityResource: { energy: C.LAB_ENERGY_CAPACITY ?? 2000 },
				cooldown: 0, mineralType: null,
				actionLog: { runReaction: null },
			};
			case 'observer': return {
				hits: C.OBSERVER_HITS ?? 500, hitsMax: C.OBSERVER_HITS ?? 500,
			};
			default: return {};
		}
	}
}

export async function createAdapter(): Promise<ScreepsOkAdapter> {
	return new VanillaAdapter();
}
