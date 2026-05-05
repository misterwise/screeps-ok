import type {
	ScreepsOkAdapter, AdapterCapabilities, ShardSpec, PlayerSpec, PlayerReturnValue,
	RoomActionLogCapture, ActionLogPayloadValue,
	CreepSpec, StructureSpec, SiteSpec, SourceSpec, MineralSpec,
	FlagSpec, TombstoneSpec, RuinSpec, DroppedResourceSpec,
	PowerCreepSpec, NukeSpec, MarketOrderSpec, TerrainSpec,
	InvaderRaidRoomStateSpec, InvaderRaidSpawnerOptions,
} from '../../src/adapter.js';
import { EventEmitter } from 'node:events';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ObjectSnapshot } from '../../src/snapshots/common.js';
import type { PlayerCode } from '../../src/code.js';
import { RunPlayerError } from '../../src/errors.js';
import { selectorFromFindConstant } from '../../src/find.js';
import { snapshotObject, snapshotRoomObjects } from './snapshots.js';
import { TERRAIN_FIXTURE_ROOM, TERRAIN_FIXTURE_SPEC, TERRAIN_FIXTURE_NEIGHBOR, TERRAIN_FIXTURE_NEIGHBOR_SPEC, withCornerWalls } from '../../src/terrain-fixture.js';

const nodeRequire = createRequire(import.meta.url);

// @ts-expect-error -- screeps-server-mockup has no type declarations
import { ScreepsServer, TerrainMatrix } from 'screeps-server-mockup';

// Terrain records written to every vanilla createShard when the spec does not
// already include them. They are intentionally not added to db.rooms, because
// vanilla's worldSize is computed from db.rooms and hidden fixture rooms should
// not change map span.
const PRELOAD_ROOMS: { name: string; terrain: TerrainSpec | null }[] = [
	{ name: TERRAIN_FIXTURE_ROOM, terrain: TERRAIN_FIXTURE_SPEC },
	{ name: TERRAIN_FIXTURE_NEIGHBOR, terrain: TERRAIN_FIXTURE_NEIGHBOR_SPEC },
];

