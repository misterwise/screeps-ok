import type {
	ObjectSnapshot, CreepSnapshot, StructureSnapshot, StructureSnapshotBase,
	ControllerSnapshot, SpawnSnapshot, LabSnapshot, TowerSnapshot,
	StorageSnapshot, LinkSnapshot, RampartSnapshot,
	TerminalSnapshot, FactorySnapshot, ExtensionSnapshot,
	ContainerSnapshot, ExtractorSnapshot, RoadSnapshot,
	NukerSnapshot, PowerSpawnSnapshot, ObserverSnapshot,
	KeeperLairSnapshot, InvaderCoreSnapshot, PowerBankSnapshot,
	PortalSnapshot, WallSnapshot,
	SiteSnapshot, SourceSnapshot, MineralSnapshot,
	DepositSnapshot, TombstoneSnapshot, RuinSnapshot, DroppedResourceSnapshot,
	PortalDestinationSnapshot,
} from '../../src/snapshots/common.js';

// Snapshots read raw DB documents, so each field re-derives its player getter
// from @screeps/engine src/game/*.js (cited per group); see common.ts.

interface PlayerResolver {
	resolvePlayerReverse(userId: string): string;
}

interface VanillaConstants {
	CONTROLLER_LEVELS: Record<number, number>;
	DEPOSIT_EXHAUST_MULTIPLY: number;
	DEPOSIT_EXHAUST_POW: number;
}

function snapPos(obj: any) {
	return { x: obj.x, y: obj.y, roomName: obj.room };
}

function snapOwner(obj: any, resolver: PlayerResolver): string | undefined {
	return obj.user ? resolver.resolvePlayerReverse(obj.user) : undefined;
}

function snapStore(obj: any): Record<string, number> {
	const store: Record<string, number> = {};
	for (const [resource, amount] of Object.entries(obj.store ?? {})) {
		if (typeof amount === 'number' && amount > 0) store[resource] = amount;
	}
	return store;
}

// store.js getCapacity over utils.capacityForResource.
function storeCapacity(obj: any, resource?: string): number | null {
	if (!resource) return obj.storeCapacityResource ? null : obj.storeCapacity || null;
	const restricted = obj.storeCapacityResource?.[resource];
	const reserved = Object.values(obj.storeCapacityResource ?? {}).reduce((sum: number, n: any) => sum + n, 0);
	return restricted || Math.max(0, (obj.storeCapacity || 0) - reserved) || null;
}

// The recurring getter shapes: `t ? t - time : undefined`, the cooldownTime
// getter's floor of 0, and `t && t > time ? t - time : undefined`.
function remaining(abs: unknown, gameTime: number): number | null {
	return abs ? (abs as number) - gameTime : null;
}

function cooldownFromTime(obj: any, gameTime: number): number {
	return obj.cooldownTime && obj.cooldownTime > gameTime ? obj.cooldownTime - gameTime : 0;
}

function activeRemaining(abs: unknown, gameTime: number): number | null {
	return abs && (abs as number) > gameTime ? (abs as number) - gameTime : null;
}

// Rampart, road, container, and power bank ticksToDecay.
function decayRemaining(obj: any, gameTime: number): number | null {
	return remaining(obj.nextDecayTime || obj.decayTime, gameTime);
}

function snapSpawning(obj: any, gameTime: number): SpawnSnapshot['spawning'] {
	if (!obj.spawning) return null;
	return {
		name: obj.spawning.name,
		needTime: obj.spawning.needTime,
		remainingTime: obj.spawning.spawnTime - gameTime,
	};
}

// rooms.js RoomObject: effects with a live timer, or undefined when none were stored.
function snapEffects(obj: any, gameTime: number): InvaderCoreSnapshot['effects'] {
	if (!obj.effects) return null;
	return obj.effects
		.map((e: any) => ({
			effect: e.effect,
			...(e.level !== undefined ? { level: e.level } : {}),
			...(e.power !== undefined ? { power: e.power } : {}),
			ticksRemaining: e.endTime - gameTime,
		}))
		.filter((e: { ticksRemaining: number }) => e.ticksRemaining > 0);
}

function snapPortalDestination(dest: any): PortalDestinationSnapshot {
	return dest.shard
		? { shard: dest.shard, room: dest.room }
		: { x: dest.x, y: dest.y, roomName: dest.room };
}

