import type { ShardFixture } from '../src/fixture.js';
import { SOURCE_ENERGY_CAPACITY, TERRAIN_PLAIN, TERRAIN_WALL } from '../src/index.js';
import type { InvaderRaidRoomStateSpec, RoomSpec, TerrainSpec } from '../src/index.js';

export const ROOM = 'W1N1';
export const CORE_ROOM = 'W1N2';
export const INVADER_OWNER = 'sk';
// The Math.random() values one neutral, unescalated raid consumes.
export const ONE_CREEP_RAID_RANDOM = [0, 0.1, 0, 0, 0.001, 0.5, 0.5] as const;

export interface RaidSetupOptions {
	readonly roomName?: string;
	readonly coreRoom?: string;
	readonly coreLevel?: number | null;
	readonly exitTiles?: ReadonlyArray<readonly [number, number]>;
	readonly owner?: string;
	readonly rcl?: number;
	readonly players?: readonly string[];
	readonly extraRooms?: readonly RoomSpec[];
	readonly source?: boolean;
	readonly state?: InvaderRaidRoomStateSpec;
}

function edgeTerrain(openTiles: ReadonlyArray<readonly [number, number]>): TerrainSpec {
	const terrain = new Array(2500).fill(TERRAIN_PLAIN) as TerrainSpec;
	for (let i = 0; i < 50; i++) {
		terrain[i] = TERRAIN_WALL;
		terrain[49 * 50 + i] = TERRAIN_WALL;
		terrain[i * 50] = TERRAIN_WALL;
		terrain[i * 50 + 49] = TERRAIN_WALL;
	}
	for (const [x, y] of openTiles) {
		terrain[y * 50 + x] = TERRAIN_PLAIN;
	}
	return terrain;
}

// A raid-eligible room: walled but for `exitTiles`, a source, and a level-1
// invader core in its sector.
export async function setupRaidRoom(shard: ShardFixture, options: RaidSetupOptions = {}): Promise<void> {
	const roomName = options.roomName ?? ROOM;
	const coreRoom = options.coreRoom ?? CORE_ROOM;
	const rooms = new Map<string, RoomSpec>();
	rooms.set(roomName, {
		name: roomName,
		terrain: edgeTerrain(options.exitTiles ?? [[25, 0]]),
		...(options.owner ? { owner: options.owner, rcl: options.rcl ?? 1 } : {}),
	});
	if (options.coreLevel !== null) {
		rooms.set(coreRoom, { name: coreRoom });
	}
	for (const extraRoom of options.extraRooms ?? []) {
		rooms.set(extraRoom.name, extraRoom);
	}

	await shard.createShard({
		players: [...(options.players ?? ['p1', 'p2'])],
		rooms: [...rooms.values()],
	});

	if (options.source ?? true) {
		await shard.placeSource(roomName, { pos: [25, 25], energy: SOURCE_ENERGY_CAPACITY, energyCapacity: SOURCE_ENERGY_CAPACITY });
	}
	if (options.coreLevel !== null) {
		await shard.placeObject(coreRoom, 'invaderCore', {
			pos: [25, 25],
			level: options.coreLevel ?? 1,
		});
	}
	await shard.setInvaderRaidState(roomName, {
		active: false,
		...options.state,
	});
}
