import type {
	ObjectSnapshot, CreepSnapshot, StructureSnapshot, StructureSnapshotBase,
	ControllerSnapshot, SpawnSnapshot, LabSnapshot, TowerSnapshot,
	StorageSnapshot, LinkSnapshot, RampartSnapshot,
	TerminalSnapshot, FactorySnapshot, ExtensionSnapshot,
	ContainerSnapshot, ExtractorSnapshot, RoadSnapshot,
	NukerSnapshot, PowerSpawnSnapshot, WallSnapshot,
	SiteSnapshot, SourceSnapshot, MineralSnapshot,
	TombstoneSnapshot, RuinSnapshot, DroppedResourceSnapshot,
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

export function snapshotCreep(obj: any, resolver: PlayerResolver, gameTime?: number): CreepSnapshot {
	// The runtime computes ticksToLive as ageTime - Game.time. The DB
	// stores ageTime (absolute) but the raw ticksToLive field is never
	// updated after placement. Compute the player-visible value.
	let ttl: number;
	if (obj.ageTime && gameTime !== undefined) {
		ttl = obj.ageTime - gameTime;
	} else {
		ttl = obj.ticksToLive ?? obj.ageTime ?? 1500;
	}

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
		ticksToLive: ttl,
		spawning: obj.spawning ?? false,
		store: snapStore(obj),
		storeCapacity: obj.storeCapacity ?? 0,
	};
}

/** Derive the cooldown remaining from an absolute cooldownTime field. */
function snapCooldown(obj: any, gameTime?: number): number {
	if (obj.cooldownTime && gameTime !== undefined) {
		return Math.max(0, obj.cooldownTime - gameTime);
	}
	return obj.cooldown ?? 0;
}

/** Derive mineralType from the lab store (first non-energy key with amount > 0). */
function snapLabMineralType(obj: any): string | null {
	if (obj.store && typeof obj.store === 'object') {
		for (const key of Object.keys(obj.store)) {
			if (key !== 'energy' && typeof obj.store[key] === 'number' && obj.store[key] > 0) {
				return key;
			}
		}
	}
	return null;
}

export function snapshotStructure(obj: any, resolver: PlayerResolver, gameTime?: number): StructureSnapshot {
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

		case 'lab': {
			const labMineral = snapLabMineralType(obj);
			return {
				...base,
				structureType: 'lab',
				hits: obj.hits ?? 500,
				hitsMax: obj.hitsMax ?? 500,
				store: snapStore(obj),
				storeCapacityByResource: {
					energy: 2000,
					...(labMineral ? { [labMineral]: 3000 } : {}),
				},
				cooldown: snapCooldown(obj, gameTime),
				mineralType: labMineral,
			} satisfies LabSnapshot;
		}

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
				cooldown: snapCooldown(obj, gameTime),
			} satisfies LinkSnapshot;

		case 'rampart':
			return {
				...base,
				structureType: 'rampart',
				hits: obj.hits ?? 1,
				hitsMax: obj.hitsMax ?? 300000000,
				isPublic: obj.isPublic ?? false,
				ticksToDecay: obj.nextDecayTime && gameTime !== undefined
					? Math.max(0, obj.nextDecayTime - gameTime) : 0,
			} satisfies RampartSnapshot;

		case 'terminal':
			return {
				...base,
				structureType: 'terminal',
				hits: obj.hits ?? 3000,
				hitsMax: obj.hitsMax ?? 3000,
				store: snapStore(obj),
				storeCapacity: obj.storeCapacity ?? 300000,
				cooldown: snapCooldown(obj, gameTime),
			} satisfies TerminalSnapshot;

		case 'factory':
			return {
				...base,
				structureType: 'factory',
				hits: obj.hits ?? 1000,
				hitsMax: obj.hitsMax ?? 1000,
				store: snapStore(obj),
				storeCapacity: obj.storeCapacity ?? 50000,
				cooldown: snapCooldown(obj, gameTime),
				level: obj.level ?? 0,
			} satisfies FactorySnapshot;

		case 'extension':
			return {
				...base,
				structureType: 'extension',
				hits: obj.hits ?? 1000,
				hitsMax: obj.hitsMax ?? 1000,
				store: snapStore(obj),
				storeCapacity: obj.storeCapacity ?? 200,
			} satisfies ExtensionSnapshot;

		case 'container':
			return {
				...base,
				structureType: 'container',
				hits: obj.hits ?? 250000,
				hitsMax: obj.hitsMax ?? 250000,
				store: snapStore(obj),
				storeCapacity: obj.storeCapacity ?? 2000,
				ticksToDecay: obj.nextDecayTime && gameTime !== undefined
					? Math.max(0, obj.nextDecayTime - gameTime) : 0,
			} satisfies ContainerSnapshot;

		case 'extractor':
			return {
				...base,
				structureType: 'extractor',
				hits: obj.hits ?? 500,
				hitsMax: obj.hitsMax ?? 500,
				cooldown: snapCooldown(obj, gameTime),
			} satisfies ExtractorSnapshot;

		case 'road':
			return {
				...base,
				structureType: 'road',
				hits: obj.hits ?? 5000,
				hitsMax: obj.hitsMax ?? 5000,
				ticksToDecay: obj.nextDecayTime && gameTime !== undefined
					? Math.max(0, obj.nextDecayTime - gameTime) : 0,
			} satisfies RoadSnapshot;

		case 'nuker':
			return {
				...base,
				structureType: 'nuker',
				hits: obj.hits ?? 1000,
				hitsMax: obj.hitsMax ?? 1000,
				store: snapStore(obj),
				storeCapacity: obj.storeCapacity ?? 305000,
				cooldown: snapCooldown(obj, gameTime),
			} satisfies NukerSnapshot;

		case 'powerSpawn':
			return {
				...base,
				structureType: 'powerSpawn',
				hits: obj.hits ?? 5000,
				hitsMax: obj.hitsMax ?? 5000,
				store: snapStore(obj),
				storeCapacity: obj.storeCapacity ?? 5100,
			} satisfies PowerSpawnSnapshot;

		case 'constructedWall':
			return {
				...base,
				structureType: 'constructedWall',
				hits: obj.hits ?? 1,
				hitsMax: obj.hitsMax ?? 300000000,
			} satisfies WallSnapshot;

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