// creeps.js
export function snapshotCreep(obj: any, resolver: PlayerResolver, gameTime: number): CreepSnapshot {
	return {
		kind: 'creep',
		id: obj._id,
		name: obj.name,
		pos: snapPos(obj),
		hits: obj.hits,
		hitsMax: obj.hitsMax,
		fatigue: obj.fatigue,
		body: obj.body.map((part: any) => ({
			type: part.type,
			hits: part.hits,
			...(part.boost ? { boost: part.boost } : {}),
		})),
		owner: snapOwner(obj, resolver)!,
		ticksToLive: remaining(obj.ageTime, gameTime),
		spawning: obj.spawning,
		store: snapStore(obj),
		storeCapacity: storeCapacity(obj),
	};
}

// structures.js
export function snapshotStructure(
	obj: any,
	resolver: PlayerResolver,
	gameTime: number,
	constants: VanillaConstants,
): StructureSnapshot {
	const base: StructureSnapshotBase = {
		kind: 'structure',
		id: obj._id,
		pos: snapPos(obj),
		structureType: obj.type,
		owner: snapOwner(obj, resolver),
		...(obj.hits !== undefined ? { hits: obj.hits, hitsMax: obj.hitsMax } : {}),
	};
	const hits = { hits: obj.hits, hitsMax: obj.hitsMax };

	switch (obj.type) {
		case 'controller': {
			if (obj.hardSign) throw new Error('vanilla snapshot: a hardSign has no player handle');
			return {
				...base,
				structureType: 'controller',
				level: obj.level,
				progress: obj.level > 0 ? obj.progress : null,
				progressTotal: obj.level > 0 && obj.level < 8 ? constants.CONTROLLER_LEVELS[obj.level] : null,
				ticksToDowngrade: remaining(obj.downgradeTime, gameTime),
				safeMode: activeRemaining(obj.safeMode, gameTime),
				safeModeAvailable: obj.safeModeAvailable || 0,
				safeModeCooldown: activeRemaining(obj.safeModeCooldown, gameTime),
				isPowerEnabled: !!obj.isPowerEnabled,
				reservation: obj.reservation ? {
					owner: resolver.resolvePlayerReverse(obj.reservation.user),
					ticksToEnd: obj.reservation.endTime - gameTime,
				} : null,
				sign: obj.sign ? {
					owner: resolver.resolvePlayerReverse(obj.sign.user),
					text: obj.sign.text,
					time: obj.sign.time,
				} : null,
			} satisfies ControllerSnapshot;
		}

		case 'spawn':
			return {
				...base, ...hits,
				structureType: 'spawn',
				name: obj.name,
				store: snapStore(obj),
				storeCapacity: storeCapacity(obj),
				spawning: snapSpawning(obj, gameTime),
			} satisfies SpawnSnapshot;

		case 'lab': {
			const mineralType = Object.keys(obj.store).find(k => k !== 'energy' && obj.store[k]) ?? null;
			return {
				...base, ...hits,
				structureType: 'lab',
				store: snapStore(obj),
				storeCapacityByResource: {
					energy: storeCapacity(obj, 'energy')!,
					...(mineralType ? { [mineralType]: storeCapacity(obj, mineralType)! } : {}),
				},
				cooldown: cooldownFromTime(obj, gameTime),
				mineralType,
			} satisfies LabSnapshot;
		}

		case 'tower':
			return {
				...base, ...hits,
				structureType: 'tower',
				store: snapStore(obj),
				storeCapacity: storeCapacity(obj),
			} satisfies TowerSnapshot;

		case 'storage':
			return {
				...base, ...hits,
				structureType: 'storage',
				store: snapStore(obj),
				storeCapacity: storeCapacity(obj),
			} satisfies StorageSnapshot;

		case 'link':
			return {
				...base, ...hits,
				structureType: 'link',
				store: snapStore(obj),
				storeCapacity: storeCapacity(obj),
				cooldown: obj.cooldown || 0,
			} satisfies LinkSnapshot;

		case 'rampart':
			return {
				...base, ...hits,
				structureType: 'rampart',
				isPublic: !!obj.isPublic,
				ticksToDecay: decayRemaining(obj, gameTime),
			} satisfies RampartSnapshot;

		case 'terminal':
			return {
				...base, ...hits,
				structureType: 'terminal',
				store: snapStore(obj),
				storeCapacity: storeCapacity(obj),
				cooldown: cooldownFromTime(obj, gameTime),
			} satisfies TerminalSnapshot;

		case 'factory':
			return {
				...base, ...hits,
				structureType: 'factory',
				store: snapStore(obj),
				storeCapacity: storeCapacity(obj),
				cooldown: cooldownFromTime(obj, gameTime),
				level: obj.level ?? null,
			} satisfies FactorySnapshot;

		case 'extension':
			return {
				...base, ...hits,
				structureType: 'extension',
				store: snapStore(obj),
				storeCapacity: storeCapacity(obj),
			} satisfies ExtensionSnapshot;

		case 'container':
			return {
				...base, ...hits,
				structureType: 'container',
				store: snapStore(obj),
				storeCapacity: storeCapacity(obj),
				ticksToDecay: decayRemaining(obj, gameTime),
			} satisfies ContainerSnapshot;

		case 'extractor':
			return {
				...base, ...hits,
				structureType: 'extractor',
				cooldown: obj.cooldown || 0,
			} satisfies ExtractorSnapshot;

		case 'road':
			return {
				...base, ...hits,
				structureType: 'road',
				ticksToDecay: decayRemaining(obj, gameTime),
			} satisfies RoadSnapshot;

		case 'nuker':
			return {
				...base, ...hits,
				structureType: 'nuker',
				store: snapStore(obj),
				storeCapacity: storeCapacity(obj),
				cooldown: cooldownFromTime(obj, gameTime),
			} satisfies NukerSnapshot;

		case 'powerSpawn':
			return {
				...base, ...hits,
				structureType: 'powerSpawn',
				store: snapStore(obj),
				storeCapacity: storeCapacity(obj),
			} satisfies PowerSpawnSnapshot;

		case 'observer':
			return {
				...base, ...hits,
				structureType: 'observer',
			} satisfies ObserverSnapshot;

		case 'keeperLair':
			return {
				...base,
				structureType: 'keeperLair',
				ticksToSpawn: remaining(obj.nextSpawnTime, gameTime),
			} satisfies KeeperLairSnapshot;

		case 'invaderCore':
			return {
				...base,
				structureType: 'invaderCore',
				level: obj.level,
				spawning: snapSpawning(obj, gameTime),
				ticksToDeploy: remaining(obj.deployTime, gameTime),
				effects: snapEffects(obj, gameTime),
			} satisfies InvaderCoreSnapshot;

		case 'powerBank':
			return {
				...base, ...hits,
				structureType: 'powerBank',
				power: obj.store.power,
				ticksToDecay: decayRemaining(obj, gameTime),
			} satisfies PowerBankSnapshot;

		case 'portal':
			return {
				...base,
				structureType: 'portal',
				destination: snapPortalDestination(obj.destination),
				ticksToDecay: remaining(obj.decayTime, gameTime),
			} satisfies PortalSnapshot;

		case 'constructedWall':
			return {
				...base, ...hits,
				structureType: 'constructedWall',
			} satisfies WallSnapshot;

		default:
			return base;
	}
}

