// A snapshot field named after a player getter reports that getter's value on
// the tick, unclamped and undefaulted; a getter's `undefined` reads `null`.
// `storeCapacity` is `store.getCapacity()`, `storeCapacityByResource` is
// `store.getCapacity(resource)`, and `owner` is the owner's test handle.

// ── Position ─────────────────────────────────────────────────

export interface PosSnapshot {
	x: number;
	y: number;
	roomName: string;
}

// ── Creep ────────────────────────────────────────────────────

export interface CreepSnapshot {
	kind: 'creep';
	id: string;
	name: string;
	pos: PosSnapshot;
	hits: number;
	hitsMax: number;
	fatigue: number;
	body: Array<{ type: string; hits: number; boost?: string }>;
	owner: string;
	ticksToLive: number | null;
	spawning: boolean;
	store: Record<string, number>;
	storeCapacity: number | null;
}

// ── Structures ───────────────────────────────────────────────

export interface StructureSnapshotBase {
	kind: 'structure';
	id: string;
	pos: PosSnapshot;
	structureType: string;
	owner?: string;
	hits?: number;
	hitsMax?: number;
}

export interface ControllerSnapshot extends StructureSnapshotBase {
	structureType: 'controller';
	level: number;
	progress: number | null;
	progressTotal: number | null;
	ticksToDowngrade: number | null;
	safeMode: number | null;
	safeModeAvailable: number;
	safeModeCooldown: number | null;
	isPowerEnabled: boolean;
	reservation: { owner: string; ticksToEnd: number } | null;
	sign: { owner: string; text: string; time: number } | null;
}

export interface SpawnSnapshot extends StructureSnapshotBase {
	structureType: 'spawn';
	hits: number;
	hitsMax: number;
	name: string;
	store: Record<string, number>;
	storeCapacity: number | null;
	spawning: {
		name: string;
		needTime: number;
		remainingTime: number;
	} | null;
}

export interface LabSnapshot extends StructureSnapshotBase {
	structureType: 'lab';
	hits: number;
	hitsMax: number;
	store: Record<string, number>;
	storeCapacityByResource: Record<string, number>;
	cooldown: number;
	mineralType: string | null;
}

export interface TowerSnapshot extends StructureSnapshotBase {
	structureType: 'tower';
	hits: number;
	hitsMax: number;
	store: Record<string, number>;
	storeCapacity: number | null;
}

export interface StorageSnapshot extends StructureSnapshotBase {
	structureType: 'storage';
	hits: number;
	hitsMax: number;
	store: Record<string, number>;
	storeCapacity: number | null;
}

export interface LinkSnapshot extends StructureSnapshotBase {
	structureType: 'link';
	hits: number;
	hitsMax: number;
	store: Record<string, number>;
	storeCapacity: number | null;
	cooldown: number;
}

export interface RampartSnapshot extends StructureSnapshotBase {
	structureType: 'rampart';
	hits: number;
	hitsMax: number;
	isPublic: boolean;
	ticksToDecay: number | null;
}

export interface TerminalSnapshot extends StructureSnapshotBase {
	structureType: 'terminal';
	hits: number;
	hitsMax: number;
	store: Record<string, number>;
	storeCapacity: number | null;
	cooldown: number;
}

export interface FactorySnapshot extends StructureSnapshotBase {
	structureType: 'factory';
	hits: number;
	hitsMax: number;
	store: Record<string, number>;
	storeCapacity: number | null;
	cooldown: number;
	level: number | null;
}

export interface ExtensionSnapshot extends StructureSnapshotBase {
	structureType: 'extension';
	hits: number;
	hitsMax: number;
	store: Record<string, number>;
	storeCapacity: number | null;
}

export interface ContainerSnapshot extends StructureSnapshotBase {
	structureType: 'container';
	hits: number;
	hitsMax: number;
	store: Record<string, number>;
	storeCapacity: number | null;
	ticksToDecay: number | null;
}

export interface ExtractorSnapshot extends StructureSnapshotBase {
	structureType: 'extractor';
	hits: number;
	hitsMax: number;
	cooldown: number;
}

export interface RoadSnapshot extends StructureSnapshotBase {
	structureType: 'road';
	hits: number;
	hitsMax: number;
	ticksToDecay: number | null;
}