function buildTerrain(terrain: TerrainSpec | null): any {
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
let sharedServerCleanupRegistered = false;
let sharedUserCodeTimestamp = Date.now();
let sharedTerrainRevision = 0;
let runnerLogPath: string | null = null;
let runnerFatal: Error | null = null;
const runnerFatalBus = new EventEmitter();
runnerFatalBus.setMaxListeners(0);

const VANILLA_WORLD_SIZE_ENV_KEY = 'screeps-ok:worldSize';
const VANILLA_TERRAIN_REVISION_ENV_KEY = 'screeps-ok:terrainRevision';
const RUNNER_SANDBOX_PATCH_FILE = 'runner-sandbox-patch.cjs';
// Hard ceiling on a single server.tick() call. The driver waits for the
// engine_runner subprocess to send back a tick reply over IPC; if the runner
// crashes (e.g. V8 snapshot mismatch), server-mockup auto-restarts it in a
// loop and the parent waits forever. Failing fast within the test budget
// surfaces the real cause instead of hanging until the vitest timeout.
const TICK_DEADLINE_MS = 30_000;
const RUNNER_LOG_TAIL_LINES = 80;

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

function writeRunnerSandboxPatch(root: string): string {
	const patchPath = path.join(root, RUNNER_SANDBOX_PATCH_FILE);
	const userVmPath = nodeRequire.resolve('@screeps/driver/lib/runtime/user-vm.js');
	const makePath = nodeRequire.resolve('@screeps/driver/lib/runtime/make.js');
	const patchSource = `'use strict';
const Module = require('module');
const fs = require('fs');

const userVmTarget = ${JSON.stringify(userVmPath)};
const makeTarget = ${JSON.stringify(makePath)};
const worldSizeKey = ${JSON.stringify(VANILLA_WORLD_SIZE_ENV_KEY)};
const terrainRevisionKey = ${JSON.stringify(VANILLA_TERRAIN_REVISION_ENV_KEY)};
const originalJs = Module._extensions['.js'];
let patchedUserVm = false;
let patchedMake = false;

Module._extensions['.js'] = function screepsOkVanillaSandboxPatch(module, filename) {
	if (filename === userVmTarget) {
		patchUserVm(module, filename);
		return;
	}
	if (filename === makeTarget) {
		patchMake(module, filename);
		return;
	}
	return originalJs(module, filename);
};

function maybeRestore() {
	if (patchedUserVm && patchedMake) {
		Module._extensions['.js'] = originalJs;
	}
}

function patchUserVm(module, filename) {
	const needle = "context.global.setIgnored('_worldSize', index.getWorldSize());";
	const replacement = "context.global.setIgnored('_worldSize', await (async function() {\\n" +
		"                try {\\n" +
		"                    const value = await common.storage.env.get(" + JSON.stringify(worldSizeKey) + ");\\n" +
		"                    const parsed = Number(value);\\n" +
		"                    if (Number.isFinite(parsed) && parsed > 0) return parsed;\\n" +
		"                } catch (_) {}\\n" +
		"                return index.getWorldSize();\\n" +
		"            })());";
	let source = fs.readFileSync(filename, 'utf8');
	if (!source.includes(needle)) {
		throw new Error('screeps-ok vanilla sandbox patch: user-vm worldSize injection point not found');
	}
	source = source.replace(needle, replacement);
	module._compile(source, filename);
	patchedUserVm = true;
	maybeRestore();
}

function patchMake(module, filename) {
	let source = fs.readFileSync(filename, 'utf8');
	const start = source.indexOf('function getAllTerrainData() {');
	const end = source.indexOf('\\n\\n\\nfunction getUserData', start);
	if (start === -1 || end === -1) {
		throw new Error('screeps-ok vanilla sandbox patch: make.js terrain cache block not found');
	}
	const replacement = "function getAllTerrainData() {\\n" +
		"    return env.get(" + JSON.stringify(terrainRevisionKey) + ")\\n" +
		"        .catch(() => null)\\n" +
		"        .then((revision) => {\\n" +
		"            if(staticTerrainData && staticTerrainRevision === revision) {\\n" +
		"                return;\\n" +
		"            }\\n" +
		"            return driver.getAllTerrainData()\\n" +
		"                .then((result) => {\\n" +
		"                    if(staticTerrainData && staticTerrainRevision === revision) {\\n" +
		"                        return;\\n" +
		"                    }\\n" +
		"                    pathfinderFactory.init(native, result);\\n" +
		"                    staticTerrainRevision = revision;\\n" +
		"                    staticTerrainDataSize = result.length * 2500;\\n" +
		"                    let bufferConstructor = typeof SharedArrayBuffer === 'undefined' ? ArrayBuffer : SharedArrayBuffer;\\n" +
		"                    let view = new Uint8Array(new bufferConstructor(staticTerrainDataSize));\\n" +
		"                    staticTerrainData = {\\n" +
		"                        buffer: view.buffer,\\n" +
		"                        roomOffsets: {},\\n" +
		"                    };\\n" +
		"                    result.forEach((room, roomIndex) => {\\n" +
		"                        var offset = roomIndex * 2500;\\n" +
		"                        for (var i = 0; i < 2500; i++) {\\n" +
		"                            view[i + offset] = Number(room.terrain.charAt(i));\\n" +
		"                        }\\n" +
		"                        staticTerrainData.roomOffsets[room.room] = offset;\\n" +
		"                    });\\n" +
		"                    console.log('Terrain shared buffer size:', staticTerrainDataSize);\\n" +
		"                });\\n" +
		"        });\\n" +
		"}";
	const declarationNeedle = "let staticTerrainData, staticTerrainDataSize = 0;";
	if (!source.includes(declarationNeedle)) {
		throw new Error('screeps-ok vanilla sandbox patch: make.js terrain declaration not found');
	}
	source = source.slice(0, start) + replacement + source.slice(end);
	source = source.replace(
		declarationNeedle,
		"let staticTerrainData, staticTerrainDataSize = 0, staticTerrainRevision;",
	);
	module._compile(source, filename);
	patchedMake = true;
	maybeRestore();
}
`;
	writeFileSync(patchPath, patchSource);
	return patchPath;
}

function installRunnerSandboxPatch(server: any, patchPath: string): void {
	const originalStartProcess = server.startProcess.bind(server);
	server.startProcess = async (name: string, execPath: string, env: Record<string, string>) => {
		const childEnv = name === 'engine_runner'
			? { ...env, NODE_OPTIONS: appendNodeRequire(env.NODE_OPTIONS, patchPath) }
			: env;
		const result = await originalStartProcess(name, execPath, childEnv);
		attachCrashWatcher(server, name);
		return result;
	};
}

function attachCrashWatcher(server: any, name: string): void {
	const proc = server.processes?.[name];
	if (!proc || typeof proc.once !== 'function') return;
	proc.once('exit', (code: number | null, signal: string | null) => {
		if (code == null || code === 0) return;
		const tail = readLogTail(runnerLogPath, RUNNER_LOG_TAIL_LINES);
		const hint = tail.includes('Version mismatch between V8 binary and snapshot')
			? '\nHint: stale @screeps/driver snapshot for the active node version. ' +
			  'Run `npm run preflight` (vanilla) to auto-regenerate, or:\n' +
			  `  node ${nodeRequire.resolve('@screeps/driver/make-runtime-snapshot.js')}\n`
			: '';
		const fatal = new Error(
			`vanilla adapter: ${name} subprocess exited with code ${code}` +
			(signal ? ` (signal ${signal})` : '') + '. ' +
			'screeps-server-mockup will auto-restart it, but tick replies will keep failing.' +
			(tail ? `\nLast ${RUNNER_LOG_TAIL_LINES} lines of ${runnerLogPath}:\n${tail}` : '') +
			hint,
		);
		runnerFatal = fatal;
		runnerFatalBus.emit('fatal', fatal);
		// Drop the broken shared server so the next test in this worker starts
		// fresh instead of inheriting the restart-loop. server.stop() kills the
		// processes; `if (code && code !== 0)` in server-mockup's exit handler
		// won't restart on the SIGTERM (signal exit, code === null).
		try { server.stop?.(); } catch {}
		if (sharedServer === server) sharedServer = null;
	});
}

function readLogTail(filePath: string | null, lines: number): string {
	if (!filePath) return '';
	try {
		const data = readFileSync(filePath, 'utf8');
		const split = data.split('\n');
		return split.slice(Math.max(0, split.length - lines)).join('\n');
	} catch {
		return '';
	}
}

async function guardedTick(server: any): Promise<void> {
	if (runnerFatal) throw runnerFatal;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let onFatal: ((err: Error) => void) | undefined;
	try {
		await Promise.race([
			server.tick(),
			new Promise<never>((_, reject) => {
				onFatal = reject;
				runnerFatalBus.once('fatal', reject);
			}),
			new Promise<never>((_, reject) => {
				timer = setTimeout(() => {
					if (runnerFatal) return reject(runnerFatal);
					const tail = readLogTail(runnerLogPath, RUNNER_LOG_TAIL_LINES);
					reject(new Error(
						`vanilla adapter: server.tick() did not complete within ${TICK_DEADLINE_MS}ms. ` +
						'engine_runner is stuck or has crashed without exiting.' +
						(tail ? `\nLast ${RUNNER_LOG_TAIL_LINES} lines of ${runnerLogPath}:\n${tail}` : ''),
					));
				}, TICK_DEADLINE_MS);
			}),
		]);
	} finally {
		if (timer) clearTimeout(timer);
		if (onFatal) runnerFatalBus.removeListener('fatal', onFatal);
	}
	if (runnerFatal) throw runnerFatal;
}

function appendNodeRequire(existing: string | undefined, patchPath: string): string {
	const option = `--require=${patchPath}`;
	if (!existing) return option;
	if (existing.split(/\s+/).includes(option)) return existing;
	return `${existing} ${option}`;
}

function normalizeActionLog(actionLog: unknown): Record<string, ActionLogPayloadValue> {
	const normalized: Record<string, ActionLogPayloadValue> = {};
	if (!actionLog || typeof actionLog !== 'object') return normalized;
	for (const [type, payload] of Object.entries(actionLog)) {
		if (payload == null) continue;
		normalized[type] = JSON.parse(JSON.stringify(payload)) as ActionLogPayloadValue;
	}
	return normalized;
}

function sortedActionLogObjects(objects: RoomActionLogCapture['objects']): RoomActionLogCapture['objects'] {
	return objects.sort((left, right) => left.id.localeCompare(right.id));
}

async function getServer(): Promise<any> {
	if (!sharedServer) {
		const port = await getStoragePort();
		const root = path.join(tmpdir(), 'screeps-ok-vanilla', `${process.pid}-${port}`);
		const logdir = path.join(root, 'logs');
		mkdirSync(path.join(root, 'server'), { recursive: true });
		mkdirSync(logdir, { recursive: true });
		const runnerSandboxPatch = writeRunnerSandboxPatch(root);
		runnerLogPath = path.join(logdir, 'engine_runner.log');
		runnerFatal = null;
		sharedServer = new ScreepsServer({
			path: path.join(root, 'server'),
			logdir,
			port,
		});
		// screeps-server-mockup emits 'error' for runner restart events. Without
		// a listener, EventEmitter promotes them to unhandled exceptions and
		// vitest reports them on top of our captured runnerFatal, masking the
		// actual cause. The exit watcher in attachCrashWatcher captures the
		// real crash; this listener exists solely to absorb the noisy emit.
		sharedServer.on('error', () => {});
		installRunnerSandboxPatch(sharedServer, runnerSandboxPatch);
		registerSharedServerCleanup();
		silenceDriverSigtermLog();
		await sharedServer.world.reset();
		await sharedServer.start();
	}
	return sharedServer;
}

async function getStoragePort(): Promise<number> {
	const explicit = Number(process.env.SCREEPS_OK_VANILLA_STORAGE_PORT);
	if (Number.isInteger(explicit) && explicit > 0) return explicit;
	return findAvailablePort();
}

async function findAvailablePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.once('error', reject);
		server.listen(0, 'localhost', () => {
			const address = server.address();
			const port = typeof address === 'object' && address ? address.port : 0;
			server.close(error => {
				if (error) reject(error);
				else resolve(port);
			});
		});
	});
}

