import type {
	ScreepsOkAdapter, AdapterCapabilities, ShardSpec, PlayerSpec, PlayerReturnValue,
	CreepSpec, StructureSpec, SiteSpec, SourceSpec, MineralSpec,
	FlagSpec, TombstoneSpec, RuinSpec, DroppedResourceSpec,
	PowerCreepSpec, NukeSpec, MarketOrderSpec, TerrainSpec,
} from '../../src/adapter.js';
import type { ObjectSnapshot } from '../../src/snapshots/common.js';
import type { PlayerCode } from '../../src/code.js';
import { RunPlayerError } from '../../src/errors.js';
import { selectorFromFindConstant } from '../../src/find.js';
import { snapshotObject, snapshotRoomObjects } from './snapshots.js';
import { TERRAIN_FIXTURE_ROOM, TERRAIN_FIXTURE_SPEC, TERRAIN_FIXTURE_NEIGHBOR, TERRAIN_FIXTURE_NEIGHBOR_SPEC, withCornerWalls } from '../../src/terrain-fixture.js';

// @ts-expect-error -- screeps-server-mockup has no type declarations
import { ScreepsServer, TerrainMatrix } from 'screeps-server-mockup';

// Room auto-added to every vanilla createShard that doesn't already reference
// it. @screeps/driver/lib/runtime/make.js only reads env.TERRAIN_DATA on the
// first makeRuntime call and never refreshes it, so tests that need to
// observe non-plains terrain through player APIs (Room.getTerrain,
// PathFinder, moveTo pathfinding) must reference this pre-crafted fixture
// room instead of trying to mutate a per-test room's terrain. See
// src/terrain-fixture.ts for the landmark coordinates tests should use.
const PRELOAD_ROOMS: { name: string; terrain: TerrainSpec | null }[] = [
	{ name: TERRAIN_FIXTURE_ROOM, terrain: TERRAIN_FIXTURE_SPEC },
	// Blank-terrain neighbor of the fixture room so cross-room PathFinder
	// tests (e.g. maxRooms) have an adjacent room the runner's static cache
	// already knows about.
	{ name: TERRAIN_FIXTURE_NEIGHBOR, terrain: TERRAIN_FIXTURE_NEIGHBOR_SPEC },
];

function buildTerrainMatrix(terrain: TerrainSpec | null): any {
	const matrix = new TerrainMatrix();
	if (!terrain) return matrix;
	for (let i = 0; i < terrain.length && i < 2500; i++) {
		const x = i % 50;
		const y = Math.floor(i / 50);
		if (terrain[i] === 1) matrix.set(x, y, 'wall');
		else if (terrain[i] === 2) matrix.set(x, y, 'swamp');
	}
	return matrix;
}

let sharedServer: any = null;

// @screeps/driver/lib/queue.js registers a SIGTERM handler that logs
// "Got SIGTERM, disabling queue fetching" before calling process.exit(0).
// The log clutters vitest output when the worker is torn down. Removing
// the listener is safe: SIGTERM still terminates the process by Node's
// default behavior, and the driver's other cleanup paths handle state.
function silenceDriverSigtermLog(): void {
	for (const listener of process.listeners('SIGTERM')) {
		if (listener.toString().includes('disabling queue fetching')) {
			process.removeListener('SIGTERM', listener);
		}
	}
}

async function getServer(): Promise<any> {
	if (!sharedServer) {
		sharedServer = new ScreepsServer();
		silenceDriverSigtermLog();
		await sharedServer.world.reset();
		await sharedServer.start();
	}
	return sharedServer;
}

const playerSlots = ['p1_user', 'p2_user', 'p3_user', 'p4_user'];

// Reserved NPC handles that resolve to short engine user IDs independent of
// spec.players. The only player-observable effect we rely on today is the
// `dropRate=0` branch in `_die.js:39`, which suicide.js:15 triggers when
// `object.user == '2'` — seeding this handle lets tests hit the rate=0
// tombstone path (CREEP-DEATH-011). Vanilla's mockup pre-inserts both '2'
// (Invader) and '3' (Source Keeper) into `db.users` during `world.reset()`,
// so no additional user record is needed.
const NPC_HANDLES: Record<string, string> = {
	sk: '2',
};

// Structure types the engine always attributes to a user. Omitting `owner`
// in placeStructure for these produces a cryptic engine-internal crash
// downstream, so reject at the boundary.
const STRUCTURE_TYPES_UNOWNED = new Set(['container', 'road', 'constructedWall']);
const STRUCTURE_TYPES_REQUIRING_OWNER = new Set([
	'spawn', 'extension', 'tower', 'lab', 'link', 'storage', 'terminal',
	'factory', 'observer', 'rampart', 'extractor', 'nuker', 'powerSpawn',
]);

class VanillaAdapter implements ScreepsOkAdapter {
	readonly capabilities: AdapterCapabilities = {
		chemistry: true,
		powerCreeps: true,
		factory: true,
		market: true,
		observer: true,
		nuke: true,
		deposit: true,
		terrain: true,
		portals: true,
		invaderCore: true,
	};