export interface NukerSnapshot extends StructureSnapshotBase {
	structureType: 'nuker';
	hits: number;
	hitsMax: number;
	store: Record<string, number>;
	storeCapacity: number | null;
	cooldown: number;
}

export interface PowerSpawnSnapshot extends StructureSnapshotBase {
	structureType: 'powerSpawn';
	hits: number;
	hitsMax: number;
	store: Record<string, number>;
	storeCapacity: number | null;
}

export interface ObserverSnapshot extends StructureSnapshotBase {
	structureType: 'observer';
	hits: number;
	hitsMax: number;
}

export interface KeeperLairSnapshot extends StructureSnapshotBase {
	structureType: 'keeperLair';
	ticksToSpawn: number | null;
}

export interface InvaderCoreSnapshot extends StructureSnapshotBase {
	structureType: 'invaderCore';
	level: number;
	spawning: {
		name: string;
		needTime: number;
		remainingTime: number;
	} | null;
	ticksToDeploy: number | null;
	effects: Array<{ effect: number; level?: number; power?: number; ticksRemaining: number }> | null;
}

export interface PowerBankSnapshot extends StructureSnapshotBase {
	structureType: 'powerBank';
	hits: number;
	hitsMax: number;
	power: number;
	ticksToDecay: number | null;
}

export type PortalDestinationSnapshot =
	| PosSnapshot
	| { shard: string; room: string };

export interface PortalSnapshot extends StructureSnapshotBase {
	structureType: 'portal';
	destination: PortalDestinationSnapshot;
	ticksToDecay: number | null;
}

export interface WallSnapshot extends StructureSnapshotBase {
	structureType: 'constructedWall';
	hits: number;
	hitsMax: number;
}

export type StructureSnapshot =
	| ControllerSnapshot
	| SpawnSnapshot
	| LabSnapshot
	| TowerSnapshot
	| StorageSnapshot
	| LinkSnapshot
	| RampartSnapshot
	| TerminalSnapshot
	| FactorySnapshot
	| ExtensionSnapshot
	| ContainerSnapshot
	| ExtractorSnapshot
	| RoadSnapshot
	| NukerSnapshot
	| PowerSpawnSnapshot
	| ObserverSnapshot
	| KeeperLairSnapshot
	| InvaderCoreSnapshot
	| PowerBankSnapshot
	| PortalSnapshot
	| WallSnapshot
	| StructureSnapshotBase;

// ── Construction Sites ───────────────────────────────────────

export interface SiteSnapshot {
	kind: 'site';
	id: string;
	pos: PosSnapshot;
	structureType: string;
	owner: string;
	progress: number;
	progressTotal: number;
}

// ── Sources & Minerals ───────────────────────────────────────

export interface SourceSnapshot {
	kind: 'source';
	id: string;
	pos: PosSnapshot;
	energy: number;
	energyCapacity: number;
	ticksToRegeneration: number | null;
}

export interface MineralSnapshot {
	kind: 'mineral';
	id: string;
	pos: PosSnapshot;
	mineralType: string;
	mineralAmount: number;
	density: number;
	ticksToRegeneration: number | null;
}

export interface DepositSnapshot {
	kind: 'deposit';
	id: string;
	pos: PosSnapshot;
	depositType: string;
	lastCooldown: number;
	cooldown: number;
	ticksToDecay: number | null;
}

// ── Decay objects ────────────────────────────────────────────

export interface TombstoneSnapshot {
	kind: 'tombstone';
	id: string;
	pos: PosSnapshot;
	creepName: string;
	deathTime: number;
	store: Record<string, number>;
	ticksToDecay: number;
}

export interface RuinSnapshot {
	kind: 'ruin';
	id: string;
	pos: PosSnapshot;
	structureType: string;
	destroyTime: number;
	store: Record<string, number>;
	ticksToDecay: number;
}

export interface DroppedResourceSnapshot {
	kind: 'resource';
	id: string;
	pos: PosSnapshot;
	resourceType: string;
	amount: number;
}

// ── Union ────────────────────────────────────────────────────

export type ObjectSnapshot =
	| CreepSnapshot
	| StructureSnapshot
	| SiteSnapshot
	| SourceSnapshot
	| MineralSnapshot
	| DepositSnapshot
	| TombstoneSnapshot
	| RuinSnapshot
	| DroppedResourceSnapshot;
