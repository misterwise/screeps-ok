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
	ticksToLive: number;
	spawning: boolean;
	store: Record<string, number>;
	storeCapacity: number;
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
	progress: number;
	progressTotal: number | null;
	ticksToDowngrade: number;
	safeMode?: number;
	safeModeAvailable: number;
	safeModeCooldown: number;
	isPowerEnabled: boolean;
	reservation?: { owner: string; ticksToEnd: number };
	sign?: { owner: string; text: string; time: number };
}

export interface SpawnSnapshot extends StructureSnapshotBase {
	structureType: 'spawn';
	hits: number;
	hitsMax: number;
	name: string;
	store: Record<string, number>;
	storeCapacity: number;
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
	storeCapacity: number;
}

export interface StorageSnapshot extends StructureSnapshotBase {
	structureType: 'storage';
	hits: number;
	hitsMax: number;
	store: Record<string, number>;
	storeCapacity: number;
}

export interface LinkSnapshot extends StructureSnapshotBase {
	structureType: 'link';
	hits: number;
	hitsMax: number;
	store: Record<string, number>;
	storeCapacity: number;
	cooldown: number;
}

export interface RampartSnapshot extends StructureSnapshotBase {
	structureType: 'rampart';
	hits: number;
	hitsMax: number;
	isPublic: boolean;
	ticksToDecay: number;
}

export type StructureSnapshot =
	| ControllerSnapshot
	| SpawnSnapshot
	| LabSnapshot
	| TowerSnapshot
	| StorageSnapshot
	| LinkSnapshot
	| RampartSnapshot
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
	ticksToRegeneration: number;
}

export interface MineralSnapshot {
	kind: 'mineral';
	id: string;
	pos: PosSnapshot;
	mineralType: string;
	mineralAmount: number;
	ticksToRegeneration: number;
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
	| TombstoneSnapshot
	| RuinSnapshot
	| DroppedResourceSnapshot;