	private server: any = null;
	private playerMap = new Map<string, string>();
	private reversePlayerMap = new Map<string, string>();
	private users = new Map<string, any>();
	private rooms: string[] = [];
	private idCounter = 0;
	private db: any = null;
	private env: any = null;
	private firstTickRun = false;
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

		for (const [handle, engineId] of Object.entries(NPC_HANDLES)) {
			this.playerMap.set(handle, engineId);
			this.reversePlayerMap.set(engineId, handle);
		}

		// Create rooms with terrain and controllers
		for (const roomSpec of spec.rooms) {
			await this.server.world.addRoom(roomSpec.name);
			await this.server.world.setTerrain(roomSpec.name,
				this.buildTerrain(withCornerWalls(roomSpec.terrain ?? new Array(2500).fill(0))));
			await this.server.world.addRoomObject(roomSpec.name, 'controller', 1, 1, {
				level: roomSpec.rcl ?? 0,
			});
		}

		// Auto-add the preload rooms that aren't already in the test's spec.
		// The runner's engine_runner subprocess snapshots terrain once on its
		// first makeRuntime call and never re-reads env.TERRAIN_DATA afterward
		// (see @screeps/driver/lib/runtime/make.js). By ensuring every test
		// writes the full preload set to env.TERRAIN_DATA before the warmup
		// tick below, whichever test runs first locks the runner's cache with
		// a superset that subsequent tests can freely reference.
		const specRoomNames = new Set(spec.rooms.map(r => r.name));
		for (const preload of PRELOAD_ROOMS) {
			if (specRoomNames.has(preload.name)) continue;
			await this.server.world.addRoom(preload.name);
			await this.server.world.setTerrain(preload.name, buildTerrainMatrix(preload.terrain));
		}

		// Create players manually (no addBot — avoids phantom spawns and controller overwrites)
		// CRITICAL: the wrapper must NOT touch `Memory` before user code runs.
		// `Memory` is a one-shot getter at @screeps/engine/dist/game/game.js:468
		// — first access parses raw memory and replaces itself with a static
		// value, so any later `RawMemory.set` from user code can no longer
		// affect what `Memory` sees. MEMORY-001 (`RawMemory.set before first
		// Memory access replaces what Memory sees`) requires that the user's
		// expression is the first thing to touch Memory in the tick.
		//
		// Sequence: read the eval payload via RawMemory.get() (no Memory
		// touch), eval user code, then write the result envelope into Memory
		// at the very end. By that point user code has had its chance to
		// access Memory or call RawMemory.set; the engine's tick-end
		// auto-serialize at @screeps/driver/lib/runtime/runtime.js:246-248
		// picks up our Memory mutation and persists it. We must NOT call
		// RawMemory.set ourselves — that would drop any Memory mutations
		// the user made (rawMemory._parsed wins over rawMemory.get() in
		// the auto-serialize, but only if we don't override the raw string
		// with a stale snapshot first).
		const loopCode = `module.exports.loop = function() {
			var _sokRaw = RawMemory.get();
			var _sokParsed = null;
			if (_sokRaw) {
				try { _sokParsed = JSON.parse(_sokRaw); } catch (e) { _sokParsed = null; }
			}
			if (!_sokParsed || typeof _sokParsed !== 'object' || !_sokParsed._screepsOk) {
				return;
			}
			var _sokCode = _sokParsed._screepsOk;
			var _sokResultObj;
			try {
				var _sokResult = eval(_sokCode);
				if (_sokResult === undefined) {
					_sokResult = null;
				}
				var _sokSerErr = null;
				if (typeof _sokResult === 'function' || typeof _sokResult === 'symbol') {
					_sokSerErr = 'Return value is a ' + typeof _sokResult + ', not a plain JSON value';
				} else if (_sokResult !== null && typeof _sokResult === 'object'
					&& !Array.isArray(_sokResult)) {
					var _sokCtor = _sokResult.constructor;
					if (_sokCtor !== Object && _sokCtor !== undefined) {
						_sokSerErr = 'Return value is a ' + (_sokCtor.name || 'non-plain') + ' object, not a plain JSON value';
					} else {
						try { JSON.stringify(_sokResult); }
						catch (e) {
							_sokSerErr = 'Return value is not JSON-serializable: ' + (e && e.message ? e.message : 'cycle');
						}
					}
				}
				if (_sokSerErr) {
					_sokResultObj = { ok: false, errorType: 'SerializationError', error: _sokSerErr };
				} else {
					_sokResultObj = { ok: true, value: _sokResult };
				}
			} catch (e) {
				var _sokErrType = 'Error';
				var _sokErrMsg = '';
				try { _sokErrType = (e && e.constructor && e.constructor.name) || 'Error'; } catch (_) {}
				try {
					if (e === null) _sokErrMsg = 'null';
					else if (e === undefined) _sokErrMsg = 'undefined';
					else if (e && e.message != null) _sokErrMsg = String(e.message);
					else _sokErrMsg = String(e);
				} catch (_) { _sokErrMsg = 'Unknown error'; }
				_sokResultObj = { ok: false, error: _sokErrMsg, errorType: _sokErrType };
			}
			// Write result envelope into Memory and then force-serialize via
			// RawMemory.set. The engine tick-end auto-serialize at
			// @screeps/driver/lib/runtime/runtime.js:246-248 only overrides
			// the raw string when rawMemory._parsed is set, but RawMemory.set
			// deletes _parsed (runtime.bundle.js:15926-15929), so if user
			// code called RawMemory.set their raw string would win and our
			// Memory mutation would be lost. Calling RawMemory.set here with
			// the composed Memory state guarantees the envelope is persisted
			// regardless of which channel user code touched.
			//
			// If Memory parsed to null (user wrote a non-JSON string into raw
			// memory, as MEMORY-004 size-limit probe does on the failing
			// path), accessing it throws — fall back to a stub envelope.
			try {
				Memory._screepsOkExecuted = true;
				Memory._screepsOkResult = JSON.stringify(_sokResultObj);
				delete Memory._screepsOk;
				RawMemory.set(JSON.stringify(Memory));
			} catch (e) {
				RawMemory.set(JSON.stringify({
					_screepsOkExecuted: true,
					_screepsOkResult: JSON.stringify(_sokResultObj),
				}));
			}
		}`;

