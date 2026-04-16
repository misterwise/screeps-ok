/**
 * xxscreeps sandbox-per-user driver.
 *
 * Closes the `flagSupport` / `memorySupport` limitations by running each
 * user's code inside a real xxscreeps `NodejsSandbox` (`vm.createContext`
 * under the hood). Each sandbox has its own module-level state for
 * `mods/flag/game.ts`'s `flags`, `mods/memory/memory.ts`'s `memory`, etc.
 *
 * The adapter's job here is translation: acquire the engine's own
 * `runnerConnector` handlers, drive the engine's own `Sandbox.run`, and
 * let each mod own its DB persistence via `save()`. No direct DB writes,
 * no hook fingerprinting, no synthetic blobs.
 *
 * Exempt from `engine-internals-policy.md` Rule 3 (same as the inlined
 * `createSimulation` fork) — this is engine-level orchestration, not
 * `#`-field poking.
 */

import type { Shard } from 'xxscreeps/engine/db/index.js';
import type { World } from 'xxscreeps/game/map.js';
import type { Sandbox } from 'xxscreeps/driver/sandbox/index.js';
import type { Effect } from 'xxscreeps/utility/types.js';
import config from 'xxscreeps/config/index.js';
import { createSandbox } from 'xxscreeps/driver/sandbox/index.js';
import { hooks as runnerHooks } from 'xxscreeps/engine/runner/index.js';
import * as Code from 'xxscreeps/engine/db/user/code.js';
import * as User from 'xxscreeps/engine/db/user/index.js';
import { acquire } from 'xxscreeps/utility/async.js';
import { Fn } from 'xxscreeps/functional/fn.js';
import { RunPlayerError } from '../../src/errors.js';
import type { PlayerReturnValue } from '../../src/adapter.js';

// NodejsSandbox (vm.createContext) rather than IsolatedSandbox
// (requires the native isolated-vm binding).
config.runner.unsafeSandbox = true;

// Shared main.js: empty loop. Per-call test code is delivered via
// `TickPayload.eval` and returned via `evalAck`.
const kMainCode = 'module.exports.loop = () => {};';
const kBranchName = 'main';

type Connectors = {
	initialize: (payload: any) => Promise<unknown>;
	refresh: (payload: any) => Promise<unknown>;
	save: (payload: any) => Promise<unknown>;
};

export type RunOptions = {
	time: number;
	roomBlobs: Readonly<Uint8Array>[];
	usernames?: Record<string, string>;
	// Offset added to `payload.gcl` after runnerConnector.refresh reads the
	// raw DB progress value. Pass `gclLevelToProgress(desiredLevel)` so the
	// controller mod's gameInitializer produces `Game.gcl.level = desiredLevel`
	// while `Game.gcl.progress` still reflects the DB delta the processor
	// maintains (upgradeController increments it).
	gclBaseline?: number;
	// Replaces `payload.controlledRoomCount` after refresh. The engine's
	// `processorHooks.refreshRoom` populates `user/<id>/controlledRooms`
	// scratch set, but that only fires inside the processor worker — not
	// from the adapter's in-process createSimulation. Pass the adapter's
	// authoritative count (from `shardSpec.rooms.filter(owner===userId)`).
	controlledRoomCount?: number;
};

export type RunResult = {
	value: PlayerReturnValue;
	intentPayloads: Record<string, any>;
};

export class UserSandbox {
	private constructor(
		private readonly shard: Shard,
		private readonly sandbox: Sandbox,
		private readonly connectors: Connectors,
		private readonly cleanup: Effect | undefined,
	) {}

	private usernameCache?: Record<string, string>;

	private async loadUsernames(): Promise<Record<string, string>> {
		if (this.usernameCache) return this.usernameCache;
		// Mirror `engine/runner/instance.ts:180-197` without reaching into
		// Room's `#users` field: populate the map from the user registry
		// directly. In tests this is a small set (players + Screeps/Invader/
		// Source Keeper npcs) so scanning all users is cheap.
		const userIds = await this.shard.db.data.smembers('users');
		const entries = await Promise.all(userIds.map(async uid => {
			const name = await this.shard.db.data.hget(User.infoKey(uid), 'username');
			return [uid, name ?? ''] as const;
		}));
		this.usernameCache = Object.fromEntries(entries);
		return this.usernameCache;
	}

