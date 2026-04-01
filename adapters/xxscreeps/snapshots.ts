import type {
	ObjectSnapshot, CreepSnapshot, StructureSnapshot, StructureSnapshotBase,
	ControllerSnapshot, SpawnSnapshot, LabSnapshot, TowerSnapshot,
	StorageSnapshot, LinkSnapshot, RampartSnapshot,
	SiteSnapshot, SourceSnapshot, MineralSnapshot,
	TombstoneSnapshot, DroppedResourceSnapshot,
} from '../../src/snapshots/common.js';
// Adapter reference for player handle resolution
interface PlayerResolver {
	resolvePlayerReverse(userId: string): string;
}

function snapPos(obj: any) {
	return { x: obj.pos.x, y: obj.pos.y, roomName: obj.pos.roomName };
}

function snapOwner(obj: any, resolver: PlayerResolver): string | undefined {
	const user = obj['#user'] ?? obj.owner?.username;
	return user ? resolver.resolvePlayerReverse(user) : undefined;
}

function snapStore(obj: any): Record<string, number> {
	const store: Record<string, number> = {};
	if (obj.store) {
		// xxscreeps stores have a #entries() method; plain objects use Object.entries
		const entries = typeof obj.store['#entries'] === 'function'
			? obj.store['#entries']()
			: Object.entries(obj.store);
		for (const [resource, amount] of entries) {
			if (typeof amount === 'number' && amount > 0) {
				store[resource] = amount;
			}
		}
	}
	return store;
}

export function snapshotCreep(obj: any, resolver: PlayerResolver): CreepSnapshot {
	return {
		kind: 'creep',
		id: obj.id,
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
		ticksToLive: obj.ticksToLive,
		spawning: obj.spawning ?? false,
		store: snapStore(obj),
		storeCapacity: obj.store?.getCapacity?.() ?? 0,
	};
}

export function snapshotStructure(obj: any, resolver: PlayerResolver): StructureSnapshot {
	const base: StructureSnapshotBase = {
		kind: 'structure',
		id: obj.id,
		pos: snapPos(obj),
		structureType: obj.structureType,
		owner: snapOwner(obj, resolver),
		...(obj.hits !== undefined ? { hits: obj.hits, hitsMax: obj.hitsMax } : {}),
	};

	switch (obj.structureType) {
		case 'controller':
			return {
				...base,
				structureType: 'controller',
				level: obj.level,
				progress: obj.progress ?? 0,
				progressTotal: obj.level >= 8 ? null : (obj.progressTotal ?? 0),
				ticksToDowngrade: obj.ticksToDowngrade ?? 0,
				safeMode: obj.safeMode,
				safeModeAvailable: obj.safeModeAvailable ?? 0,
				safeModeCooldown: obj.safeModeCooldown ?? 0,
				isPowerEnabled: obj.isPowerEnabled ?? false,
				...(obj.reservation ? {
					reservation: {
						owner: resolver.resolvePlayerReverse(obj.reservation.username),
						ticksToEnd: obj.reservation.ticksToEnd,
					},
				} : {}),
				...(obj.sign ? {
					sign: {
						owner: resolver.resolvePlayerReverse(obj.sign.username),
						text: obj.sign.text,
						time: obj.sign.time,
					},
				} : {}),
			} satisfies ControllerSnapshot;

		case 'spawn':
			return {
				...base,
				structureType: 'spawn',
				hits: obj.hits,
				hitsMax: obj.hitsMax,
				name: obj.name,
				store: snapStore(obj),
				storeCapacity: obj.store?.getCapacity?.() ?? 0,
				spawning: obj.spawning ? {
					name: obj.spawning.name,
					needTime: obj.spawning.needTime,
					remainingTime: obj.spawning.remainingTime,
				} : null,
			} satisfies SpawnSnapshot;

		case 'lab':
			return {
				...base,
				structureType: 'lab',
				hits: obj.hits,
				hitsMax: obj.hitsMax,
				store: snapStore(obj),
				storeCapacityByResource: {
					energy: obj.store?.getCapacity?.('energy') ?? 2000,
					...(obj.mineralType ? { [obj.mineralType]: obj.store?.getCapacity?.(obj.mineralType) ?? 3000 } : {}),
				},
				cooldown: obj.cooldown ?? 0,
				mineralType: obj.mineralType ?? null,
			} satisfies LabSnapshot;

		case 'tower':
			return {
				...base,
				structureType: 'tower',
				hits: obj.hits,
				hitsMax: obj.hitsMax,
				store: snapStore(obj),
				storeCapacity: obj.store?.getCapacity?.() ?? 0,
			} satisfies TowerSnapshot;

		case 'storage':
			return {
				...base,
				structureType: 'storage',
				hits: obj.hits,
				hitsMax: obj.hitsMax,
				store: snapStore(obj),
				storeCapacity: obj.store?.getCapacity?.() ?? 0,
			} satisfies StorageSnapshot;

		case 'link':
			return {
				...base,
				structureType: 'link',
				hits: obj.hits,
				hitsMax: obj.hitsMax,
				store: snapStore(obj),
				storeCapacity: obj.store?.getCapacity?.() ?? 0,
				cooldown: obj.cooldown ?? 0,
			} satisfies LinkSnapshot;

		case 'rampart':
			return {
				...base,
				structureType: 'rampart',
				hits: obj.hits,
				hitsMax: obj.hitsMax,
				isPublic: obj.isPublic ?? false,
				ticksToDecay: obj.ticksToDecay ?? 0,
			} satisfies RampartSnapshot;

		default:
			return base;
	}
}

