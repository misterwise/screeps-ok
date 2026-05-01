import type {
	ObjectSnapshot, CreepSnapshot, StructureSnapshot, StructureSnapshotBase,
	ControllerSnapshot, SpawnSnapshot, LabSnapshot, TowerSnapshot,
	StorageSnapshot, LinkSnapshot, RampartSnapshot,
	TerminalSnapshot, FactorySnapshot, ExtensionSnapshot,
	ContainerSnapshot, ExtractorSnapshot, RoadSnapshot,
	NukerSnapshot, PowerSpawnSnapshot, ObserverSnapshot,
	KeeperLairSnapshot, PortalSnapshot, WallSnapshot,
	SiteSnapshot, SourceSnapshot, MineralSnapshot,
	TombstoneSnapshot, RuinSnapshot, DroppedResourceSnapshot,
	PortalDestinationSnapshot,
} from '../../src/snapshots/common.js';
import * as C from 'xxscreeps/game/constants/index.js';
import { Creep } from 'xxscreeps/mods/creep/creep.js';
import { ConstructionSite } from 'xxscreeps/mods/construction/construction-site.js';
import { Resource } from 'xxscreeps/mods/resource/resource.js';
import { Source } from 'xxscreeps/mods/source/source.js';
import { Mineral } from 'xxscreeps/mods/mineral/mineral.js';
import { Tombstone } from 'xxscreeps/mods/creep/tombstone.js';
import { Ruin } from 'xxscreeps/mods/structure/ruin.js';
import { iterateRoomObjects, readRawOwnerId } from './engine-internals.js';
// Adapter reference for player handle resolution
interface PlayerResolver {
	resolvePlayerReverse(userId: string): string;
	resolveSnapshotCooldown?(id: string): number | undefined;
}

function snapPos(obj: any) {
	return { x: obj.pos.x, y: obj.pos.y, roomName: obj.pos.roomName };
}

function snapOwner(obj: any, resolver: PlayerResolver): string | undefined {
	const user = readRawOwnerId(obj);
	return user ? resolver.resolvePlayerReverse(user) : undefined;
}

