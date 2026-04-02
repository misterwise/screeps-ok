import { resolve } from 'node:path';
import { test as base, describe, expect } from 'vitest';
import type { ScreepsOkAdapter } from './adapter.js';
import type {
	ObjectSnapshot, CreepSnapshot, StructureSnapshot,
	SiteSnapshot, SourceSnapshot, MineralSnapshot,
	TombstoneSnapshot, RuinSnapshot, DroppedResourceSnapshot,
	ControllerSnapshot, SpawnSnapshot, LabSnapshot, TowerSnapshot,
	StorageSnapshot, LinkSnapshot, RampartSnapshot,
	TerminalSnapshot, FactorySnapshot, ExtensionSnapshot,
	ContainerSnapshot, ExtractorSnapshot, RoadSnapshot,
	NukerSnapshot, PowerSpawnSnapshot, WallSnapshot,
} from './snapshots/common.js';

type AdapterFactory = { createAdapter(): Promise<ScreepsOkAdapter> };

let adapterModule: AdapterFactory | undefined;

async function getAdapterModule(): Promise<AdapterFactory> {
	if (!adapterModule) {
		const adapterPath = process.env.SCREEPS_OK_ADAPTER;
		if (!adapterPath) {
			throw new Error(
				'SCREEPS_OK_ADAPTER env var not set. Point it at an adapter module ' +
				'(e.g., SCREEPS_OK_ADAPTER=./adapters/xxscreeps/index.ts)'
			);
		}
		// Resolve relative to project root, not to vite-node internals
		const absPath = resolve(process.cwd(), adapterPath);
		adapterModule = await import(absPath) as AdapterFactory;
	}
	return adapterModule;
}

// ── Snapshot kind → type mapping ────────────────────────────

type KindMap = {
	creep: CreepSnapshot;
	structure: StructureSnapshot;
	site: SiteSnapshot;
	source: SourceSnapshot;
	mineral: MineralSnapshot;
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
}

function wrapAdapter(adapter: ScreepsOkAdapter): ShardFixture {
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

	return shard;
}

export const test = base.extend<{ shard: ShardFixture }>({
	// eslint-disable-next-line no-empty-pattern
	shard: async ({}, use) => {
		const mod = await getAdapterModule();
		const adapter = await mod.createAdapter();
		await use(wrapAdapter(adapter));
		await adapter.teardown();
	},
});

export { describe, expect };