// construction-sites.js
export function snapshotSite(obj: any, resolver: PlayerResolver): SiteSnapshot {
	return {
		kind: 'site',
		id: obj._id,
		pos: snapPos(obj),
		structureType: obj.structureType,
		owner: snapOwner(obj, resolver)!,
		progress: obj.progress,
		progressTotal: obj.progressTotal,
	};
}

// sources.js
export function snapshotSource(obj: any, gameTime: number): SourceSnapshot {
	return {
		kind: 'source',
		id: obj._id,
		pos: snapPos(obj),
		energy: obj.energy,
		energyCapacity: obj.energyCapacity,
		ticksToRegeneration: remaining(obj.nextRegenerationTime, gameTime),
	};
}

// minerals.js
export function snapshotMineral(obj: any, gameTime: number): MineralSnapshot {
	return {
		kind: 'mineral',
		id: obj._id,
		pos: snapPos(obj),
		mineralType: obj.mineralType,
		mineralAmount: obj.mineralAmount,
		density: obj.density,
		ticksToRegeneration: remaining(obj.nextRegenerationTime, gameTime),
	};
}

// deposits.js
function snapshotDeposit(obj: any, gameTime: number, constants: VanillaConstants): DepositSnapshot {
	return {
		kind: 'deposit',
		id: obj._id,
		pos: snapPos(obj),
		depositType: obj.depositType,
		lastCooldown: Math.ceil(constants.DEPOSIT_EXHAUST_MULTIPLY * Math.pow(obj.harvested, constants.DEPOSIT_EXHAUST_POW)),
		cooldown: cooldownFromTime(obj, gameTime),
		ticksToDecay: remaining(obj.decayTime, gameTime),
	};
}