function registerSharedServerCleanup(): void {
	if (sharedServerCleanupRegistered) return;
	sharedServerCleanupRegistered = true;
	const cleanup = () => {
		try { sharedServer?.stop?.(); } catch {}
	};
	process.once('exit', cleanup);
	process.once('SIGINT', () => {
		cleanup();
		process.exit(130);
	});
	process.once('SIGTERM', () => {
		cleanup();
		process.exit(143);
	});
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
	srcKeeper: '3',
};

// Structure types the engine always attributes to a user. Omitting `owner`
// in placeStructure for these produces a cryptic engine-internal crash
// downstream, so reject at the boundary.
const STRUCTURE_TYPES_UNOWNED = new Set(['container', 'road', 'constructedWall']);
const STRUCTURE_TYPES_REQUIRING_OWNER = new Set([
	'spawn', 'extension', 'tower', 'lab', 'link', 'storage', 'terminal',
	'factory', 'observer', 'rampart', 'extractor', 'nuker', 'powerSpawn',
]);
const STRUCTURE_TYPES_PLACE_OBJECT_ONLY = new Set([
	'deposit', 'invaderCore', 'keeperLair', 'portal', 'powerBank',
]);
const RESULT_PREFIX = '__SCREEPS_OK_RESULT__:';
const RESULT_TIMEOUT_MS = 1000;

