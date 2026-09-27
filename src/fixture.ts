import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base, describe, expect, type RunnerTask, type RunnerTestCase } from 'vitest';
import { baseCatalogId, testCatalogId } from '../scripts/lib/catalog-id.js';
import { parseCatalog } from '../scripts/lib/parse-catalog.js';
import { loadParity, registrationFor, type Parity } from '../scripts/lib/parity.js';
import type { ScreepsOkAdapter, PlayerReturnValue, CapabilityName, TickOptions } from './adapter.js';
import type { PlayerCode } from './code.js';
import { RunPlayerError, type RunPlayerErrorKind } from './errors.js';
import { toLabelToken, type ValidationCase } from './matrices/validation-cases.js';
import type {
	ObjectSnapshot, CreepSnapshot, StructureSnapshot,
	SiteSnapshot, SourceSnapshot, MineralSnapshot,
	DepositSnapshot, TombstoneSnapshot, RuinSnapshot, DroppedResourceSnapshot,
	ControllerSnapshot, SpawnSnapshot, LabSnapshot, TowerSnapshot,
	StorageSnapshot, LinkSnapshot, RampartSnapshot,
	TerminalSnapshot, FactorySnapshot, ExtensionSnapshot,
	ContainerSnapshot, ExtractorSnapshot, RoadSnapshot,
	NukerSnapshot, PowerSpawnSnapshot, ObserverSnapshot,
	KeeperLairSnapshot, InvaderCoreSnapshot, PowerBankSnapshot,
	PortalSnapshot, WallSnapshot,
} from './snapshots/common.js';

type AdapterFactory = { createAdapter(): Promise<ScreepsOkAdapter> };

let adapterModule: AdapterFactory | undefined;
let parity: Parity | undefined;

function adapterPath(): string {
	const adapterPath = process.env.SCREEPS_OK_ADAPTER;
	if (!adapterPath) {
		throw new Error(
			'SCREEPS_OK_ADAPTER env var not set. Point it at an adapter module ' +
			'(e.g., SCREEPS_OK_ADAPTER=./adapters/xxscreeps/index.ts)'
		);
	}
	// Resolve relative to project root, not to vite-node internals
	return resolve(process.cwd(), adapterPath);
}

async function getAdapterModule(): Promise<AdapterFactory> {
	adapterModule ??= await import(adapterPath()) as AdapterFactory;
	return adapterModule;
}

// ── Snapshot kind → type mapping ────────────────────────────

type KindMap = {
	creep: CreepSnapshot;
	structure: StructureSnapshot;
	site: SiteSnapshot;
	source: SourceSnapshot;
	mineral: MineralSnapshot;
	deposit: DepositSnapshot;
	tombstone: TombstoneSnapshot;
	ruin: RuinSnapshot;
	resource: DroppedResourceSnapshot;
};

type StructureTypeMap = {
	controller: ControllerSnapshot;
	spawn: SpawnSnapshot;
	lab: LabSnapshot;
	tower: TowerSnapshot;
	storage: StorageSnapshot;
	link: LinkSnapshot;
	rampart: RampartSnapshot;
	terminal: TerminalSnapshot;
	factory: FactorySnapshot;
	extension: ExtensionSnapshot;
	container: ContainerSnapshot;
	extractor: ExtractorSnapshot;
	road: RoadSnapshot;
	nuker: NukerSnapshot;
	powerSpawn: PowerSpawnSnapshot;
	observer: ObserverSnapshot;
	keeperLair: KeeperLairSnapshot;
	invaderCore: InvaderCoreSnapshot;
	powerBank: PowerBankSnapshot;
	portal: PortalSnapshot;
	constructedWall: WallSnapshot;
};

// ── Shard wrapper with test helpers ─────────────────────────