function snapStore(obj: any): Record<string, number> {
	const store: Record<string, number> = {};
	if (obj.store) {
		for (const [resource, amount] of Object.entries(obj.store)) {
			if (typeof amount === 'number' && amount > 0) {
				store[resource] = amount as number;
			}
		}
	}
	return store;
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
				progressTotal: obj.level > 0 && obj.level < 8
					? (C.CONTROLLER_LEVELS[obj.level] ?? obj.progressTotal ?? 0)
					: null,
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

		case 'terminal':
			return {
				...base,
				structureType: 'terminal',
				hits: obj.hits,
				hitsMax: obj.hitsMax,
				store: snapStore(obj),
				storeCapacity: obj.store?.getCapacity?.() ?? 0,
				cooldown: obj.cooldown ?? 0,
			} satisfies TerminalSnapshot;

		case 'factory':
			return {
				...base,
				structureType: 'factory',
				hits: obj.hits,
				hitsMax: obj.hitsMax,
				store: snapStore(obj),
				storeCapacity: obj.store?.getCapacity?.() ?? 0,
				cooldown: obj.cooldown ?? 0,
				level: obj.level ?? 0,
			} satisfies FactorySnapshot;

		case 'extension':
			return {
				...base,
				structureType: 'extension',
				hits: obj.hits,
				hitsMax: obj.hitsMax,
				store: snapStore(obj),
				storeCapacity: obj.store?.getCapacity?.() ?? 0,
			} satisfies ExtensionSnapshot;

		case 'container':
			return {
				...base,
				structureType: 'container',
				hits: obj.hits,
				hitsMax: obj.hitsMax,
				store: snapStore(obj),
				storeCapacity: obj.store?.getCapacity?.() ?? 0,
				ticksToDecay: obj.ticksToDecay ?? 0,
			} satisfies ContainerSnapshot;

		case 'extractor':
			return {
				...base,
				structureType: 'extractor',
				hits: obj.hits,
				hitsMax: obj.hitsMax,
				cooldown: obj.cooldown ?? 0,
			} satisfies ExtractorSnapshot;

		case 'road':
			return {
				...base,
				structureType: 'road',
				hits: obj.hits,
				hitsMax: obj.hitsMax,
				ticksToDecay: obj.ticksToDecay ?? 0,
			} satisfies RoadSnapshot;

		case 'nuker':
			return {
				...base,
				structureType: 'nuker',
				hits: obj.hits,
				hitsMax: obj.hitsMax,
				store: snapStore(obj),
				storeCapacity: obj.store?.getCapacity?.() ?? 0,
				cooldown: obj.cooldown ?? 0,
			} satisfies NukerSnapshot;

		case 'powerSpawn':
			return {
				...base,
				structureType: 'powerSpawn',
				hits: obj.hits,
				hitsMax: obj.hitsMax,
				store: snapStore(obj),
				storeCapacity: obj.store?.getCapacity?.() ?? 0,
			} satisfies PowerSpawnSnapshot;

		case 'observer':
			return {
				...base,
				structureType: 'observer',
				hits: obj.hits,
				hitsMax: obj.hitsMax,
				cooldown: resolver.resolveSnapshotCooldown?.(obj.id) ?? obj.cooldown ?? 0,
			} satisfies ObserverSnapshot;

		case 'keeperLair':
			return {
				...base,
				structureType: 'keeperLair',
				ticksToSpawn: obj.ticksToSpawn ?? null,
			} satisfies KeeperLairSnapshot;

		case 'portal':
			return {
				...base,
				structureType: 'portal',
				destination: snapPortalDestination(obj.destination),
				ticksToDecay: obj.ticksToDecay ?? null,
			} satisfies PortalSnapshot;

		case 'constructedWall':
			return {
				...base,
				structureType: 'constructedWall',
				hits: obj.hits,
				hitsMax: obj.hitsMax,
			} satisfies WallSnapshot;

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
		creepName: obj.creep?.name ?? '',
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

function snapshotRuin(obj: any, resolver: PlayerResolver): RuinSnapshot {
	const structureType = obj.structureType
		?? obj.structure?.structureType
		?? '';
	return {
		kind: 'ruin',
		id: obj.id,
		pos: snapPos(obj),
		structureType,
		destroyTime: obj.destroyTime ?? 0,
		store: snapStore(obj),
		ticksToDecay: obj.ticksToDecay ?? 0,
	};
}

export function snapshotObject(obj: any, resolver: PlayerResolver): ObjectSnapshot | null {
	if (obj instanceof Creep) return snapshotCreep(obj, resolver);
	if (obj instanceof ConstructionSite) return snapshotSite(obj, resolver);
	if (obj instanceof Tombstone) return snapshotTombstone(obj, resolver);
	if (obj instanceof Ruin) return snapshotRuin(obj, resolver);
	if (obj instanceof Resource) return snapshotDroppedResource(obj);
	if (obj instanceof Source) return snapshotSource(obj);
	if (obj instanceof Mineral) return snapshotMineral(obj);
	if (obj.structureType) return snapshotStructure(obj, resolver);
	return null;
}

export function snapshotRoom(room: any, findType: string, resolver: PlayerResolver): ObjectSnapshot[] {
	const results: ObjectSnapshot[] = [];
	for (const obj of iterateRoomObjects(room)) {
		let match = false;
		switch (findType) {
			case 'creeps':
				match = obj instanceof Creep;
				break;
			case 'constructionSites':
				match = obj instanceof ConstructionSite;
				break;
			case 'structures':
				match = !(obj instanceof ConstructionSite) && !!obj.structureType;
				break;
			case 'sources':
				match = obj instanceof Source;
				break;
			case 'minerals':
				match = obj instanceof Mineral;
				break;
			case 'tombstones':
				match = obj instanceof Tombstone;
				break;
			case 'droppedResources':
				match = obj instanceof Resource;
				break;
			case 'ruins':
				match = obj instanceof Ruin;
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