// Sandbox-side polyfill for the `InterShardMemory` module. The open-source
// `@screeps/engine` does not register this global (the closed-source MMO
// server does); the local half of the API is observable single-shard, so
// we register a same-tick implementation here. `_local` lives in the IIFE
// closure and persists for the lifetime of the runtime worker via the
// require-cache for `main`. `getRemote` throws because the harness is
// single-shard (see capability `multiShard: false`); the 100 KiB length
// cap matches behaviors.md §29.3 ISM-004.
const INTER_SHARD_MEMORY_POLYFILL = `
(function (g) {
	if (g.InterShardMemory) return;
	var _local = null;
	var SIZE = 100 * 1024;
	Object.defineProperty(g, 'InterShardMemory', {
		value: Object.freeze({
			getLocal: function () { return _local; },
			setLocal: function (value) {
				if (typeof value !== 'string') {
					throw new TypeError('InterShardMemory.setLocal: value is not a string');
				}
				if (value.length > SIZE) {
					throw new Error('InterShardMemory.setLocal: value exceeds 100 KiB');
				}
				_local = value;
			},
			getRemote: function () {
				throw new Error('InterShardMemory.getRemote requires multi-shard, which this adapter does not support');
			},
		}),
		configurable: false,
		writable: false,
		enumerable: false,
	});
})(typeof global !== 'undefined' ? global : this);
`;