		for (let i = 0; i < spec.players.length; i++) {
			const entry = spec.players[i];
			const playerSpec: PlayerSpec = typeof entry === 'string' ? { name: entry } : entry;
			const handle = playerSpec.name;
			const username = playerSlots[i] ?? `player_${i}`;
			const ownedRooms = spec.rooms.filter(r => r.owner === handle);
			const roomName = ownedRooms[0]?.name ?? spec.rooms[0].name;

			// Default to a high GCL so multi-room claim tests aren't blocked
			// by the cap; tests that need ERR_GCL_NOT_ENOUGH set this low.
			const gcl = playerSpec.gcl ?? 10000000;

			// Insert user directly
			const user = await this.db.users.insert({
				username,
				cpu: 100,
				cpuAvailable: 10000,
				gcl,
				power: 10000000, // High GPL to allow creating power creeps
				active: 10000,
				money: 10000000000, // 10M credits (stored as milli-credits internally)
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

			// Set controller ownership for all rooms this player owns
			for (const ownedRoom of ownedRooms) {
				const gameTime = await this.server.world.gameTime;
				const downgradeTime = ownedRoom.ticksToDowngrade != null
					? gameTime + ownedRoom.ticksToDowngrade
					: null;
				// Engine stores active safe mode as the absolute tick the
				// timer expires; the player-facing getter at
				// `@screeps/engine/dist/game/structures.js:187` reports
				// `safeMode - gameTime` (remaining ticks). RoomSpec.safeMode
				// passes "remaining ticks", so we add the current gameTime.
				const safeMode = ownedRoom.safeMode != null && ownedRoom.safeMode > 0
					? gameTime + ownedRoom.safeMode
					: null;
				await this.db['rooms.objects'].update(
					{ $and: [{ room: ownedRoom.name }, { type: 'controller' }] },
					{ $set: {
						user: user._id,
						level: ownedRoom.rcl ?? 1,
						progress: 0,
						downgradeTime,
						safeMode,
						safeModeAvailable: ownedRoom.safeModeAvailable ?? 0,
						safeModeCooldown: 0,
					} },
				);
				// Mark room as active
				await this.db.rooms.update(
					{ _id: ownedRoom.name },
					{ $set: { active: true } },
				);
				await this.env.sadd(this.env.keys.ACTIVE_ROOMS, [ownedRoom.name]);
			}

			// Anchor headless players (no owned rooms in the spec) with a
			// sentinel flag in the preload neighbor room. The driver
			// (`@screeps/driver/lib/runtime/data.js:103-109`) flips
			// `active:0` on any user whose `rooms.objects.find({user})`
			// is empty, which then removes them from the loop. Players
			// with an owned room are already anchored by their controller
			// (the `$set: { user }` above); headless players need their
			// own anchor object. Flags are the cheapest choice — they
			// have no game effect, no RCL/ownership requirements, and
			// the driver counts them before the flag/site type filter
			// at line 116.
			if (ownedRooms.length === 0) {
				await this.db['rooms.objects'].insert({
					room: TERRAIN_FIXTURE_NEIGHBOR,
					type: 'flag',
					x: 0,
					y: 0,
					user: user._id,
					name: `__sok_anchor_${username}`,
					color: 1,
					secondaryColor: 1,
				});
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

		// Warm-up tick: the engine needs one tick to load user code into
		// isolated-vm and initialize the runtime. Without this, the first
		// runPlayer call may fail silently. The runtime's terrain cache is
		// not yet armed at this point — that happens on the first
		// user-facing tick (runPlayer/runPlayers/tick), so post-warmup
		// setTerrain is still observable to player code as long as no
		// user tick has run yet.
		await this.server.tick();
	}

	async placeCreep(roomName: string, spec: CreepSpec): Promise<string> {
		const userId = this.resolvePlayer(spec.owner);
		const name = spec.name ?? `creep-${this.nextId()}`;
		const gameTime = await this.server.world.gameTime;

		const body: { type: string; hits: number; boost?: string }[] =
			spec.body.map(type => ({ type, hits: 100 }));
		if (spec.boosts) {
			for (const [idx, boost] of Object.entries(spec.boosts)) {
				body[Number(idx)].boost = boost;
			}
		}
		const C = this.server.constants;
		const carryCapacity = C?.CARRY_CAPACITY ?? 50;
		const storeCapacity = body.reduce((sum: number, p) => {
			if (p.type !== 'carry') return sum;
			const boostMult = p.boost
				? (C?.BOOSTS?.carry?.[p.boost]?.capacity ?? 1)
				: 1;
			return sum + carryCapacity * boostMult;
		}, 0);

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
			ageTime: gameTime + (spec.ticksToLive ?? 1500),
			actionLog: {},
			notifyWhenAttacked: true,
		});

		// Activate room if not already active
		await this.db.rooms.update({ _id: roomName }, { $set: { active: true } });
		await this.env.sadd(this.env.keys.ACTIVE_ROOMS, [roomName]);

		return result._id;
	}

	async placeStructure(roomName: string, spec: StructureSpec): Promise<string> {
		if (!spec.owner && STRUCTURE_TYPES_REQUIRING_OWNER.has(spec.structureType)) {
			throw new Error(
				`placeStructure: owner is required for structureType '${spec.structureType}'. ` +
				`Unowned structures: ${[...STRUCTURE_TYPES_UNOWNED].join(', ')}.`,
			);
		}
		const userId = spec.owner ? this.resolvePlayer(spec.owner) : undefined;
		const rcl = await this.getRoomRcl(roomName);
		const defaults = this.getStructureDefaults(spec.structureType, rcl);
		const attrs: Record<string, any> = { ...defaults };

		if (userId) attrs.user = userId;
		if (spec.hits !== undefined) attrs.hits = spec.hits;
		if (spec.store) {
			attrs.store = spec.store;
			// Lab: if the spec store contains a mineral, register it in
			// storeCapacityResource so the engine's getCapacity() reports
			// the correct per-resource cap.
			if (spec.structureType === 'lab' && attrs.storeCapacityResource) {
				const C = this.server.constants;
				for (const res of Object.keys(spec.store)) {
					if (res !== 'energy' && !attrs.storeCapacityResource[res]) {
						attrs.storeCapacityResource[res] = C.LAB_MINERAL_CAPACITY ?? 3000;
						attrs.mineralType = res;
					}
				}
			}
		}

		if (spec.ticksToDecay !== undefined) {
			const gameTime = await this.server.world.gameTime;
			attrs.nextDecayTime = gameTime + spec.ticksToDecay;
		}

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
		const gameTime = await this.server.world.gameTime;
		const attrs: Record<string, unknown> = {
			mineralType: spec.mineralType,
			mineralAmount: spec.mineralAmount ?? 100000,
			density: 3,
		};
		if (spec.ticksToRegeneration !== undefined) {
			attrs.nextRegenerationTime = gameTime + spec.ticksToRegeneration;
		}
		const result = await this.server.world.addRoomObject(
			roomName, 'mineral', spec.pos[0], spec.pos[1], attrs);
		return result._id;
	}

	async placeFlag(roomName: string, spec: FlagSpec): Promise<string> {
		// Flags live in `db['rooms.flags']`, NOT `db['rooms.objects']`. The
		// driver loads them via `db['rooms.flags'].find({user: userId})` at
		// `@screeps/driver/lib/runtime/data.js:140`, then the engine parses
		// the per-room `data` string in `@screeps/engine/dist/game/game.js:393`
		// (split on `|` for entries, `~` for fields). One document holds all
		// flags for a (user, room) pair, so subsequent placeFlag calls into
		// the same room must append to the existing `data` string rather than
		// inserting a new document.
		const userId = this.resolvePlayer(spec.owner);
		const safeName = spec.name.replace(/\|/g, '$VLINE$').replace(/~/g, '$TILDE$');
		const color = spec.color ?? 1;
		const secondaryColor = spec.secondaryColor ?? color;
		const entry = `${safeName}~${color}~${secondaryColor}~${spec.pos[0]}~${spec.pos[1]}`;

		const existing = await this.db['rooms.flags'].findOne({
			$and: [{ user: userId }, { room: roomName }],
		});
		if (existing) {
			const newData = existing.data ? `${existing.data}|${entry}` : entry;
			await this.db['rooms.flags'].update(
				{ _id: existing._id },
				{ $set: { data: newData } },
			);
			return `flag_${spec.name}`;
		}

		await this.db['rooms.flags'].insert({
			user: userId,
			room: roomName,
			data: entry,
		});
		return `flag_${spec.name}`;
	}

	async placeTombstone(roomName: string, spec: TombstoneSpec): Promise<string> {
		const gameTime = await this.server.world.gameTime;
		const deathTime = spec.deathTime ?? gameTime;
		const ticksToDecay = spec.ticksToDecay ?? 500;
		const result = await this.db['rooms.objects'].insert({
			room: roomName,
			type: 'tombstone',
			x: spec.pos[0],
			y: spec.pos[1],
			creepName: spec.creepName,
			deathTime,
			decayTime: deathTime + ticksToDecay,
			store: spec.store ?? {},
			creepBody: [],
			creepTicksToLive: 0,
			creepId: null,
		});
		// Activate room
		await this.db.rooms.update({ _id: roomName }, { $set: { active: true } });
		await this.env.sadd(this.env.keys.ACTIVE_ROOMS, [roomName]);
		return result._id;
	}

	async placeRuin(roomName: string, spec: RuinSpec): Promise<string> {
		const gameTime = await this.server.world.gameTime;
		const destroyTime = spec.destroyTime ?? gameTime;
		const ticksToDecay = spec.ticksToDecay ?? 500;
		const result = await this.db['rooms.objects'].insert({
			room: roomName,
			type: 'ruin',
			x: spec.pos[0],
			y: spec.pos[1],
			structureType: spec.structureType,
			destroyTime,
			decayTime: destroyTime + ticksToDecay,
			store: spec.store ?? {},
		});
		await this.db.rooms.update({ _id: roomName }, { $set: { active: true } });
		await this.env.sadd(this.env.keys.ACTIVE_ROOMS, [roomName]);
		return result._id;
	}

	async placeDroppedResource(roomName: string, spec: DroppedResourceSpec): Promise<string> {
		// Engine data model stores the resource value in a field named after
		// the resource type (e.g. `.energy = 200`). The player-side `.amount`
		// getter derives from that field (engine game/resources.js:37). Do
		// not store a duplicate `amount` field — it would go stale as the
		// engine mutates `[resourceType]` during pickup/decay.
		const result = await this.db['rooms.objects'].insert({
			room: roomName,
			type: spec.resourceType === 'energy' ? 'energy' : 'resource',
			x: spec.pos[0],
			y: spec.pos[1],
			resourceType: spec.resourceType,
			[spec.resourceType]: spec.amount,
		});
		// Activate room
		await this.db.rooms.update({ _id: roomName }, { $set: { active: true } });
		await this.env.sadd(this.env.keys.ACTIVE_ROOMS, [roomName]);
		return result._id;
	}

	async placePowerCreep(roomName: string, spec: PowerCreepSpec): Promise<string> {
		const userId = this.resolvePlayer(spec.owner);
		const gameTime = await this.server.world.gameTime;
		const name = spec.name ?? `PowerCreep_${Date.now()}`;

		// Build the powers map in the engine's format: { [PWR]: { level, cooldown } }
		const powers: Record<string, { level: number; cooldown: number }> = {};
		for (const [pwr, level] of Object.entries(spec.powers)) {
			powers[pwr] = { level: level as number, cooldown: 0 };
		}

		const pcLevel = Object.values(spec.powers).reduce((s, l) => s + l, 0);

		// Insert into rooms.objects so the engine sees it in the room.
		const result = await this.db['rooms.objects'].insert({
			room: roomName,
			type: 'powerCreep',
			x: spec.pos[0],
			y: spec.pos[1],
			user: userId,
			name,
			className: 'operator',
			level: pcLevel,
			hitsMax: 1000,
			hits: 1000,
			store: spec.store ?? {},
			storeCapacity: 100,
			powers,
			ageTime: gameTime + 5000,
			actionLog: {},
			spawning: false,
		});

		// The engine reads power creeps from db['users.power_creeps'], not
		// from users.powerCreeps. Insert a matching record there.
		await this.db['users.power_creeps'].insert({
			_id: result._id,
			user: userId,
			name,
			className: 'operator',
			level: pcLevel,
			hitsMax: 1000,
			hits: 1000,
			store: spec.store ?? {},
			storeCapacity: 100,
			powers,
			shard: 'shard0',
			spawnCooldownTime: null,
			deleteTime: null,
			room: roomName,
			x: spec.pos[0],
			y: spec.pos[1],
		});

		// Power creeps need isPowerEnabled on the room controller.
		await this.db['rooms.objects'].update(
			{ $and: [{ room: roomName }, { type: 'controller' }] },
			{ $set: { isPowerEnabled: true } },
		);

		await this.db.rooms.update({ _id: roomName }, { $set: { active: true } });
		await this.env.sadd(this.env.keys.ACTIVE_ROOMS, [roomName]);
		return result._id;
	}

	async placeNuke(roomName: string, spec: NukeSpec): Promise<string> {
		const gameTime = await this.server.world.gameTime;
		const result = await this.db['rooms.objects'].insert({
			room: roomName,
			type: 'nuke',
			x: spec.pos[0],
			y: spec.pos[1],
			launchRoomName: spec.launchRoomName,
			landTime: gameTime + spec.timeToLand,
		});
		await this.db.rooms.update({ _id: roomName }, { $set: { active: true } });
		await this.env.sadd(this.env.keys.ACTIVE_ROOMS, [roomName]);
		return result._id;
	}

	async placeMarketOrder(spec: MarketOrderSpec): Promise<string> {
		const gameTime = await this.server.world.gameTime;
		const userId = this.resolvePlayer(spec.owner);
		// Engine stores price in milli-units (see global-intents/market.js:152).
		const result = await this.db['market.orders'].insert({
			createdTimestamp: spec.createdTimestamp ?? Date.now(),
			created: spec.created ?? gameTime,
			user: userId,
			active: spec.active ?? true,
			type: spec.type,
			resourceType: spec.resourceType,
			price: Math.round(spec.price * 1000),
			amount: 0,
			remainingAmount: spec.totalAmount,
			totalAmount: spec.totalAmount,
			roomName: spec.roomName,
		});
		return result._id;
	}

	async placeObject(roomName: string, type: string, spec: Record<string, unknown>): Promise<string> {
		const pos = spec.pos as [number, number] | undefined;
		if (!pos) throw new Error('placeObject: spec.pos is required');

		if (type === 'portal') {
			const dest = spec.destination as { room?: string; x?: number; y?: number; shard?: string } | undefined;
			if (!dest) throw new Error('placeObject portal: spec.destination is required');
			// Cross-shard portal: { shard, room }. Same-shard: { room, x, y }.
			const destination = dest.shard
				? { shard: dest.shard, room: dest.room }
				: { room: dest.room, x: dest.x, y: dest.y };
			const result = await this.db['rooms.objects'].insert({
				room: roomName,
				type: 'portal',
				x: pos[0],
				y: pos[1],
				destination,
				unstableDate: spec.unstableDate ?? null,
				decayTime: spec.decayTime ?? null,
			});
			return result._id;
		}

		if (type === 'deposit') {
			const C = this.server.constants;
			const gameTime = await this.server.world.gameTime;
			// Processor (@screeps/engine/src/processor.js:421-426) decays any
			// deposit where `gameTime >= decayTime - 1`, and `null - 1` coerces
			// to -1 — so a null decayTime would delete the deposit on its first
			// processed tick. Seed a valid future decayTime so the deposit
			// survives until the spec asks it to expire.
			const decayTicks = (spec.decayTime as number) ?? (C.DEPOSIT_DECAY_TIME ?? 50000);
			const result = await this.db['rooms.objects'].insert({
				room: roomName,
				type: 'deposit',
				x: pos[0],
				y: pos[1],
				depositType: (spec.depositType as string) ?? 'silicon',
				harvested: (spec.harvested as number) ?? 0,
				lastCooldown: (spec.lastCooldown as number) ?? 0,
				cooldownTime: spec.cooldownTime != null ? gameTime + (spec.cooldownTime as number) : null,
				decayTime: gameTime + decayTicks,
			});
			await this.db.rooms.update({ _id: roomName }, { $set: { active: true } });
			await this.env.sadd(this.env.keys.ACTIVE_ROOMS, [roomName]);
			return result._id;
		}

		if (type === 'keeperLair') {
			const gameTime = await this.server.world.gameTime;
			const nextSpawn = (spec.nextSpawnTime as number)
				? gameTime + (spec.nextSpawnTime as number)
				: null;
			const result = await this.db['rooms.objects'].insert({
				room: roomName,
				type: 'keeperLair',
				x: pos[0],
				y: pos[1],
				nextSpawnTime: nextSpawn,
			});
			return result._id;
		}

		if (type === 'invaderCore') {
			const gameTime = await this.server.world.gameTime;
			const level = (spec.level as number) ?? 0;
			const deployTime = (spec.deployTime as number)
				? gameTime + (spec.deployTime as number)
				: null;
			const result = await this.db['rooms.objects'].insert({
				room: roomName,
				type: 'invaderCore',
				x: pos[0],
				y: pos[1],
				level,
				hits: 100000,
				hitsMax: 100000,
				deployTime,
				effects: spec.effects ?? [],
			});
			return result._id;
		}

		if (type === 'powerBank') {
			const C = this.server.constants;
			const gameTime = await this.server.world.gameTime;
			const store = (spec.store as Record<string, number>) ?? {};
			const power = (spec.power as number) ?? store.power ?? 1000;
			const hits = (spec.hits as number) ?? (C.POWER_BANK_HITS ?? 2000000);
			const hitsMax = (spec.hitsMax as number) ?? hits;
			const decay = (spec.decayTime as number)
				? gameTime + (spec.decayTime as number)
				: gameTime + (C.POWER_BANK_DECAY ?? 5000);
			const result = await this.db['rooms.objects'].insert({
				room: roomName,
				type: 'powerBank',
				x: pos[0],
				y: pos[1],
				store: { power },
				hits,
				hitsMax,
				decayTime: decay,
			});
			await this.db.rooms.update({ _id: roomName }, { $set: { active: true } });
			await this.env.sadd(this.env.keys.ACTIVE_ROOMS, [roomName]);
			return result._id;
		}

		throw new Error(`placeObject: unsupported type '${type}'`);
	}

	async setTerrain(room: string, terrain: TerrainSpec): Promise<void> {
		// `@screeps/driver/lib/runtime/make.js` snapshots `env.TERRAIN_DATA`
		// once the runtime cache is armed and never refreshes it. The
		// runtime is armed on the first user-facing tick (runPlayer /
		// runPlayers / shard.tick), so post-arm setTerrain leaves
		// player-visible `Room.getTerrain` and `PathFinder` reading the
		// cached blob — a silent divergence. Spec §Terrain requires
		// explicit failure when the engine cannot honor the mutation.
		if (this.firstTickRun) {
			throw new Error(
				`vanilla adapter: setTerrain('${room}') called after a user-facing tick. ` +
				`The driver caches terrain on its first runtime fetch and never ` +
				`refreshes it, so post-tick terrain mutations are invisible to ` +
				`Room.getTerrain and PathFinder. Pass terrain via RoomSpec.terrain ` +
				`at createShard time, or call setTerrain before the first runPlayer/tick.`,
			);
		}
		await this.server.world.setTerrain(room, this.buildTerrain(withCornerWalls(terrain)));
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
		delete mem._screepsOkExecuted;
		await this.env.set(this.env.keys.MEMORY + botId, JSON.stringify(mem));

		// Tick to execute — the main loop evals Memory._screepsOk and stores result
		await this.server.tick();
		this.firstTickRun = true;

		// Read result from Memory
		const memAfter = JSON.parse(
			await this.env.get(this.env.keys.MEMORY + botId) || '{}');

		// Execution confirmation: the main loop sets this before eval
		if (!memAfter._screepsOkExecuted) {
			throw new Error(
				`runPlayer: player '${handle}' code was not executed. ` +
				`The engine may have skipped this player's main loop.`,
			);
		}

		const resultJson = memAfter._screepsOkResult;
		if (!resultJson) {
			throw new Error(
				`runPlayer: execution confirmed but no result captured for '${handle}'.`,
			);
		}

		const parsed = JSON.parse(resultJson);
		if (!parsed.ok) {
			const kind = parsed.errorType === 'SyntaxError' ? 'syntax' as const
				: parsed.errorType === 'SerializationError' ? 'serialization' as const
				: 'runtime' as const;
			throw new RunPlayerError(kind, parsed.error);
		}

		return parsed.value ?? null;
	}

	async runPlayers(codesByUser: Record<string, PlayerCode>): Promise<Record<string, PlayerReturnValue>> {
		const handles = Object.keys(codesByUser);
		for (const handle of handles) {
			if (!this.users.get(handle)) throw new Error(`Unknown player: ${handle}`);
		}

		for (const handle of handles) {
			const botId = this.resolvePlayer(handle);
			const codeStr = String(codesByUser[handle]).trimEnd().replace(/;$/, '');
			const memRaw = await this.env.get(this.env.keys.MEMORY + botId) || '{}';
			const mem = JSON.parse(memRaw);
			mem._screepsOk = codeStr;
			delete mem._screepsOkResult;
			delete mem._screepsOkExecuted;
			await this.env.set(this.env.keys.MEMORY + botId, JSON.stringify(mem));
		}

		await this.server.tick();
		this.firstTickRun = true;

		const results: Record<string, PlayerReturnValue> = {};
		for (const handle of handles) {
			const botId = this.resolvePlayer(handle);
			const memAfter = JSON.parse(
				await this.env.get(this.env.keys.MEMORY + botId) || '{}');

			if (!memAfter._screepsOkExecuted) {
				throw new Error(
					`runPlayers: player '${handle}' code was not executed. ` +
					`The engine may have skipped this player's main loop.`,
				);
			}

			const resultJson = memAfter._screepsOkResult;
			if (!resultJson) {
				throw new Error(
					`runPlayers: execution confirmed but no result captured for '${handle}'.`,
				);
			}

			const parsed = JSON.parse(resultJson);
			if (!parsed.ok) {
				const kind = parsed.errorType === 'SyntaxError' ? 'syntax' as const
					: parsed.errorType === 'SerializationError' ? 'serialization' as const
					: 'runtime' as const;
				throw new RunPlayerError(kind, parsed.error);
			}

			results[handle] = parsed.value ?? null;
		}

		return results;
	}

	async tick(count = 1): Promise<void> {
		for (let i = 0; i < count; i++) {
			await this.server.tick();
		}
		if (count > 0) this.firstTickRun = true;
	}

	async getObject(id: string): Promise<ObjectSnapshot | null> {
		const obj = await this.db['rooms.objects'].findOne({ _id: id });
		if (!obj) return null;
		const gameTime = await this.server.world.gameTime;
		return snapshotObject(obj, this, gameTime);
	}

	async findInRoom(roomName: string, type: number): Promise<any[]> {
		const objects = await this.server.world.roomObjects(roomName);
		const gameTime = await this.server.world.gameTime;
		return snapshotRoomObjects(objects, selectorFromFindConstant(type), this, gameTime);
	}

	async getGameTime(): Promise<number> {
		return this.server.world.gameTime;
	}

	async getControllerPos(_room: string): Promise<{ x: number; y: number } | null> {
		// Vanilla always places controllers at (1, 1) in createShard
		return { x: 1, y: 1 };
	}

	async teardown(): Promise<void> {
		this.playerMap.clear();
		this.reversePlayerMap.clear();
		this.users.clear();
		this.rooms = [];
		this.db = null;
		this.env = null;
		this.idCounter = 0;
		this.firstTickRun = false;
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
		return C?.CONSTRUCTION_COST?.[structureType] ?? 300;
	}

	private async getRoomRcl(roomName: string): Promise<number> {
		const ctrl = await this.db['rooms.objects'].findOne({
			$and: [{ room: roomName }, { type: 'controller' }],
		});
		return ctrl?.level ?? 0;
	}

	private getStructureDefaults(structureType: string, rcl = 8): Record<string, any> {
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
				storeCapacityResource: { energy: C.EXTENSION_ENERGY_CAPACITY?.[rcl] ?? 50 },
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
				// Default to a far-future decay so containers don't tick down
				// on the first engine tick. The container processor at
				// `@screeps/engine/src/processor/intents/containers/tick.js:10`
				// triggers decay when `nextDecayTime` is undefined, which
				// reduces hits by CONTAINER_DECAY (5000) immediately. With the
				// default CONTAINER_HITS (250000) the container survives, but
				// custom-hits placements (e.g. STRUCTURE-HITS-001 with hits=1000)
				// drop below zero and get removed before the test can observe
				// them. Tests that need a real decay schedule set ticksToDecay
				// on the StructureSpec, which placeStructure honours below.
				nextDecayTime: 9999999,
			};
			case 'road': return {
				hits: C.ROAD_HITS, hitsMax: C.ROAD_HITS,
				nextDecayTime: 9999999,
			};
			case 'constructedWall': return {
				hits: 1, hitsMax: C.WALL_HITS_MAX,
			};
			case 'rampart': return {
				hits: 1, hitsMax: C.RAMPART_HITS_MAX?.[8] ?? 300000000,
				isPublic: false, nextDecayTime: 9999999,
			};
			case 'lab': return {
				hits: C.LAB_HITS ?? 500, hitsMax: C.LAB_HITS ?? 500,
				store: { energy: 0 },
				storeCapacityResource: { energy: C.LAB_ENERGY_CAPACITY ?? 2000 },
				storeCapacity: (C.LAB_ENERGY_CAPACITY ?? 2000) + (C.LAB_MINERAL_CAPACITY ?? 3000),
				cooldown: 0, mineralType: null,
				actionLog: { runReaction: null },
			};
			case 'observer': return {
				hits: C.OBSERVER_HITS ?? 500, hitsMax: C.OBSERVER_HITS ?? 500,
			};
			case 'terminal': return {
				hits: C.TERMINAL_HITS ?? 3000, hitsMax: C.TERMINAL_HITS ?? 3000,
				store: {},
				storeCapacity: C.TERMINAL_CAPACITY ?? 300000,
				cooldown: 0,
			};
			case 'factory': return {
				hits: C.FACTORY_HITS ?? 1000, hitsMax: C.FACTORY_HITS ?? 1000,
				store: {},
				storeCapacity: C.FACTORY_CAPACITY ?? 50000,
				cooldown: 0,
				level: 0,
			};
			case 'extractor': return {
				hits: C.EXTRACTOR_HITS ?? 500, hitsMax: C.EXTRACTOR_HITS ?? 500,
				cooldown: 0,
			};
			case 'nuker': return {
				hits: C.NUKER_HITS ?? 1000, hitsMax: C.NUKER_HITS ?? 1000,
				store: { energy: 0 },
				storeCapacityResource: { energy: C.NUKER_ENERGY_CAPACITY ?? 300000, G: C.NUKER_GHODIUM_CAPACITY ?? 5000 },
				storeCapacity: (C.NUKER_ENERGY_CAPACITY ?? 300000) + (C.NUKER_GHODIUM_CAPACITY ?? 5000),
				cooldown: 0,
			};
			case 'powerSpawn': return {
				hits: C.POWER_SPAWN_HITS ?? 5000, hitsMax: C.POWER_SPAWN_HITS ?? 5000,
				store: { energy: 0 },
				storeCapacityResource: { energy: C.POWER_SPAWN_ENERGY_CAPACITY ?? 5000, power: C.POWER_SPAWN_POWER_CAPACITY ?? 100 },
				storeCapacity: (C.POWER_SPAWN_ENERGY_CAPACITY ?? 5000) + (C.POWER_SPAWN_POWER_CAPACITY ?? 100),
			};
			default: return {};
		}
	}
}

export async function createAdapter(): Promise<ScreepsOkAdapter> {
	return new VanillaAdapter();
}
