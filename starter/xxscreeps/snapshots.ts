import type {
	ObjectSnapshot, CreepSnapshot, StructureSnapshot, StructureSnapshotBase,
	ControllerSnapshot, SpawnSnapshot, LabSnapshot, TowerSnapshot,
	StorageSnapshot, LinkSnapshot, RampartSnapshot,
	TerminalSnapshot, FactorySnapshot, ExtensionSnapshot,
	ContainerSnapshot, ExtractorSnapshot, RoadSnapshot,
	NukerSnapshot, PowerSpawnSnapshot, ObserverSnapshot,
	KeeperLairSnapshot, InvaderCoreSnapshot, PowerBankSnapshot, PortalSnapshot, WallSnapshot,
	SiteSnapshot, SourceSnapshot, MineralSnapshot, DepositSnapshot,
	TombstoneSnapshot, RuinSnapshot, DroppedResourceSnapshot,
	PortalDestinationSnapshot,
} from 'screeps-ok';
import * as C from 'xxscreeps:mods/constants';
import { Creep } from 'xxscreeps/mods/classic/creep/creep.js';
import { ConstructionSite } from 'xxscreeps/mods/classic/construction/construction-site.js';
import { Resource } from 'xxscreeps/mods/classic/resource/resource.js';
import { Source } from 'xxscreeps/mods/classic/source/source.js';
import { Mineral } from 'xxscreeps/mods/classic/mineral/mineral.js';
import { Deposit } from 'xxscreeps/mods/modern/deposit/deposit.js';
import { Tombstone } from 'xxscreeps/mods/classic/creep/tombstone.js';
import { Ruin } from 'xxscreeps/mods/classic/structure/ruin.js';
import { Nuke } from 'xxscreeps/mods/modern/nuker/nuke.js';
import {
	iterateRoomObjects, readRawOwnerId, readRawReservation, readRawSign,
} from './engine-internals.js';
// Adapter reference for player handle resolution
interface PlayerResolver {
	resolvePlayerReverse(userId: string): string;
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
	return dest.shard
		? { shard: dest.shard, room: dest.room }
		: { x: dest.x, y: dest.y, roomName: dest.roomName };
}