// ruins.js; `structureType` is the destroyed structure's, as `ruin.structure.structureType`.
function snapshotRuin(obj: any, gameTime: number): RuinSnapshot {
	return {
		kind: 'ruin',
		id: obj._id,
		pos: snapPos(obj),
		structureType: obj.structure.type,
		destroyTime: obj.destroyTime,
		store: snapStore(obj),
		ticksToDecay: obj.decayTime - gameTime,
	};
}

// tombstones.js; `creepName` is `tombstone.creep.name`.
function snapshotTombstone(obj: any, gameTime: number): TombstoneSnapshot {
	return {
		kind: 'tombstone',
		id: obj._id,
		pos: snapPos(obj),
		creepName: obj.creepName,
		deathTime: obj.deathTime,
		store: snapStore(obj),
		ticksToDecay: obj.decayTime - gameTime,
	};
}

// resources.js
function snapshotDroppedResource(obj: any): DroppedResourceSnapshot {
	const resourceType = obj.resourceType || 'energy';
	return {
		kind: 'resource',
		id: obj._id,
		pos: snapPos(obj),
		resourceType,
		amount: obj[resourceType],
	};
}

export function snapshotObject(
	obj: any,
	resolver: PlayerResolver,
	gameTime: number,
	constants: VanillaConstants,
): ObjectSnapshot | null {
	switch (obj.type) {
		case 'creep': return snapshotCreep(obj, resolver, gameTime);
		case 'constructionSite': return snapshotSite(obj, resolver);
		case 'source': return snapshotSource(obj, gameTime);
		case 'mineral': return snapshotMineral(obj, gameTime);
		case 'deposit': return snapshotDeposit(obj, gameTime, constants);
		case 'controller':
		case 'spawn':
		case 'extension':
		case 'tower':
		case 'storage':
		case 'terminal':
		case 'lab':
		case 'link':
		case 'observer':
		case 'powerSpawn':
		case 'extractor':
		case 'nuker':
		case 'factory':
		case 'container':
		case 'road':
		case 'constructedWall':
		case 'rampart':
		case 'keeperLair':
		case 'invaderCore':
		case 'powerBank':
		case 'portal':
			return snapshotStructure(obj, resolver, gameTime, constants);
		case 'energy':
		case 'power':
		case 'resource':
			return snapshotDroppedResource(obj);
		case 'tombstone':
			return snapshotTombstone(obj, gameTime);
		case 'ruin':
			return snapshotRuin(obj, gameTime);
		default:
			return null;
	}
}

const findTypeMap: Record<string, string[]> = {
	creeps: ['creep'],
	structures: [
		'controller', 'spawn', 'extension', 'tower', 'storage', 'terminal',
		'lab', 'link', 'observer', 'powerSpawn', 'extractor', 'nuker', 'factory',
		'container', 'road', 'constructedWall', 'rampart', 'keeperLair',
		'invaderCore', 'powerBank', 'portal',
	],
	constructionSites: ['constructionSite'],
	sources: ['source'],
	minerals: ['mineral'],
	deposits: ['deposit'],
	tombstones: ['tombstone'],
	ruins: ['ruin'],
	droppedResources: ['energy', 'power', 'resource'],
};

export function snapshotRoomObjects(
	objects: any[],
	findType: string,
	resolver: PlayerResolver,
	gameTime: number,
	constants: VanillaConstants,
): ObjectSnapshot[] {
	const allowedTypes = findTypeMap[findType];
	const results: ObjectSnapshot[] = [];
	for (const obj of objects) {
		if (allowedTypes && !allowedTypes.includes(obj.type)) continue;
		const snapshot = snapshotObject(obj, resolver, gameTime, constants);
		if (snapshot) results.push(snapshot);
	}
	return results;
}
