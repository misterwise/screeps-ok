import type {
	ObjectSnapshot, CreepSnapshot, StructureSnapshot, StructureSnapshotBase,
	ControllerSnapshot, SpawnSnapshot, LabSnapshot, TowerSnapshot,
	StorageSnapshot, LinkSnapshot, RampartSnapshot,
	SiteSnapshot, SourceSnapshot, MineralSnapshot,
	TombstoneSnapshot, DroppedResourceSnapshot,
} from '../../src/snapshots/common.js';

interface PlayerResolver {
	resolvePlayerReverse(userId: string): string;
}

function snapPos(obj: any) {
	return { x: obj.x, y: obj.y, roomName: obj.room };
}

function snapOwner(obj: any, resolver: PlayerResolver): string | undefined {
	return obj.user ? resolver.resolvePlayerReverse(obj.user) : undefined;
}

function snapStore(obj: any): Record<string, number> {
	const store: Record<string, number> = {};
	if (obj.store && typeof obj.store === 'object') {
		for (const [resource, amount] of Object.entries(obj.store)) {
			if (typeof amount === 'number' && amount > 0) {
				store[resource] = amount;
			}
		}
	}
	// Legacy energy field
	if (obj.energy !== undefined && !store.energy) {
		store.energy = obj.energy;
	}
	return store;
}

export function snapshotCreep(obj: any, resolver: PlayerResolver): CreepSnapshot {
	return {
		kind: 'creep',
		id: obj._id,
		name: obj.name,
		pos: snapPos(obj),
		hits: obj.hits,
		hitsMax: obj.hitsMax,
		fatigue: obj.fatigue ?? 0,
		body: (obj.body ?? []).map((part: any) => ({
			type: part.type,
			hits: part.hits ?? 100,
			...(part.boost ? { boost: part.boost } : {}),
		})),
		owner: snapOwner(obj, resolver)!,
		ticksToLive: obj.ticksToLive ?? obj.ageTime ?? 1500,
		spawning: obj.spawning ?? false,
		store: snapStore(obj),
		storeCapacity: obj.storeCapacity ?? 0,
	};
}

export function snapshotStructure(obj: any, resolver: PlayerResolver): StructureSnapshot {
	const base: StructureSnapshotBase = {
		kind: 'structure',
		id: obj._id,
		pos: snapPos(obj),
		structureType: obj.type,
		owner: snapOwner(obj, resolver),
		...(obj.hits !== undefined ? { hits: obj.hits, hitsMax: obj.hitsMax } : {}),
	};

	switch (obj.type) {
		case 'controller':
			return {
				...base,
				structureType: 'controller',
				level: obj.level ?? 0,
				progress: obj.progress ?? 0,
				progressTotal: obj.level >= 8 ? null : (obj.progressTotal ?? 0),
				ticksToDowngrade: obj.ticksToDowngrade ?? obj.downgradeTime ?? 0,
				safeMode: obj.safeMode,
				safeModeAvailable: obj.safeModeAvailable ?? 0,
				safeModeCooldown: obj.safeModeCooldown ?? 0,
				isPowerEnabled: obj.isPowerEnabled ?? false,
				...(obj.reservation ? {
					reservation: {
						owner: resolver.resolvePlayerReverse(obj.reservation.user),
						ticksToEnd: obj.reservation.endTime,
					},
				} : {}),
				...(obj.sign ? {
					sign: {
						owner: resolver.resolvePlayerReverse(obj.sign.user),
						text: obj.sign.text,
						time: obj.sign.time,
					},
				} : {}),
			} satisfies ControllerSnapshot;

		case 'spawn':
			return {
				...base,
				structureType: 'spawn',
				hits: obj.hits ?? 5000,
				hitsMax: obj.hitsMax ?? 5000,
				name: obj.name ?? 'Spawn1',
				store: snapStore(obj),
				storeCapacity: obj.storeCapacity ?? 300,
				spawning: obj.spawning ?? null,
			} satisfies SpawnSnapshot;

		case 'lab':
			return {
				...base,
				structureType: 'lab',
				hits: obj.hits ?? 500,
				hitsMax: obj.hitsMax ?? 500,
				store: snapStore(obj),
				storeCapacityByResource: {
					energy: 2000,
					...(obj.mineralType ? { [obj.mineralType]: 3000 } : {}),
				},
				cooldown: obj.cooldown ?? 0,
				mineralType: obj.mineralType ?? null,
			} satisfies LabSnapshot;

		case 'tower':
			return {
				...base,
				structureType: 'tower',
				hits: obj.hits ?? 3000,
				hitsMax: obj.hitsMax ?? 3000,
				store: snapStore(obj),
				storeCapacity: obj.storeCapacity ?? 1000,
			} satisfies TowerSnapshot;

		case 'storage':
			return {
				...base,
				structureType: 'storage',
				hits: obj.hits ?? 10000,
				hitsMax: obj.hitsMax ?? 10000,
				store: snapStore(obj),
				storeCapacity: obj.storeCapacity ?? 1000000,
			} satisfies StorageSnapshot;

		case 'link':
			return {
				...base,
				structureType: 'link',
				hits: obj.hits ?? 1000,
				hitsMax: obj.hitsMax ?? 1000,
				store: snapStore(obj),
				storeCapacity: obj.storeCapacity ?? 800,
				cooldown: obj.cooldown ?? 0,
			} satisfies LinkSnapshot;

		case 'rampart':
			return {
				...base,
				structureType: 'rampart',
				hits: obj.hits ?? 1,
				hitsMax: obj.hitsMax ?? 300000000,
				isPublic: obj.isPublic ?? false,
				ticksToDecay: obj.nextDecayTime ?? 0,
			} satisfies RampartSnapshot;

		default:
			return base;
	}
}

