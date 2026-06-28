/**
 * screeps-ok adapter for the Rust Screeps engine.
 *
 * Bridges the `ScreepsOkAdapter` interface to the engine's `adapter` binary
 * (built with `cargo build --features v8 --bin adapter`) over line-delimited
 * JSON on stdin/stdout. Each adapter method sends one command and awaits one
 * reply; the Rust side processes commands strictly sequentially.
 *
 * Most capabilities are reported false on purpose: this is an early engine, and
 * unsupported feature areas should SKIP (via `shard.requires(...)`) rather than
 * fail. Flip a capability to true only once the corresponding engine path works
 * end-to-end.
 */
import { spawn, type ChildProcessByStdio } from 'node:child_process';
import type { Writable, Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createInterface, type Interface } from 'node:readline';
import type {
	ScreepsOkAdapter, AdapterCapabilities, ShardSpec, PlayerReturnValue,
	RoomActionLogCapture, CreepSpec, StructureSpec, SiteSpec, SourceSpec,
	MineralSpec, FlagSpec, TombstoneSpec, RuinSpec, DroppedResourceSpec,
	PowerCreepSpec, NukeSpec, MarketOrderSpec, TerrainSpec,
	InvaderRaidRoomStateSpec, InvaderRaidSpawnerOptions, TickOptions,
} from '../../src/adapter.js';
import type { ObjectSnapshot } from '../../src/snapshots/common.js';
import type { PlayerCode } from '../../src/code.js';
import { RunPlayerError } from '../../src/errors.js';

const here = dirname(fileURLToPath(import.meta.url));
// adapters/rust/ -> screeps-ok/ -> screeps_repos/ -> rust_engine/target/debug/adapter
const DEFAULT_BIN = resolve(here, '../../../rust_engine/target/debug/adapter');
const BIN = process.env.RUST_ENGINE_ADAPTER_BIN ?? DEFAULT_BIN;

interface Reply {
	ok: boolean;
	result?: unknown;
	error?: string;
}

class RustAdapter implements ScreepsOkAdapter {
	readonly capabilities: AdapterCapabilities = {
		chemistry: true,
		powerCreeps: true,
		powerSpawn: true,
		factory: true,
		market: true,
		observer: true,
		nuke: true,
		deposit: true,
		// Terrain mutation is wired in the engine, but PathFinder / Room.getTerrain
		// observability through player code is not, so terrain assertions can't pass
		// honestly yet — keep false so terrain tests SKIP rather than fail.
		terrain: true,
		roomStatus: false,
		portals: false,
		invaderCore: false,
		invaderRaidSpawner: false,
		multiShard: false,
		interShardMemory: false,
		cpuShardLimits: false,
		liveWorldSize: false,
		actionLogCapture: false,
		randomInjection: false,
		deprecationNotices: false,
	};

	private proc: ChildProcessByStdio<Writable, Readable, null>;
	private rl: Interface;
	private pending: Array<(reply: Reply) => void> = [];
	private buffer: Reply[] = [];

	constructor() {
		this.proc = spawn(BIN, [], { stdio: ['pipe', 'pipe', 'inherit'] });
		this.proc.on('error', (err) => {
			const e = err as NodeJS.ErrnoException;
			const hint = e.code === 'ENOENT'
				? ` (binary not found at ${BIN}; build it with ` +
				  `\`cargo build --features v8 --bin adapter\` in rust_engine)`
				: '';
			this.failAll(new Error(`rust adapter process error: ${e.message}${hint}`));
		});
		this.proc.on('exit', (code) => {
			if (this.pending.length > 0) {
				this.failAll(new Error(`rust adapter process exited (code ${code})`));
			}
		});
		this.rl = createInterface({ input: this.proc.stdout });
		this.rl.on('line', (line) => {
			const trimmed = line.trim();
			if (!trimmed) return;
			let reply: Reply;
			try {
				reply = JSON.parse(trimmed) as Reply;
			} catch {
				return; // ignore non-JSON noise on stdout
			}
			const resolver = this.pending.shift();
			if (resolver) resolver(reply);
			else this.buffer.push(reply);
		});
	}

	private failAll(err: Error): void {
		const waiters = this.pending.splice(0);
		for (const w of waiters) w({ ok: false, error: err.message });
	}

	private send(cmd: string, extra: Record<string, unknown> = {}): Promise<unknown> {
		return new Promise((resolveReply, reject) => {
			const resolver = (reply: Reply) => {
				if (reply.ok) resolveReply(reply.result);
				else reject(new Error(reply.error ?? 'rust adapter error'));
			};
			const buffered = this.buffer.shift();
			if (buffered) { resolver(buffered); return; }
			this.pending.push(resolver);
			this.proc.stdin.write(JSON.stringify({ cmd, ...extra }) + '\n');
		});
	}

	async createShard(spec: ShardSpec): Promise<void> {
		await this.send('createShard', { spec });
	}