function snapEffects(obj: any): InvaderCoreSnapshot['effects'] {
	const effects = obj.effects;
	if (!effects) return null;
	return effects.map((e: any) => ({
		effect: e.effect,
		...(e.level !== undefined ? { level: e.level } : {}),
		...(e.power !== undefined ? { power: e.power } : {}),
		ticksRemaining: e.ticksRemaining,
	}));
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
		ticksToLive: obj.ticksToLive ?? null,
		spawning: obj.spawning,
		store: snapStore(obj),
		storeCapacity: obj.store.getCapacity() ?? null,
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
		case 'controller': {
			const reservation = readRawReservation(obj);
			const sign = readRawSign(obj);
			return {
				...base,
				structureType: 'controller',
				level: obj.level,
				progress: obj.progress ?? null,
				progressTotal: obj.progressTotal ?? null,
				ticksToDowngrade: obj.ticksToDowngrade ?? null,
				safeMode: obj.safeMode ?? null,
				safeModeAvailable: obj.safeModeAvailable,
				safeModeCooldown: obj.safeModeCooldown ?? null,
				isPowerEnabled: obj.isPowerEnabled,
				reservation: reservation ? {
					owner: resolver.resolvePlayerReverse(reservation.userId),
					ticksToEnd: reservation.ticksToEnd,
				} : null,
				sign: sign ? {
					owner: resolver.resolvePlayerReverse(sign.userId),
					text: sign.text,
					time: sign.time,
				} : null,
			} satisfies ControllerSnapshot;
		}

		case 'spawn':
			return {
				...base,
				structureType: 'spawn',
				hits: obj.hits,
				hitsMax: obj.hitsMax,
				name: obj.name,
				store: snapStore(obj),
				storeCapacity: obj.store.getCapacity() ?? null,
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
					energy: obj.store.getCapacity(C.RESOURCE_ENERGY),
					...(obj.mineralType ? { [obj.mineralType]: obj.store.getCapacity(obj.mineralType) } : {}),
				},
				cooldown: obj.cooldown,
				mineralType: obj.mineralType ?? null,
			} satisfies LabSnapshot;

		case 'tower':
			return {
				...base,
				structureType: 'tower',
				hits: obj.hits,
				hitsMax: obj.hitsMax,
				store: snapStore(obj),
				storeCapacity: obj.store.getCapacity() ?? null,
			} satisfies TowerSnapshot;

		case 'storage':
			return {
				...base,
				structureType: 'storage',
				hits: obj.hits,
				hitsMax: obj.hitsMax,
				store: snapStore(obj),
				storeCapacity: obj.store.getCapacity() ?? null,
			} satisfies StorageSnapshot;

		case 'link':
			return {
				...base,
				structureType: 'link',
				hits: obj.hits,
				hitsMax: obj.hitsMax,
				store: snapStore(obj),
				storeCapacity: obj.store.getCapacity() ?? null,
				cooldown: obj.cooldown,
			} satisfies LinkSnapshot;

		case 'rampart':
			return {
				...base,
				structureType: 'rampart',
				hits: obj.hits,
				hitsMax: obj.hitsMax,
				isPublic: obj.isPublic,
				ticksToDecay: obj.ticksToDecay ?? null,
			} satisfies RampartSnapshot;

		case 'terminal':
			return {
				...base,
				structureType: 'terminal',
				hits: obj.hits,
				hitsMax: obj.hitsMax,
				store: snapStore(obj),
				storeCapacity: obj.store.getCapacity() ?? null,
				cooldown: obj.cooldown,
			} satisfies TerminalSnapshot;

		case 'factory':
			return {
				...base,
				structureType: 'factory',
				hits: obj.hits,
				hitsMax: obj.hitsMax,
				store: snapStore(obj),
				storeCapacity: obj.store.getCapacity() ?? null,
				cooldown: obj.cooldown,
				level: obj.level ?? null,
			} satisfies FactorySnapshot;

		case 'extension':
			return {
				...base,
				structureType: 'extension',
				hits: obj.hits,
				hitsMax: obj.hitsMax,
				store: snapStore(obj),
				storeCapacity: obj.store.getCapacity() ?? null,
			} satisfies ExtensionSnapshot;

		case 'container':
			return {
				...base,
				structureType: 'container',
				hits: obj.hits,
				hitsMax: obj.hitsMax,
				store: snapStore(obj),
				storeCapacity: obj.store.getCapacity() ?? null,
				ticksToDecay: obj.ticksToDecay ?? null,
			} satisfies ContainerSnapshot;

		case 'extractor':
			return {
				...base,
				structureType: 'extractor',
				hits: obj.hits,
				hitsMax: obj.hitsMax,
				cooldown: obj.cooldown,
			} satisfies ExtractorSnapshot;

		case 'road':
			return {
				...base,
				structureType: 'road',
				hits: obj.hits,
				hitsMax: obj.hitsMax,
				ticksToDecay: obj.ticksToDecay ?? null,
			} satisfies RoadSnapshot;

		case 'nuker':
			return {
				...base,
				structureType: 'nuker',
				hits: obj.hits,
				hitsMax: obj.hitsMax,
				store: snapStore(obj),
				storeCapacity: obj.store.getCapacity() ?? null,
				cooldown: obj.cooldown,
			} satisfies NukerSnapshot;

		case 'powerSpawn':
			return {
				...base,
				structureType: 'powerSpawn',
				hits: obj.hits,
				hitsMax: obj.hitsMax,
				store: snapStore(obj),
				storeCapacity: obj.store.getCapacity() ?? null,
			} satisfies PowerSpawnSnapshot;

		case 'observer':
			return {
				...base,
				structureType: 'observer',
				hits: obj.hits,
				hitsMax: obj.hitsMax,
			} satisfies ObserverSnapshot;

		case 'keeperLair':
			return {
				...base,
				structureType: 'keeperLair',
				ticksToSpawn: obj.ticksToSpawn ?? null,
			} satisfies KeeperLairSnapshot;

		case 'invaderCore':
			return {
				...base,
				structureType: 'invaderCore',
				hits: obj.hits,
				hitsMax: obj.hitsMax,
				level: obj.level,
				spawning: obj.spawning ? {
					name: obj.spawning.name,
					needTime: obj.spawning.needTime,
					remainingTime: obj.spawning.remainingTime,
				} : null,
				ticksToDeploy: obj.ticksToDeploy ?? null,
				effects: snapEffects(obj),
			} satisfies InvaderCoreSnapshot;

		case 'powerBank':
			return {
				...base,
				structureType: 'powerBank',
				hits: obj.hits,
				hitsMax: obj.hitsMax,
				power: obj.power,
				ticksToDecay: obj.ticksToDecay ?? null,
			} satisfies PowerBankSnapshot;

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
		ticksToRegeneration: obj.ticksToRegeneration ?? null,
	};
}