export function snapshotSite(obj: any, resolver: PlayerResolver): SiteSnapshot {
	return {
		kind: 'site',
		id: obj.id,
		pos: snapPos(obj),
		structureType: obj.structureType,
		owner: snapOwner(obj, resolver)!,
		progress: obj.progress,
		progressTotal: obj.progressTotal,
	};
}

export function snapshotSource(obj: any): SourceSnapshot {
	return {
		kind: 'source',
		id: obj.id,
		pos: snapPos(obj),
		energy: obj.energy,
		energyCapacity: obj.energyCapacity,
		ticksToRegeneration: obj.ticksToRegeneration ?? 0,
	};
}

export function snapshotMineral(obj: any): MineralSnapshot {
	return {
		kind: 'mineral',
		id: obj.id,
		pos: snapPos(obj),
		mineralType: obj.mineralType,
		mineralAmount: obj.mineralAmount,
		ticksToRegeneration: obj.ticksToRegeneration ?? 0,
	};
}

export function getStructureType(obj: any): string | undefined {
	try {
		return obj.structureType;
	} catch {
		return undefined;
	}
}

function snapshotTombstone(obj: any, resolver: PlayerResolver): TombstoneSnapshot {
	return {
		kind: 'tombstone',
		id: obj.id,
		pos: snapPos(obj),
		creepName: obj.name ?? obj.creepName ?? '',
		deathTime: obj.deathTime ?? 0,
		store: snapStore(obj),
		ticksToDecay: obj.ticksToDecay ?? 0,
	};
}

function snapshotDroppedResource(obj: any): DroppedResourceSnapshot {
	return {
		kind: 'resource',
		id: obj.id,
		pos: snapPos(obj),
		resourceType: obj.resourceType ?? 'energy',
		amount: obj.amount ?? 0,
	};
}

export function snapshotObject(obj: any, resolver: PlayerResolver): ObjectSnapshot | null {
	// Determine type from xxscreeps object shape
	// Order matters: check more specific types before general ones
	if (obj.body && obj.fatigue !== undefined) return snapshotCreep(obj, resolver);
	if (obj.progressTotal !== undefined) return snapshotSite(obj, resolver);
	if (obj.deathTime !== undefined && !obj.body) return snapshotTombstone(obj, resolver);
	if (obj.resourceType !== undefined && obj.amount !== undefined) return snapshotDroppedResource(obj);
	const sType = getStructureType(obj);
	if (sType) return snapshotStructure(obj, resolver);
	if (obj.energyCapacity !== undefined) return snapshotSource(obj);
	if (obj.mineralType !== undefined) return snapshotMineral(obj);
	return null;
}

export function snapshotRoom(room: any, findType: string, resolver: PlayerResolver): ObjectSnapshot[] {
	const results: ObjectSnapshot[] = [];
	for (const obj of room['#objects']) {
		let match = false;
		switch (findType) {
			case 'creeps':
				match = obj.body !== undefined && obj.fatigue !== undefined;
				break;
			case 'constructionSites':
				match = obj.progressTotal !== undefined;
				break;
			case 'structures':
				match = !!getStructureType(obj) && obj.progressTotal === undefined;
				break;
			case 'sources':
				match = obj.energyCapacity !== undefined && !getStructureType(obj);
				break;
			case 'minerals':
				match = obj.mineralType !== undefined;
				break;
			case 'tombstones':
				match = obj.deathTime !== undefined && !obj.body;
				break;
			case 'droppedResources':
				match = obj.resourceType !== undefined && obj.amount !== undefined;
				break;
			default:
				match = true;
		}
		if (match) {
			const snapshot = snapshotObject(obj, resolver);
			if (snapshot) results.push(snapshot);
		}
	}
	return results;
}