	async placeCreep(room: string, spec: CreepSpec): Promise<string> {
		return this.send('placeCreep', { room, spec }) as Promise<string>;
	}
	async placeStructure(room: string, spec: StructureSpec): Promise<string> {
		return this.send('placeStructure', { room, spec }) as Promise<string>;
	}
	async placeSite(room: string, spec: SiteSpec): Promise<string> {
		return this.send('placeSite', { room, spec }) as Promise<string>;
	}
	async placeSource(room: string, spec: SourceSpec): Promise<string> {
		return this.send('placeSource', { room, spec }) as Promise<string>;
	}
	async placeMineral(room: string, spec: MineralSpec): Promise<string> {
		return this.send('placeMineral', { room, spec }) as Promise<string>;
	}
	async placeFlag(room: string, spec: FlagSpec): Promise<string> {
		return this.send('placeFlag', { room, spec }) as Promise<string>;
	}
	async placeTombstone(room: string, spec: TombstoneSpec): Promise<string> {
		return this.send('placeTombstone', { room, spec }) as Promise<string>;
	}
	async placeRuin(room: string, spec: RuinSpec): Promise<string> {
		return this.send('placeRuin', { room, spec }) as Promise<string>;
	}
	async placeDroppedResource(room: string, spec: DroppedResourceSpec): Promise<string> {
		return this.send('placeDroppedResource', { room, spec }) as Promise<string>;
	}
	async placePowerCreep(room: string, spec: PowerCreepSpec): Promise<string> {
		return this.send('placePowerCreep', { room, spec }) as Promise<string>;
	}
	async placeNuke(room: string, spec: NukeSpec): Promise<string> {
		return this.send('placeNuke', { room, spec }) as Promise<string>;
	}
	async placeMarketOrder(spec: MarketOrderSpec): Promise<string> {
		return this.send('placeMarketOrder', { spec }) as Promise<string>;
	}
	async placeObject(room: string, type: string, spec: Record<string, unknown>): Promise<string> {
		return this.send('placeObject', { room, type, spec }) as Promise<string>;
	}

	async setTerrain(room: string, terrain: TerrainSpec): Promise<void> {
		await this.send('setTerrain', { room, terrain });
	}

	async runPlayer(userId: string, playerCode: PlayerCode): Promise<PlayerReturnValue> {
		const result = await this.send('runPlayer', { handle: userId, code: String(playerCode) }) as
			{ returnValue?: PlayerReturnValue; errorKind?: string; message?: string };
		if (result.errorKind) {
			throw new RunPlayerError(
				result.errorKind as 'syntax' | 'runtime' | 'serialization',
				result.message ?? '',
			);
		}
		return result.returnValue ?? null;
	}

	async runPlayers(codesByUser: Record<string, PlayerCode>): Promise<Record<string, PlayerReturnValue>> {
		const codes: Record<string, string> = {};
		for (const [k, v] of Object.entries(codesByUser)) codes[k] = String(v);
		const result = await this.send('runPlayers', { codes }) as
			{ results?: Record<string, PlayerReturnValue>; errorKind?: string; message?: string };
		if (result.errorKind) {
			throw new RunPlayerError(
				result.errorKind as 'syntax' | 'runtime' | 'serialization',
				result.message ?? '',
			);
		}
		const out = result.results ?? {};
		for (const k of Object.keys(out)) out[k] = out[k] ?? null;
		return out;
	}

	async tick(count = 1, options: TickOptions = {}): Promise<void> {
		if (options.random) {
			throw new Error('rust adapter does not support deterministic random injection');
		}
		await this.send('tick', { count });
	}

	async getObject(id: string): Promise<ObjectSnapshot | null> {
		return this.send('getObject', { id }) as Promise<ObjectSnapshot | null>;
	}

	async findInRoom(room: string, type: number): Promise<any[]> {
		return this.send('findInRoom', { room, findType: type }) as Promise<any[]>;
	}

	async getGameTime(): Promise<number> {
		return this.send('getGameTime') as Promise<number>;
	}

	async captureActionLog(room: string): Promise<RoomActionLogCapture> {
		return this.send('captureActionLog', { room }) as Promise<RoomActionLogCapture>;
	}

	async setInvaderRaidState(_room: string, _spec: InvaderRaidRoomStateSpec): Promise<void> {
		throw new Error('rust adapter does not support invaderRaidSpawner');
	}
	async runInvaderRaidSpawner(_options?: InvaderRaidSpawnerOptions): Promise<void> {
		throw new Error('rust adapter does not support invaderRaidSpawner');
	}
	async clearInvaderRaidCreeps(_room: string): Promise<void> {
		throw new Error('rust adapter does not support invaderRaidSpawner');
	}

	async getControllerPos(room: string): Promise<{ x: number; y: number } | null> {
		return this.send('getControllerPos', { room }) as Promise<{ x: number; y: number } | null>;
	}

	async captureConsoleLogs(handle: string): Promise<string[]> {
		return this.send('captureConsoleLogs', { handle }) as Promise<string[]>;
	}

	async teardown(): Promise<void> {
		try {
			await Promise.race([
				this.send('teardown'),
				new Promise((r) => setTimeout(r, 500)),
			]);
		} catch {
			// ignore
		}
		this.rl.close();
		if (!this.proc.killed) this.proc.kill();
	}
}

export async function createAdapter(): Promise<ScreepsOkAdapter> {
	return new RustAdapter();
}