export function snapshotSource(obj: any, gameTime?: number): SourceSnapshot {
	let ticksToRegen = 0;
	if (obj.nextRegenerationTime && gameTime !== undefined) {
		ticksToRegen = Math.max(0, obj.nextRegenerationTime - gameTime);
	} else if (obj.ticksToRegeneration) {
		ticksToRegen = obj.ticksToRegeneration;
	}
	return {
		kind: 'source',
		id: obj._id,
		pos: snapPos(obj),
		energy: obj.energy ?? 0,
		energyCapacity: obj.energyCapacity ?? 3000,
		ticksToRegeneration: ticksToRegen,
	};
}

export function snapshotMineral(obj: any, gameTime?: number): MineralSnapshot {
	let ticksToRegen = 0;
	if (obj.nextRegenerationTime && gameTime !== undefined) {
		ticksToRegen = Math.max(0, obj.nextRegenerationTime - gameTime);
	} else if (obj.ticksToRegeneration) {
		ticksToRegen = obj.ticksToRegeneration;
	}
	return {
		kind: 'mineral',
		id: obj._id,
		pos: snapPos(obj),
		mineralType: obj.mineralType,
		mineralAmount: obj.mineralAmount ?? 0,
		ticksToRegeneration: ticksToRegen,
	};
}

function snapshotRuin(obj: any): RuinSnapshot {
	// Engine-created ruins (from _destroy processor) store the structure type
	// inside obj.structure.type. Adapter-placed ruins (placeRuin) store it
	// as obj.structureType. Handle both.
	const structureType: string = obj.structureType ?? obj.structure?.type ?? '';
	return {
		kind: 'ruin',
		id: obj._id,
		pos: snapPos(obj),
		structureType,
		destroyTime: obj.destroyTime ?? 0,
		store: snapStore(obj),
		ticksToDecay: obj.decayTime ? obj.decayTime - (obj.destroyTime ?? 0) : 0,
	};
}

export function snapshotObject(obj: any, resolver: PlayerResolver, gameTime?: number): ObjectSnapshot | null {
	switch (obj.type) {
		case 'creep': return snapshotCreep(obj, resolver, gameTime);
		case 'constructionSite': return snapshotSite(obj, resolver);
		case 'source': return snapshotSource(obj, gameTime);
		case 'mineral': return snapshotMineral(obj, gameTime);
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
			return snapshotStructure(obj, resolver, gameTime);
		case 'energy':
		case 'power':
		case 'resource':
			return snapshotDroppedResource(obj);
		case 'tombstone':
			return snapshotTombstone(obj);
		case 'ruin':
			return snapshotRuin(obj);
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
		// Engine stores the live value at `obj[resourceType]` (see engine
		// game/resources.js:37 — the game object's `.amount` is a getter
		// that reads this field). `obj.amount` would be a stale duplicate
		// if anything wrote it, so prefer the canonical field.
		amount: obj[resourceType] ?? obj.energy ?? obj.amount ?? 0,
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
	gameTime?: number,
): ObjectSnapshot[] {
	const allowedTypes = findTypeMap[findType];
	const results: ObjectSnapshot[] = [];
	for (const obj of objects) {
		if (allowedTypes && !allowedTypes.includes(obj.type)) continue;
		const snapshot = snapshotObject(obj, resolver, gameTime);
		if (snapshot) results.push(snapshot);
	}
	return results;
}