	static async create(shard: Shard, world: World, userId: string): Promise<UserSandbox> {
		// Ensure a main.js exists so `requireMain()` resolves to an empty loop.
		await Code.saveContent(shard.db, userId, kBranchName, new Map([
			['main.js', kMainCode],
		]));

		// Acquire runnerConnector handlers. Registered mods (flag, memory,
		// visual, controller) only read { shard, userId, world } from the
		// passed-in context, so a minimal object satisfies the interface.
		const context = { shard, userId, world } as any;
		const connectorPromises = [...runnerHooks.map('runnerConnector', hook => hook(context))];
		const [effect, connectors] = await acquire(...connectorPromises);
		const initialize = [...Fn.filter(Fn.map(connectors, c => c.initialize))];
		const refresh = [...Fn.filter(Fn.map(connectors, c => c.refresh))];
		const save = [...Fn.filter(Fn.map(connectors, c => c.save))].reverse();
		const handlers: Connectors = {
			initialize: payload => Promise.all(Fn.map(initialize, fn => fn(payload))),
			refresh: payload => Promise.all(Fn.map(refresh, fn => fn(payload))),
			save: payload => Promise.all(Fn.map(save, fn => fn(payload))),
		};

		// Build init payload — connectors fill flagBlob, memoryBlob in-place.
		const initPayload: any = {
			userId,
			shardName: shard.name,
			terrainBlob: world.terrainBlob,
		};
		await handlers.initialize(initPayload);
		initPayload.codeBlob = await Code.loadBlobs(shard.db, userId, kBranchName);

		const sandbox = await createSandbox(userId, initPayload);
		return new UserSandbox(shard, sandbox, handlers, effect);
	}

	async run(codeSource: string, opts: RunOptions): Promise<RunResult> {
		const ackId = 'r';
		const usernames = opts.usernames ?? await this.loadUsernames();
		const tickPayload: any = {
			cpu: { bucket: 10000, limit: 20, tickLimit: 500 },
			time: opts.time,
			roomBlobs: opts.roomBlobs,
			eval: [{ expr: buildWrappedExpr(codeSource), ack: ackId }],
			usernames,
			gcl: 0,
			controlledRoomCount: 0,
		};
		// Mods populate payload fields from shard state (flag/memory blobs,
		// controller's gcl/controlledRoomCount, etc.). Run refresh first…
		await this.connectors.refresh(tickPayload);
		// …then apply adapter-side adjustments. `gclBaseline` is ADDED so the
		// DB-derived progress (from refresh) is preserved; `controlledRoomCount`
		// is REPLACED because the processor refresh path that would maintain
		// `user/<id>/controlledRooms` only fires inside a real processor worker.
		if (opts.gclBaseline) tickPayload.gcl = opts.gclBaseline + tickPayload.gcl;
		if (opts.controlledRoomCount !== undefined) tickPayload.controlledRoomCount = opts.controlledRoomCount;

		const result = await this.sandbox.run(tickPayload);
		if (result.result !== 'success') {
			const consoleMsg = (result as any).console ?? '';
			throw new RunPlayerError('runtime', `sandbox ${result.result}: ${consoleMsg}`);
		}

		await this.connectors.save(result.payload);

		const evalAck = result.payload.evalAck?.find((a: any) => a.id === ackId);
		if (!evalAck) {
			throw new RunPlayerError('runtime', 'sandbox eval: no ack returned');
		}
		if (evalAck.result.error) {
			// The outer wrapper always succeeds — if this fires, something
			// unexpected happened in the wrapper itself.
			throw new RunPlayerError('runtime', String(evalAck.result.value));
		}
		const inner = JSON.parse(String(evalAck.result.value));
		if (inner._kind === 'error') {
			const kind = inner.name === 'SyntaxError' ? 'syntax' : 'runtime';
			throw new RunPlayerError(kind, inner.message);
		}
		if (inner._kind === 'serialization') {
			throw new RunPlayerError('serialization', inner.message);
		}
		return {
			value: inner.value,
			intentPayloads: result.payload.intentPayloads ?? {},
		};
	}

	dispose(): void {
		this.sandbox.dispose();
		this.cleanup?.();
	}
}

function buildWrappedExpr(userCode: string): string {
	// Wrap user code so:
	//   - parse/runtime errors are caught inside the sandbox and the
	//     error's constructor name is preserved (SyntaxError vs other).
	//   - non-plain return objects are flagged as serialization errors.
	//   - the result is JSON-stringified to cross the vm-context boundary
	//     losslessly for JSON-safe values.
	// `undefined` returns are normalized to `null` — the adapter contract
	// treats 'no return' as null.
	const src = JSON.stringify(userCode);
	return `JSON.stringify((() => {
		try {
			const _r = eval(${src});
			if (typeof _r === 'function' || typeof _r === 'symbol') {
				return { _kind: 'serialization', message: 'Return value is a ' + typeof _r + ', not a plain JSON value' };
			}
			if (_r !== null && typeof _r === 'object') {
				const _c = _r.constructor;
				if (!Array.isArray(_r) && _c !== Object && _c !== undefined) {
					return { _kind: 'serialization', message: 'Return value is a ' + ((_c && _c.name) || 'non-plain') + ' object, not a plain JSON value' };
				}
				try { JSON.stringify(_r); }
				catch { return { _kind: 'serialization', message: 'Return value is not JSON-serializable' }; }
			}
			return { _kind: 'ok', value: _r === undefined ? null : _r };
		} catch (e) {
			return { _kind: 'error', name: (e && e.constructor && e.constructor.name) || 'Error', message: String((e && e.message) || e) };
		}
	})())`;
}