export interface ShardFixture extends ScreepsOkAdapter {
	/**
	 * Shorthand for createShard with a single player owning a single room.
	 *
	 *   await shard.ownedRoom('p1');                  // W1N1, rcl 1
	 *   await shard.ownedRoom('p1', 'W3N3');          // W3N3, rcl 1
	 *   await shard.ownedRoom('p1', 'W3N3', 8);       // W3N3, rcl 8
	 */
	ownedRoom(player: string, roomName?: string, rcl?: number): Promise<void>;

	/**
	 * Get an object by ID and assert it exists with the expected kind.
	 * Throws (fails the test) if null or wrong kind — no silent passes.
	 *
	 *   const creep = await shard.expectObject(id, 'creep');
	 *   expect(creep.store.energy).toBe(50);  // fully typed
	 */
	expectObject<K extends keyof KindMap>(id: string, kind: K): Promise<KindMap[K]>;

	/**
	 * Get a structure by ID and assert it exists with the expected structureType.
	 * Returns the narrowed structure snapshot — no `as any` casts needed.
	 *
	 *   const link = await shard.expectStructure(id, 'link');
	 *   expect(link.store.energy).toBe(300);  // LinkSnapshot
	 */
	expectStructure<S extends keyof StructureTypeMap>(id: string, structureType: S): Promise<StructureTypeMap[S]>;

	/**
	 * Run player code and assert it throws RunPlayerError with the expected kind.
	 * Returns the error for further assertions (e.g., checking engineMessage).
	 *
	 *   const err = await shard.expectRunPlayerError('p1', code`if (`, 'syntax');
	 *   expect(err.engineMessage).toBeTruthy();
	 */
	expectRunPlayerError(
		userId: string,
		playerCode: PlayerCode,
		expectedKind: RunPlayerErrorKind,
	): Promise<RunPlayerError>;

	/**
	 * Skip the current test if the adapter does not support the given capability.
	 * Replaces the manual `requireCapability(shard, skip, 'name')` pattern.
	 *
	 *   shard.requires('chemistry');
	 */
	requires(capability: CapabilityName, reason?: string): void;

	/**
	 * The blockers a validation case sets up. Registers the case, so the
	 * fixture can fail a pair whose setup is its left single's: the right-hand
	 * condition was never established.
	 *
	 *   const blockers = shard.validationBlockers(row);
	 */
	validationBlockers<Name extends string>(row: ValidationCase<string, Name>): ReadonlySet<Name>;
}

function wrapAdapter(
	adapter: ScreepsOkAdapter,
	skip: (note?: string) => never,
	task: { meta: Record<string, unknown> },
	gates: Set<string>,
	recorder: SetupRecorder,
): ShardFixture {
	const shard = adapter as ShardFixture;

	shard.ownedRoom = async (player: string, roomName = 'W1N1', rcl = 1) => {
		await adapter.createShard({
			players: [player],
			rooms: [{ name: roomName, rcl, owner: player }],
		});
	};

	shard.expectObject = async <K extends keyof KindMap>(id: string, kind: K): Promise<KindMap[K]> => {
		const obj = await adapter.getObject(id);
		if (!obj) throw new Error(`expectObject: object ${id} not found (expected kind '${kind}')`);
		if (obj.kind !== kind) {
			throw new Error(`expectObject: object ${id} has kind '${obj.kind}', expected '${kind}'`);
		}
		return obj as KindMap[K];
	};

	shard.expectStructure = async <S extends keyof StructureTypeMap>(id: string, structureType: S): Promise<StructureTypeMap[S]> => {
		const obj = await adapter.getObject(id);
		if (!obj) throw new Error(`expectStructure: object ${id} not found (expected '${structureType}')`);
		if (obj.kind !== 'structure') {
			throw new Error(`expectStructure: object ${id} has kind '${obj.kind}', expected 'structure'`);
		}
		const struct = obj as StructureSnapshot;
		if (struct.structureType !== structureType) {
			throw new Error(`expectStructure: object ${id} is '${struct.structureType}', expected '${structureType}'`);
		}
		return struct as StructureTypeMap[S];
	};

	shard.requires = (capability: CapabilityName, reason?: string): void => {
		gates.add(capability);
		if (adapter.capabilities[capability]) return;
		task.meta.skipReason = `capability:${capability}`;
		skip(reason ?? `adapter capability '${capability}' is disabled`);
	};

	shard.validationBlockers = <Name extends string>(row: ValidationCase<string, Name>) => {
		recorder.validationCase = row;
		return new Set(row.blockers);
	};

	shard.expectRunPlayerError = async (
		userId: string,
		playerCode: PlayerCode,
		expectedKind: RunPlayerErrorKind,
	): Promise<RunPlayerError> => {
		let result: PlayerReturnValue;
		try {
			result = await adapter.runPlayer(userId, playerCode);
		} catch (err) {
			if (err instanceof RunPlayerError) {
				if (err.errorKind !== expectedKind) {
					throw new Error(
						`expectRunPlayerError: got RunPlayerError('${err.errorKind}'), ` +
						`expected RunPlayerError('${expectedKind}'). Message: ${err.engineMessage}`,
					);
				}
				return err;
			}
			throw err;
		}
		throw new Error(
			`expectRunPlayerError: runPlayer succeeded with ${JSON.stringify(result)}, ` +
			`expected RunPlayerError('${expectedKind}')`,
		);
	};

	return shard;
}

