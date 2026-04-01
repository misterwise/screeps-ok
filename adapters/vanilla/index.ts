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
	private pendingCode = new Map<string, string>(); // player handle → code to run

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

		for (const roomSpec of spec.rooms) {
			await this.server.world.addRoom(roomSpec.name);
			await this.server.world.setTerrain(roomSpec.name,
				roomSpec.terrain ? this.buildTerrain(roomSpec.terrain) : new TerrainMatrix());
			await this.server.world.addRoomObject(roomSpec.name, 'controller', 1, 1, {
				level: roomSpec.rcl ?? 0,
			});
		}

		for (let i = 0; i < spec.players.length; i++) {
			const handle = spec.players[i];
			const username = playerSlots[i] ?? `player_${i}`;
			const ownedRoom = spec.rooms.find(r => r.owner === handle);
			const roomName = ownedRoom?.name ?? spec.rooms[0].name;

			// Bot code: check for pending code in Memory._screepsOk, execute it,
			// store the result back in Memory._screepsOkResult
			const bot = await this.server.world.addBot({
				username,
				room: roomName,
				x: 25,
				y: 25,
				modules: {
					main: `module.exports.loop = function() {
						if (Memory._screepsOk) {
							try {
								const result = eval(Memory._screepsOk);
								Memory._screepsOkResult = JSON.stringify({ ok: true, value: result });
							} catch (e) {
								Memory._screepsOkResult = JSON.stringify({ ok: false, error: e.message });
							}
							delete Memory._screepsOk;
						}
					}`,
				},
			});

			this.playerMap.set(handle, bot.id);
			this.reversePlayerMap.set(bot.id, handle);
			this.users.set(handle, bot);

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

		const body = spec.body.map(type => ({ type, hits: 100 }));
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
			storeCapacity: body.reduce((sum: number, p: any) =>
				sum + (p.type === 'carry' ? 50 : 0), 0),
			ticksToLive: spec.ticksToLive ?? 1500,
			ageTime: (spec.ticksToLive ?? 1500) + 1,
		});

		return result._id;
	}

	async placeStructure(roomName: string, spec: StructureSpec): Promise<string> {
		const userId = spec.owner ? this.resolvePlayer(spec.owner) : undefined;
		const attrs: Record<string, any> = {};
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
		const result = await this.server.world.addRoomObject(
			roomName, 'source', spec.pos[0], spec.pos[1], {
				energy: spec.energy ?? spec.energyCapacity ?? 3000,
				energyCapacity: spec.energyCapacity ?? 3000,
				ticksToRegeneration: spec.ticksToRegeneration ?? 0,
			});
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

		// Inject the code into the player's Memory so the main loop picks it up
		const codeStr = String(playerCode).trimEnd().replace(/;$/, '');
		const botId = this.resolvePlayer(handle);

		// Read current memory, inject the code
		const memRaw = await this.env.get(this.env.keys.MEMORY + botId) || '{}';
		const mem = JSON.parse(memRaw);
		mem._screepsOk = codeStr;
		delete mem._screepsOkResult;
		await this.env.set(this.env.keys.MEMORY + botId, JSON.stringify(mem));

		// Tick to execute — main loop reads Memory._screepsOk, evals it,
		// writes result to Memory._screepsOkResult
		await this.server.tick();
		this.ranPlayerTick = true;

		// Read the result from memory
		const memAfter = JSON.parse(
			await this.env.get(this.env.keys.MEMORY + botId) || '{}');
		const resultJson = memAfter._screepsOkResult;

		if (!resultJson) {
			// No result — code may not have run (user might not be active?)
			return null;
		}

		const parsed = JSON.parse(resultJson);
		if (!parsed.ok) {
			throw new RunPlayerError('runtime', parsed.error);
		}

		return parsed.value ?? null;
	}

	// Track whether runPlayer already ran a tick this turn
	private ranPlayerTick = false;

	async tick(count = 1): Promise<void> {
		// runPlayer already ran one tick, so skip the first
		const start = this.ranPlayerTick ? 1 : 0;
		this.ranPlayerTick = false;
		for (let i = start; i < count; i++) {
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
		this.pendingCode.clear();
		this.rooms = [];
		this.db = null;
		this.env = null;
		this.idCounter = 0;
		this.ranPlayerTick = false;
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
}

export async function createAdapter(): Promise<ScreepsOkAdapter> {
	return new VanillaAdapter();
}