export function snapshotMineral(obj: any): MineralSnapshot {
	return {
		kind: 'mineral',
		id: obj.id,
		pos: snapPos(obj),
		mineralType: obj.mineralType,
		mineralAmount: obj.mineralAmount,
		density: obj.density,
		ticksToRegeneration: obj.ticksToRegeneration ?? null,
	};
}

export function snapshotDeposit(obj: any): DepositSnapshot {
	return {
		kind: 'deposit',
		id: obj.id,
		pos: snapPos(obj),
		depositType: obj.depositType,
		lastCooldown: obj.lastCooldown,
		cooldown: obj.cooldown,
		ticksToDecay: obj.ticksToDecay ?? null,
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
		creepName: obj.creep.name,
		deathTime: obj.deathTime,
		store: snapStore(obj),
		ticksToDecay: obj.ticksToDecay,
	};
}

function snapshotDroppedResource(obj: any): DroppedResourceSnapshot {
	return {
		kind: 'resource',
		id: obj.id,
		pos: snapPos(obj),
		resourceType: obj.resourceType,
		amount: obj.amount,
	};
}

function snapshotRuin(obj: any, resolver: PlayerResolver): RuinSnapshot {
	return {
		kind: 'ruin',
		id: obj.id,
		pos: snapPos(obj),
		structureType: obj.structure.structureType,
		destroyTime: obj.destroyTime,
		store: snapStore(obj),
		ticksToDecay: obj.ticksToDecay,
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
	if (obj instanceof Deposit) return snapshotDeposit(obj);
	if (obj.structureType) return snapshotStructure(obj, resolver);
	return null;
}

// The single position-key kind an object registers under (see the placeXxx
// keys in index.ts), or undefined if it isn't position-keyed (creeps key by
// name). The ID-map rebuild probes only this kind so co-located objects — a
// creep standing on a construction site, a mineral under an extractor — can't
// steal each other's handle. ConstructionSite/Ruin carry a `structureType`
// (the target/former type), so their instanceof checks must precede the
// structure fallback.
export function posKeyKind(obj: any): string | undefined {
	if (obj instanceof Creep) return undefined;
	if (obj instanceof ConstructionSite) return 'constructionSite';
	if (obj instanceof Tombstone) return 'tombstone';
	if (obj instanceof Ruin) return 'ruin';
	if (obj instanceof Resource) return 'resource';
	if (obj instanceof Source) return 'source';
	if (obj instanceof Mineral) return 'mineral';
	if (obj instanceof Deposit) return 'deposit';
	if (obj instanceof Nuke) return 'nuke';
	return getStructureType(obj);
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
			case 'deposits':
				match = obj instanceof Deposit;
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
