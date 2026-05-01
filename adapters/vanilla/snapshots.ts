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

interface PlayerResolver {
	resolvePlayerReverse(userId: string): string;
}

interface VanillaConstants {
	CONTROLLER_LEVELS?: Record<number, number>;
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

function snapSpawning(spawning: any, gameTime?: number): SpawnSnapshot['spawning'] {
	if (!spawning) return null;
	return {
		name: spawning.name,
		needTime: spawning.needTime,
		remainingTime: typeof spawning.spawnTime === 'number' && gameTime !== undefined
			? Math.max(0, spawning.spawnTime - gameTime)
			: (spawning.remainingTime ?? 0),
	};
}

function snapRemaining(abs: unknown, gameTime?: number): number | null {
	if (typeof abs !== 'number') return null;
	return gameTime !== undefined ? Math.max(0, abs - gameTime) : abs;
}

function snapPortalDestination(dest: any): PortalDestinationSnapshot {
	if (dest?.shard) {
		return { shard: dest.shard, room: dest.room ?? '' };
	}
	return {
		x: dest?.x ?? 0,
		y: dest?.y ?? 0,
		roomName: dest?.roomName ?? dest?.room ?? '',
	};
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

export function snapshotStructure(
	obj: any,
	resolver: PlayerResolver,
	gameTime?: number,
	constants?: VanillaConstants,
): StructureSnapshot {
	const base: StructureSnapshotBase = {
		kind: 'structure',
		id: obj._id,
		pos: snapPos(obj),
		structureType: obj.type,
		owner: snapOwner(obj, resolver),
		...(obj.hits !== undefined ? { hits: obj.hits, hitsMax: obj.hitsMax } : {}),
	};

	switch (obj.type) {
		case 'controller': {
			// Engine stores `downgradeTime`, `safeMode`, `safeModeCooldown`
			// as absolute tick counts; the player API getters
			// (engine/dist/game/structures.js:178 etc.) report
			// `field - Game.time`. Snapshot fields name themselves after
			// the player API, so they must report remaining ticks too.
			const absToRel = (abs: unknown): number | undefined => {
				if (typeof abs !== 'number' || gameTime === undefined) return undefined;
				return Math.max(0, abs - gameTime);
			};
			const safeModeRel = absToRel(obj.safeMode);
			const level = obj.level ?? 0;
			return {
				...base,
				structureType: 'controller',
				level,
				progress: obj.progress ?? 0,
				progressTotal: level > 0 && level < 8
					? (constants?.CONTROLLER_LEVELS?.[level] ?? obj.progressTotal ?? 0)
					: null,
				ticksToDowngrade: absToRel(obj.downgradeTime) ?? 0,
				safeMode: safeModeRel && safeModeRel > 0 ? safeModeRel : undefined,
				safeModeAvailable: obj.safeModeAvailable ?? 0,
				safeModeCooldown: absToRel(obj.safeModeCooldown) ?? 0,
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
		}

		case 'spawn':
			return {
				...base,
				structureType: 'spawn',
				hits: obj.hits ?? 5000,
				hitsMax: obj.hitsMax ?? 5000,
				name: obj.name ?? 'Spawn1',
				store: snapStore(obj),
				storeCapacity: obj.storeCapacity ?? 300,
				spawning: snapSpawning(obj.spawning, gameTime),
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

		case 'observer':
			return {
				...base,
				structureType: 'observer',
				hits: obj.hits ?? 500,
				hitsMax: obj.hitsMax ?? 500,
				cooldown: snapCooldown(obj, gameTime),
			} satisfies ObserverSnapshot;

		case 'keeperLair':
			return {
				...base,
				structureType: 'keeperLair',
				ticksToSpawn: snapRemaining(obj.nextSpawnTime, gameTime),
			} satisfies KeeperLairSnapshot;

		case 'invaderCore':
			return {
				...base,
				structureType: 'invaderCore',
				hits: obj.hits ?? 100000,
				hitsMax: obj.hitsMax ?? 100000,
				level: obj.level ?? 0,
				spawning: obj.spawning ?? null,
				ticksToDeploy: snapRemaining(obj.deployTime, gameTime),
				effects: obj.effects ?? [],
				...(obj.templateName !== undefined ? { templateName: obj.templateName } : {}),
				...(obj.strongholdId !== undefined ? { strongholdId: obj.strongholdId } : {}),
			} satisfies InvaderCoreSnapshot;

		case 'powerBank':
			return {
				...base,
				structureType: 'powerBank',
				hits: obj.hits ?? 2000000,
				hitsMax: obj.hitsMax ?? 2000000,
				power: obj.store?.power ?? obj.power ?? 0,
				ticksToDecay: snapRemaining(obj.decayTime ?? obj.nextDecayTime, gameTime),
			} satisfies PowerBankSnapshot;

		case 'portal':
			return {
				...base,
				structureType: 'portal',
				destination: snapPortalDestination(obj.destination),
				ticksToDecay: snapRemaining(obj.decayTime, gameTime),
			} satisfies PortalSnapshot;

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

function snapshotDeposit(obj: any, gameTime?: number): DepositSnapshot {
	return {
		kind: 'deposit',
		id: obj._id,
		pos: snapPos(obj),
		depositType: obj.depositType,
		lastCooldown: obj.lastCooldown ?? 0,
		cooldown: snapCooldown(obj, gameTime),
		ticksToDecay: snapRemaining(obj.decayTime, gameTime),
	};
}

function snapshotRuin(obj: any, gameTime?: number): RuinSnapshot {
	// Engine-created ruins (from _destroy processor) store the structure type
	// inside obj.structure.type. Adapter-placed ruins (placeRuin) store it
	// as obj.structureType. Handle both.
	const structureType: string = obj.structureType ?? obj.structure?.type ?? '';
	let ticksToDecay = 0;
	if (typeof obj.decayTime === 'number') {
		ticksToDecay = gameTime !== undefined
			? Math.max(0, obj.decayTime - gameTime)
			: obj.decayTime - (obj.destroyTime ?? 0);
	}
	return {
		kind: 'ruin',
		id: obj._id,
		pos: snapPos(obj),
		structureType,
		destroyTime: obj.destroyTime ?? 0,
		store: snapStore(obj),
		ticksToDecay,
	};
}

export function snapshotObject(
	obj: any,
	resolver: PlayerResolver,
	gameTime?: number,
	constants?: VanillaConstants,
): ObjectSnapshot | null {
	switch (obj.type) {
		case 'creep': return snapshotCreep(obj, resolver, gameTime);
		case 'constructionSite': return snapshotSite(obj, resolver);
		case 'source': return snapshotSource(obj, gameTime);
		case 'mineral': return snapshotMineral(obj, gameTime);
		case 'deposit': return snapshotDeposit(obj, gameTime);
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

function snapshotTombstone(obj: any, gameTime?: number): TombstoneSnapshot {
	let ticksToDecay = 0;
	if (typeof obj.decayTime === 'number') {
		ticksToDecay = gameTime !== undefined
			? Math.max(0, obj.decayTime - gameTime)
			: obj.decayTime - (obj.deathTime ?? 0);
	}
	return {
		kind: 'tombstone',
		id: obj._id,
		pos: snapPos(obj),
		creepName: obj.creepName ?? '',
		deathTime: obj.deathTime ?? 0,
		store: snapStore(obj),
		ticksToDecay,
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
	gameTime?: number,
	constants?: VanillaConstants,
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