type ResultCapture = {
	wait: () => Promise<string | undefined>;
	dispose: () => void;
};

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
		invaderRaidSpawner: true,
		// The open-source `@screeps/engine` ships no InterShardMemory
		// module (the MMO server provides it closed-source) and does
		// not seed `Game.cpu.shardLimits`. `interShardMemory` is true
		// because the adapter polyfills the local half of the API in
		// the player's main module — see INTER_SHARD_MEMORY_POLYFILL
		// below. `multiShard` and `cpuShardLimits` remain false until
		// further wiring lands.
		multiShard: false,
		interShardMemory: true,
		cpuShardLimits: false,
		// The adapter supplies the current shard span to the vanilla runner
		// before each player VM initializes, without changing @screeps/engine.
		liveWorldSize: true,
		// Captured from vanilla's persisted room-history payload for the
		// current tick, then normalized to the shared adapter shape.
		actionLogCapture: true,
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
	private runCounter = 0;
	private nextId(): string {
		return `sok${++this.idCounter}`;
	}

	private nextRunNonce(): string {
		return `run${++this.runCounter}`;
	}

	private captureRunResult(handle: string, user: any, nonce: string): ResultCapture {
		if (!user || typeof user.on !== 'function') {
			throw new Error(
				`vanilla adapter: player '${handle}' has no console event channel; ` +
				`cannot capture runPlayer result without mutating Memory.`,
			);
		}

		const marker = `${RESULT_PREFIX}${nonce}:`;
		let resultJson: string | undefined;
		let resolveSeen: (value: string) => void = () => {};
		const seen = new Promise<string>(resolve => { resolveSeen = resolve; });
		const listener = (_logs: unknown[], results: unknown[]) => {
			for (const entry of results) {
				const text = this.consoleEventText(entry);
				if (!text?.startsWith(marker)) continue;
				try {
					resultJson = decodeURIComponent(text.slice(marker.length));
				} catch {
					resultJson = text.slice(marker.length);
				}
				resolveSeen(resultJson);
				return;
			}
		};

		user.on('console', listener);
		return {
			wait: async () => {
				if (resultJson !== undefined) return resultJson;
				await Promise.race([
					seen,
					new Promise<void>(resolve => setTimeout(resolve, RESULT_TIMEOUT_MS)),
				]);
				return resultJson;
			},
			dispose: () => {
				if (typeof user.off === 'function') user.off('console', listener);
				else if (typeof user.removeListener === 'function') user.removeListener('console', listener);
			},
		};
	}

	private consoleEventText(entry: unknown): string | null {
		if (typeof entry === 'string') return entry;
		if (entry && typeof entry === 'object' && 'message' in entry) {
			const message = (entry as { message?: unknown }).message;
			return message == null ? null : String(message);
		}
		return null;
	}

	private parseRunResult(source: string, handle: string, resultJson: string | undefined): PlayerReturnValue {
		if (resultJson === undefined) {
			throw new Error(
				`${source}: player '${handle}' code was not executed or no result was captured. ` +
				`The engine may have skipped this player's main loop.`,
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

	private buildConsoleCommand(userCode: string, nonce: string): string {
		const src = JSON.stringify(userCode);
		const prefix = JSON.stringify(`${RESULT_PREFIX}${nonce}:`);
		return `(function() {
			var _sokResultObj;
			try {
				var _sokResult = eval(${src});
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
			try {
				if (RawMemory._parsed) JSON.stringify(RawMemory._parsed);
			} catch (_) {
				try { RawMemory.set(RawMemory.get()); } catch (_) {}
			}
			return ${prefix} + encodeURIComponent(JSON.stringify(_sokResultObj));
		})()`;
	}

	private async publishSandboxWorldSize(): Promise<void> {
		const common = nodeRequire('@screeps/common') as {
			calcWorldSize: (rooms: Array<{ _id: string }>) => number;
		};
		const rooms = (await this.db.rooms.find()).map((room: { _id: string }) => ({ _id: room._id }));
		const worldSize = rooms.length > 0 ? common.calcWorldSize(rooms) : 0;
		await this.env.set(VANILLA_WORLD_SIZE_ENV_KEY, String(worldSize));
		const driver = nodeRequire('@screeps/driver') as { getWorldSize?: () => number };
		driver.getWorldSize = () => worldSize;
	}

	private async publishTerrainRevision(): Promise<void> {
		await this.env.set(VANILLA_TERRAIN_REVISION_ENV_KEY, String(++sharedTerrainRevision));
	}

	private async bumpUserCodeTimestamps(): Promise<void> {
		const timestamp = ++sharedUserCodeTimestamp;
		await Promise.all([...this.users.keys()].map(handle =>
			this.db['users.code'].update(
				{ user: this.resolvePlayer(handle), activeWorld: true },
				{ $set: { timestamp } },
			),
		));
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
		this.firstTickRun = false;
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
				buildTerrain(withCornerWalls(roomSpec.terrain ?? new Array(2500).fill(0))));
			await this.server.world.addRoomObject(roomSpec.name, 'controller', 1, 1, {
				level: roomSpec.rcl ?? 0,
			});
		}

		// Preload fixture terrain that is not part of this shard's room set.
		// world.setTerrain writes rooms.terrain and refreshes env.TERRAIN_DATA
		// without requiring a db.rooms row, keeping getWorldSize tied to only
		// the rooms the test declared.
		const specRoomNames = new Set(spec.rooms.map(r => r.name));
		for (const preload of PRELOAD_ROOMS) {
			if (specRoomNames.has(preload.name)) continue;
			await this.server.world.setTerrain(preload.name, buildTerrain(preload.terrain));
		}
		await this.publishTerrainRevision();
		await this.publishSandboxWorldSize();

		// Create players manually (no addBot — avoids phantom spawns and
		// controller overwrites). User snippets are delivered through
		// vanilla's built-in users.console eval queue in runPlayer(), so the
		// installed main loop must stay inert and must not touch Memory.
		// The polyfill registers `InterShardMemory` on the sandbox global
		// the first time `require('main')` runs (warmup tick), so console
		// expressions in subsequent runPlayer calls observe the API.
		const loopCode = `${INTER_SHARD_MEMORY_POLYFILL}\nmodule.exports.loop = function () {};`;
		const shardCodeTimestamp = ++sharedUserCodeTimestamp;

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
			// Default to high processed account power so existing power creep
			// tests can create and upgrade power creeps. GPL-specific tests set
			// this explicitly to exercise vanilla's Game.gpl formula.
			const power = playerSpec.power ?? 10000000;

			// Insert user directly
			const user = await this.db.users.insert({
				username,
				cpu: 100,
				cpuAvailable: 10000,
				gcl,
				power,
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
					timestamp: shardCodeTimestamp,
				}),
			]);

			// Set controller ownership for all rooms this player owns
			for (const ownedRoom of ownedRooms) {
				const gameTime = await this.server.world.gameTime;
				const rcl = ownedRoom.rcl ?? 1;
				const C = this.server.constants;
				const downgradeTime = ownedRoom.ticksToDowngrade != null
					? gameTime + ownedRoom.ticksToDowngrade + 1
					: rcl > 0
						? gameTime + (C.CONTROLLER_DOWNGRADE?.[rcl] ?? 0) + 1
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
						level: rcl,
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
		// runPlayer call may fail silently. The runner patch above watches
		// the terrain revision. createShard and pre-tick setTerrain also
		// bump user code timestamps so warmed VMs restart with that terrain.
		await guardedTick(this.server);
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
		if (STRUCTURE_TYPES_PLACE_OBJECT_ONLY.has(spec.structureType)) {
			throw new Error(
				`placeStructure: structureType '${spec.structureType}' must be placed with placeObject().`,
			);
		}
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
		if (spec.level !== undefined) attrs.level = spec.level;
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

		let gameTime: number | undefined;
		const currentGameTime = async () => gameTime ??= await this.server.world.gameTime;
		if (spec.ticksToDecay !== undefined) {
			attrs.nextDecayTime = await currentGameTime() + spec.ticksToDecay;
		} else {
			const defaultDecayTime = this.getDefaultDecayTime(spec.structureType, rcl);
			if (defaultDecayTime !== null) {
				attrs.nextDecayTime = await currentGameTime() + defaultDecayTime;
			}
		}
		if (spec.cooldown !== undefined) {
			const gameTime = await currentGameTime();
			if (spec.structureType === 'link') {
				attrs.cooldown = spec.cooldown;
			} else {
				attrs.cooldownTime = gameTime + spec.cooldown;
			}
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
		if (/[|~]/.test(spec.name)) {
			throw new Error(`placeFlag: flag name cannot contain '|' or '~': ${spec.name}`);
		}
		const color = spec.color ?? 1;
		const secondaryColor = spec.secondaryColor ?? color;
		const entry = `${spec.name}~${color}~${secondaryColor}~${spec.pos[0]}~${spec.pos[1]}`;

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
		const name = spec.name ?? `PowerCreep_${this.nextId()}`;

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
			// spec.decayTime is relative ticks (consistent with deposit/powerBank
			// below). Vanilla persists `decayTime` as the absolute tick of expiry;
			// null means a permanent portal.
			const gameTime = await this.server.world.gameTime;
			const decayTime = (spec.decayTime as number)
				? gameTime + (spec.decayTime as number)
				: null;
			const result = await this.db['rooms.objects'].insert({
				room: roomName,
				type: 'portal',
				x: pos[0],
				y: pos[1],
				destination,
				unstableDate: spec.unstableDate ?? null,
				decayTime,
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
			const C = this.server.constants;
			const insert: Record<string, unknown> = {
				room: roomName,
				type: 'invaderCore',
				x: pos[0],
				y: pos[1],
				level,
				user: (spec.user as string) ?? '2',
				hits: (spec.hits as number) ?? (C.INVADER_CORE_HITS ?? 100000),
				hitsMax: (spec.hitsMax as number) ?? (C.INVADER_CORE_HITS ?? 100000),
				deployTime,
				effects: spec.effects ?? [],
			};
			if (spec.templateName !== undefined) insert.templateName = spec.templateName;
			if (spec.strongholdId !== undefined) insert.strongholdId = spec.strongholdId;
			const result = await this.db['rooms.objects'].insert(insert);
			await this.db.rooms.update({ _id: roomName }, { $set: { active: true } });
			await this.env.sadd(this.env.keys.ACTIVE_ROOMS, [roomName]);
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
		// The vanilla runner can refresh terrain before the first
		// user-facing tick by observing our terrain revision key. After a
		// user tick, refreshing would reset player VMs and pathfinder state
		// mid-shard, so the adapter rejects the mutation explicitly.
		if (this.firstTickRun) {
			throw new Error(
				`vanilla adapter: setTerrain('${room}') called after a user-facing tick. ` +
				`Refreshing terrain after player code has run would require resetting ` +
				`the vanilla runtime's player VMs and pathfinder state mid-shard. ` +
				`Pass terrain via RoomSpec.terrain at createShard time, or call ` +
				`setTerrain before the first runPlayer/tick.`,
			);
		}
		await this.server.world.setTerrain(room, buildTerrain(withCornerWalls(terrain)));
		await this.publishTerrainRevision();
		await this.bumpUserCodeTimestamps();
	}

	async runPlayer(handle: string, playerCode: PlayerCode): Promise<PlayerReturnValue> {
		const user = this.users.get(handle);
		if (!user) throw new Error(`Unknown player: ${handle}`);

		const codeStr = String(playerCode).trimEnd().replace(/;$/, '');
		const nonce = this.nextRunNonce();
		const botId = this.resolvePlayer(handle);

		const capture = this.captureRunResult(handle, user, nonce);
		try {
			await this.db['users.console'].insert({
				user: botId,
				expression: this.buildConsoleCommand(codeStr, nonce),
				hidden: false,
			});
			await guardedTick(this.server);
			this.firstTickRun = true;
			return this.parseRunResult('runPlayer', handle, await capture.wait());
		} finally {
			capture.dispose();
		}
	}

	async runPlayers(codesByUser: Record<string, PlayerCode>): Promise<Record<string, PlayerReturnValue>> {
		const handles = Object.keys(codesByUser);
		for (const handle of handles) {
			if (!this.users.get(handle)) throw new Error(`Unknown player: ${handle}`);
		}

		const nonces = new Map(handles.map(handle => [handle, this.nextRunNonce()]));
		const captures = new Map<string, ResultCapture>();
		try {
			for (const handle of handles) {
				captures.set(handle, this.captureRunResult(handle, this.users.get(handle), nonces.get(handle)!));
			}
			for (const handle of handles) {
				const codeStr = String(codesByUser[handle]).trimEnd().replace(/;$/, '');
				await this.db['users.console'].insert({
					user: this.resolvePlayer(handle),
					expression: this.buildConsoleCommand(codeStr, nonces.get(handle)!),
					hidden: false,
				});
			}
			await guardedTick(this.server);
			this.firstTickRun = true;

			const resultJsonByHandle = new Map<string, string | undefined>();
			await Promise.all(handles.map(async handle => {
				resultJsonByHandle.set(handle, await captures.get(handle)!.wait());
			}));

			const results: Record<string, PlayerReturnValue> = {};
			for (const handle of handles) {
				results[handle] = this.parseRunResult('runPlayers', handle, resultJsonByHandle.get(handle));
			}
			return results;
		} finally {
			for (const capture of captures.values()) capture.dispose();
		}
	}

	async tick(count = 1): Promise<void> {
		for (let i = 0; i < count; i++) {
			await guardedTick(this.server);
		}
		if (count > 0) this.firstTickRun = true;
	}

	async getObject(id: string): Promise<ObjectSnapshot | null> {
		const obj = await this.db['rooms.objects'].findOne({ _id: id });
		if (!obj) return null;
		const gameTime = await this.server.world.gameTime;
		return snapshotObject(obj, this, gameTime, this.server.constants);
	}

	async findInRoom(roomName: string, type: number): Promise<any[]> {
		const objects = await this.server.world.roomObjects(roomName);
		const gameTime = await this.server.world.gameTime;
		return snapshotRoomObjects(objects, selectorFromFindConstant(type), this, gameTime, this.server.constants);
	}

	async getGameTime(): Promise<number> {
		return this.server.world.gameTime;
	}

	async captureActionLog(roomName: string): Promise<RoomActionLogCapture> {
		// `gameTime` is post-increment after the tick that ran the action,
		// matching xxscreeps's `shard.time` convention. The history hash field
		// for the just-processed tick is `gameTime - 1` (driver/history.js
		// `saveTick(roomId, gameTime, data)` writes the field with the gameTime
		// value the processor saw, which is incremented in the global stage).
		const tick = await this.server.world.gameTime;
		const previousTime = tick - 1;
		const historyKey = this.env.keys.ROOM_HISTORY + roomName;
		const history = await this.env.get(historyKey);
		const serialized = history?.[String(previousTime)] ?? history?.[previousTime];
		const rawObjects = typeof serialized === 'string'
			? JSON.parse(serialized) as Record<string, any>
			: {};

		const objects: RoomActionLogCapture['objects'] = [];
		for (const object of Object.values(rawObjects)) {
			const actionLog = normalizeActionLog(object.actionLog);
			if (Object.keys(actionLog).length === 0) continue;
			objects.push({
				room: roomName,
				tick,
				id: String(object._id),
				type: String(object.type),
				...(object.structureType ? { structureType: String(object.structureType) } : {}),
				...(object.name ? { name: String(object.name) } : {}),
				pos: {
					x: Number(object.x),
					y: Number(object.y),
					roomName: String(object.room ?? roomName),
				},
				actionLog,
			});
		}

		return { room: roomName, tick, objects: sortedActionLogObjects(objects) };
	}

	async setInvaderRaidState(roomName: string, spec: InvaderRaidRoomStateSpec): Promise<void> {
		if (!this.db || !this.env || !this.server) {
			throw new Error('setInvaderRaidState: createShard() must be called first');
		}
		const room = await this.db.rooms.findOne({ _id: roomName });
		if (!room) throw new Error(`setInvaderRaidState: unknown room '${roomName}'`);

		const roomSet: Record<string, unknown> = {};
		if (spec.raidGoal !== undefined) roomSet.invaderGoal = spec.raidGoal;
		if (spec.status !== undefined) roomSet.status = spec.status;
		if (Object.keys(roomSet).length > 0) {
			await this.db.rooms.update({ _id: roomName }, { $set: roomSet });
		}

		if (spec.harvestedEnergy !== undefined) {
			if (!Number.isFinite(spec.harvestedEnergy) || spec.harvestedEnergy < 0) {
				throw new Error(`setInvaderRaidState: harvestedEnergy must be non-negative, got ${spec.harvestedEnergy}`);
			}
			const sources = await this.db['rooms.objects'].find({ room: roomName, type: 'source' });
			if (sources.length === 0 && spec.harvestedEnergy > 0) {
				throw new Error(`setInvaderRaidState: cannot seed harvestedEnergy for '${roomName}' without a source`);
			}
			if (sources.length > 0) {
				await this.db['rooms.objects'].update(
					{ room: roomName, type: 'source' },
					{ $set: { invaderHarvested: 0 } },
				);
				await this.db['rooms.objects'].update(
					{ _id: sources[0]._id },
					{ $set: { invaderHarvested: spec.harvestedEnergy } },
				);
			}
		}

		if (spec.controllerReservation !== undefined) {
			const controller = await this.db['rooms.objects'].findOne({ room: roomName, type: 'controller' });
			if (!controller && spec.controllerReservation) {
				throw new Error(`setInvaderRaidState: room '${roomName}' has no controller to reserve`);
			}
			if (controller) {
				const reservation = spec.controllerReservation
					? {
						user: this.resolvePlayer(spec.controllerReservation.owner),
						endTime: await this.server.world.gameTime + (spec.controllerReservation.ticksToEnd ?? 5000),
					}
					: null;
				await this.db['rooms.objects'].update(
					{ _id: controller._id },
					{ $set: { reservation } },
				);
			}
		}

		if (spec.active !== undefined) {
			await this.setRoomActive(roomName, spec.active);
		}
	}

	async runInvaderRaidSpawner(options: InvaderRaidSpawnerOptions = {}): Promise<void> {
		if (!this.db || !this.env || !this.server) {
			throw new Error('runInvaderRaidSpawner: createShard() must be called first');
		}
		const common = nodeRequire('@screeps/common') as {
			configManager: { config: { cronjobs?: Record<string, unknown[]> } };
		};
		nodeRequire('@screeps/backend/lib/cronjobs.js');
		const job = common.configManager.config.cronjobs?.genInvaders?.[1];
		if (typeof job !== 'function') {
			throw new Error('runInvaderRaidSpawner: vanilla genInvaders cronjob is not registered');
		}

		const originalRandom = Math.random;
		let randomIndex = 0;
		if (options.random) {
			Math.random = () => {
				if (!options.random || randomIndex >= options.random.length) {
					throw new Error('runInvaderRaidSpawner: deterministic random sequence exhausted');
				}
				const value = options.random[randomIndex++];
				if (!Number.isFinite(value) || value < 0 || value >= 1) {
					throw new Error(`runInvaderRaidSpawner: random[${randomIndex - 1}] must be in [0, 1), got ${value}`);
				}
				return value;
			};
		}
		try {
			await job();
		} finally {
			Math.random = originalRandom;
		}
	}

	async clearInvaderRaidCreeps(roomName: string): Promise<void> {
		if (!this.db) throw new Error('clearInvaderRaidCreeps: createShard() must be called first');
		await this.db['rooms.objects'].removeWhere({ room: roomName, type: 'creep', user: '2' });
	}

	async getControllerPos(room: string): Promise<{ x: number; y: number } | null> {
		const controller = await this.db['rooms.objects'].findOne({ room, type: 'controller' });
		return controller ? { x: controller.x, y: controller.y } : null;
	}

	async teardown(): Promise<void> {
		this.playerMap.clear();
		this.reversePlayerMap.clear();
		this.users.clear();
		this.rooms = [];
		this.db = null;
		this.env = null;
		this.idCounter = 0;
		this.runCounter = 0;
		this.firstTickRun = false;
	}

	private getProgressTotal(structureType: string): number {
		const C = this.server.constants;
		return C?.CONSTRUCTION_COST?.[structureType] ?? 300;
	}

	private async setRoomActive(roomName: string, active: boolean): Promise<void> {
		await this.db.rooms.update({ _id: roomName }, { $set: { active } });
		const key = this.env.keys.ACTIVE_ROOMS;
		const activeRooms = new Set<string>(await this.env.smembers(key));
		if (active) activeRooms.add(roomName);
		else activeRooms.delete(roomName);
		await this.env.del(key);
		for (const activeRoom of activeRooms) {
			await this.env.sadd(key, activeRoom);
		}
	}

	private async getRoomRcl(roomName: string): Promise<number> {
		const ctrl = await this.db['rooms.objects'].findOne({
			$and: [{ room: roomName }, { type: 'controller' }],
		});
		return ctrl?.level ?? 0;
	}

	private getDefaultDecayTime(structureType: string, rcl: number): number | null {
		const C = this.server.constants;
		switch (structureType) {
			case 'container':
				return rcl > 0 ? C.CONTAINER_DECAY_TIME_OWNED : C.CONTAINER_DECAY_TIME;
			case 'road':
				return C.ROAD_DECAY_TIME;
			case 'rampart':
				return C.RAMPART_DECAY_TIME;
			default:
				return null;
		}
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
			};
			case 'road': return {
				hits: C.ROAD_HITS, hitsMax: C.ROAD_HITS,
			};
			case 'constructedWall': return {
				hits: 1, hitsMax: C.WALL_HITS_MAX,
			};
			case 'rampart': return {
				hits: 1, hitsMax: C.RAMPART_HITS_MAX?.[8] ?? 300000000,
				isPublic: false,
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