export function snapshotSite(obj: any, resolver: PlayerResolver): SiteSnapshot {
	return {
		kind: 'site',
		id: obj._id,
		pos: snapPos(obj),
		structureType: obj.structureType,
		owner: snapOwner(obj, resolver)!,
		progress: obj.progress ?? 0,
		progressTotal: obj.progressTotal ?? 0,
	};
}

export function snapshotSource(obj: any): SourceSnapshot {
	return {
		kind: 'source',
		id: obj._id,
		pos: snapPos(obj),
		energy: obj.energy ?? 0,
		energyCapacity: obj.energyCapacity ?? 3000,
		ticksToRegeneration: obj.ticksToRegeneration ?? 0,
	};
}

export function snapshotMineral(obj: any): MineralSnapshot {
	return {
		kind: 'mineral',
		id: obj._id,
		pos: snapPos(obj),
		mineralType: obj.mineralType,
		mineralAmount: obj.mineralAmount ?? 0,
		ticksToRegeneration: obj.ticksToRegeneration ?? 0,
	};
}

export function snapshotObject(obj: any, resolver: PlayerResolver): ObjectSnapshot | null {
	switch (obj.type) {
		case 'creep': return snapshotCreep(obj, resolver);
		case 'constructionSite': return snapshotSite(obj, resolver);
		case 'source': return snapshotSource(obj);
		case 'mineral': return snapshotMineral(obj);
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
		case 'portal':
			return snapshotStructure(obj, resolver);
		case 'energy':
		case 'power':
			return snapshotDroppedResource(obj);
		case 'tombstone':
			return snapshotTombstone(obj);
		default:
			return null;
	}
}

function snapshotTombstone(obj: any): TombstoneSnapshot {
	return {
		kind: 'tombstone',
		id: obj._id,
		pos: snapPos(obj),
		creepName: obj.creepName ?? '',
		deathTime: obj.deathTime ?? 0,
		store: snapStore(obj),
		ticksToDecay: obj.decayTime ? obj.decayTime - (obj.deathTime ?? 0) : 0,
	};
}

function snapshotDroppedResource(obj: any): DroppedResourceSnapshot {
	const resourceType = obj.resourceType ?? obj.type ?? 'energy';
	return {
		kind: 'resource',
		id: obj._id,
		pos: snapPos(obj),
		resourceType,
		amount: obj.amount ?? obj[resourceType] ?? obj.energy ?? 0,
	};
}

const findTypeMap: Record<string, string[]> = {
	creeps: ['creep'],
	structures: [
		'controller', 'spawn', 'extension', 'tower', 'storage', 'terminal',
		'lab', 'link', 'observer', 'powerSpawn', 'extractor', 'nuker', 'factory',
		'container', 'road', 'constructedWall', 'rampart', 'keeperLair',
		'invaderCore', 'portal',
	],
	constructionSites: ['constructionSite'],
	sources: ['source'],
	minerals: ['mineral'],
	tombstones: ['tombstone'],
	ruins: ['ruin'],
	droppedResources: ['energy', 'power', 'resource'],
};

export function snapshotRoomObjects(
	objects: any[],
	findType: string,
	resolver: PlayerResolver,
): ObjectSnapshot[] {
	const allowedTypes = findTypeMap[findType];
	const results: ObjectSnapshot[] = [];
	for (const obj of objects) {
		if (allowedTypes && !allowedTypes.includes(obj.type)) continue;
		const snapshot = snapshotObject(obj, resolver);
		if (snapshot) results.push(snapshot);
	}
	return results;
}