// A timed-out test body keeps running after vitest moves on. The fence rejects
// its later shard calls and aborts its in-flight tick(n) between ticks.
export function fenceShard<Shard extends object>(shard: Shard, recorder?: SetupRecorder) {
	const controller = new AbortController();
	const inFlight = new Set<Promise<void>>();
	const fenced = new Proxy(shard, {
		get(target, key) {
			const value = Reflect.get(target, key);
			if (typeof value !== 'function') return value;
			return (...args: unknown[]) => {
				if (controller.signal.aborted) {
					throw new Error(`shard.${String(key)}() called after its test ended (did the test time out?)`);
				}
				const call = recorder?.call(String(key), args);
				if (key === 'tick') {
					const options = args[1] as TickOptions | undefined;
					const signal = options?.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal;
					args[1] = { ...options, signal };
				}
				const result: unknown = value.apply(target, args);
				if (result instanceof Promise) {
					const settled = result.then(resolved => recorder?.result(resolved, call), () => {});
					inFlight.add(settled);
					void settled.then(() => inFlight.delete(settled));
				}
				return result;
			};
		},
	});
	return {
		fenced,
		async close() {
			controller.abort(new Error('shard call aborted: its test ended (did the test time out?)'));
			await Promise.all(inFlight);
		},
	};
}

// A test's shard calls, with the ids it got back renamed in the order it
// got them, so two tests that set up the same world record the same text.
export class SetupRecorder {
	validationCase: ValidationCase<string, string> | undefined;
	private readonly calls: string[] = [];
	private readonly ids = new Map<string, string>();

	call(method: string, args: unknown[]) {
		if (method === 'validationBlockers') return undefined;
		const call = `${method}(${JSON.stringify(args)})`;
		this.calls.push(call);
		return call;
	}

	// An id the call was given (a flag's name) is the test's choice, not the engine's.
	result(value: unknown, call: string | undefined) {
		const ids = typeof value === 'string' ? [value]
			: [value].flat().flatMap(item => {
				const id = (item as { id?: unknown } | null | undefined)?.id;
				return typeof id === 'string' ? [id] : [];
			});
		for (const id of ids) {
			if (!this.ids.has(id) && !call?.includes(JSON.stringify(id))) this.ids.set(id, `#${this.ids.size}`);
		}
	}

	setup() {
		return this.calls.map(call => [...this.ids].reduce((text, [id, ordinal]) => text.replaceAll(id, ordinal), call)).join('\n');
	}
}

// Each validation case's setup in the running file, by `catalogId:label`.
const caseSetups = new Map<string, string>();

// A pair proves check order only if it sets up its right-hand condition too;
// the same setup as its left single's never did. Singles run first; records
// this case's setup into `setups`.
export function pairSetupError(row: ValidationCase<string, string>, setup: string, setups: Map<string, string>): string | undefined {
	setups.set(`${row.catalogId}:${row.label}`, setup);
	if (row.blockers.length < 2) return undefined;
	const [left, right] = row.blockers;
	const single = `${row.catalogId}:${toLabelToken(left)}`;
	return setups.get(single) === setup
		? `${row.catalogId}:${row.label} sets up exactly what ${single} does, so '${right}' never holds: set it up too, or exclude the pair citing vanilla`
		: undefined;
}

function assertPairSetUp(task: RunnerTestCase, recorder: SetupRecorder) {
	const row = recorder.validationCase;
	if (!row || (task.result as { pending?: boolean } | undefined)?.pending) return;
	const error = pairSetupError(row, recorder.setup(), caseSetups);
	if (error) throw new Error(error);
}

function taskCatalogId(task: RunnerTestCase): string | null {
	const names: string[] = [];
	for (let t: RunnerTask | undefined = task; t && t !== task.file; t = t.suite) names.unshift(t.name);
	return testCatalogId(names.join(' > '));
}

// Each catalog row's capabilities: its section's tag and its own.
let rowCapabilities: Map<string, string[]> | undefined;

// The capabilities a test's row is tagged with that the test never gated.
export function ungatedCapabilities(id: string, gates: ReadonlySet<string>, rows: ReadonlyMap<string, readonly string[]>): string[] {
	return (rows.get(baseCatalogId(id)) ?? []).filter(cap => !gates.has(cap));
}

// A test of a capability-tagged row must call shard.requires for each tag, or
// it runs on adapters without the capability. Checked when the test ends, so
// gates a matrix passes as data count too.
function assertGated(task: RunnerTestCase, gates: Set<string>) {
	// vitest's skip() marks the running result pending (untyped); a skipped test may not reach its gates.
	if ((task.result as { pending?: boolean } | undefined)?.pending) return;
	const id = taskCatalogId(task);
	if (!id) return;
	rowCapabilities ??= new Map(parseCatalog(fileURLToPath(new URL('../behaviors.md', import.meta.url)))
		.map(entry => [entry.id, entry.capabilities]));
	const ungated = ungatedCapabilities(id, gates, rowCapabilities);
	if (ungated.length > 0) {
		throw new Error(`${id}: behaviors.md tags its row ${ungated.map(cap => `capability:${cap}`).join(', ')}; call shard.requires('${ungated[0]}')${ungated.length > 1 ? ' for each' : ''}`);
	}
}

export const test = base.extend<{ shard: ShardFixture }>({
	shard: async ({ skip, task }, use) => {
		// A test the adapter's parity.json skips never reaches the engine: it may hang it.
		parity ??= loadParity(resolve(dirname(adapterPath()), 'parity.json'));
		const skipped = registrationFor(parity.skipForId, taskCatalogId(task));
		if (skipped) {
			const skipId = parity.skipForId.get(skipped)!;
			(task.meta as Record<string, unknown>).skipReason = `registered:${skipId}`;
			skip(parity.skips[skipId].why);
		}
		const mod = await getAdapterModule();
		const adapter = await mod.createAdapter();
		const gates = new Set<string>();
		const recorder = new SetupRecorder();
		const fence = fenceShard(wrapAdapter(adapter, skip, task as unknown as { meta: Record<string, unknown> }, gates, recorder), recorder);
		try {
			await use(fence.fenced);
		} finally {
			await fence.close();
			await adapter.teardown();
		}
		assertGated(task, gates);
		assertPairSetUp(task, recorder);
	},
});

export { describe, expect };
