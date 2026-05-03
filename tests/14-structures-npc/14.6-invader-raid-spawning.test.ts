import {
	describe, test, expect,
	CREEP_LIFE_TIME, FIND_CREEPS, INVADERS_ENERGY_GOAL,
	MOVE, TERRAIN_PLAIN, TERRAIN_WALL,
} from '../../src/index.js';
import type {
	CreepSnapshot, InvaderRaidRoomStateSpec, RoomSpec, TerrainSpec,
} from '../../src/index.js';
import type { ShardFixture } from '../../src/fixture.js';
import {
	invaderRaidCompositionCases, invaderRaidExpectedBody,
} from '../../src/matrices/invader-raid-composition.js';

const ROOM = 'W1N1';
const CORE_ROOM = 'W1N2';
const INVADER_OWNER = 'sk';
const ONE_CREEP_RAID_RANDOM = [0, 0.1, 0, 0, 0.001, 0.5, 0.5] as const;

interface RaidSetupOptions {
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

async function setupRaidRoom(shard: ShardFixture, options: RaidSetupOptions = {}): Promise<void> {
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
		await shard.placeSource(roomName, { pos: [25, 25], energy: 3000, energyCapacity: 3000 });
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

async function runRaidSpawner(
	shard: ShardFixture,
	random: readonly number[] = ONE_CREEP_RAID_RANDOM,
): Promise<void> {
	await shard.runInvaderRaidSpawner({ random });
}

async function invaderCreeps(shard: ShardFixture, roomName = ROOM): Promise<CreepSnapshot[]> {
	const creeps = await shard.findInRoom(roomName, FIND_CREEPS);
	return creeps
		.filter(creep => creep.owner === INVADER_OWNER)
		.sort((left, right) => left.pos.y - right.pos.y || left.pos.x - right.pos.x);
}

function publicBody(creep: CreepSnapshot): Array<{ type: string; boost?: string }> {
	return creep.body.map(part => {
		return part.boost ? { type: part.type, boost: part.boost } : { type: part.type };
	});
}

function expectInvaderCreepBasics(creeps: readonly CreepSnapshot[]): void {
	for (const creep of creeps) {
		expect(creep.owner).toBe(INVADER_OWNER);
		expect(creep.ticksToLive).toBe(CREEP_LIFE_TIME);
		expect(
			creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49,
		).toBe(true);
	}
}

describe('Invader raid spawning', () => {
	test('INVADER-RAID-001 no level > 0 invader core in sector prevents raid spawn', async ({ shard }) => {
		shard.requires('invaderRaidSpawner');
		await setupRaidRoom(shard, {
			coreRoom: 'W11N11',
			coreLevel: 1,
			state: { raidGoal: 1 },
		});

		await runRaidSpawner(shard);

		expect(await invaderCreeps(shard)).toHaveLength(0);
	});

	test('INVADER-RAID-001 level > 0 invader core in sector permits raid spawn', async ({ shard }) => {
		shard.requires('invaderRaidSpawner');
		await setupRaidRoom(shard, { coreLevel: 1, state: { raidGoal: 1 } });

		await runRaidSpawner(shard);
		const creeps = await invaderCreeps(shard);

		expect(creeps).toHaveLength(1);
		expectInvaderCreepBasics(creeps);
	});

	test('INVADER-RAID-001 level 0 invader core does not satisfy sector prerequisite', async ({ shard }) => {
		shard.requires('invaderRaidSpawner');
		await setupRaidRoom(shard, { coreLevel: 0, state: { raidGoal: 1 } });

		await runRaidSpawner(shard);

		expect(await invaderCreeps(shard)).toHaveLength(0);
	});

	test('INVADER-RAID-002 below the default harvested-energy threshold does not spawn a raid', async ({ shard }) => {
		shard.requires('invaderRaidSpawner');
		await setupRaidRoom(shard, {
			state: {
				raidGoal: null,
				harvestedEnergy: INVADERS_ENERGY_GOAL - 1,
			},
		});

		await runRaidSpawner(shard);

		expect(await invaderCreeps(shard)).toHaveLength(0);
	});

	test('INVADER-RAID-002 reaching the default harvested-energy threshold spawns a raid', async ({ shard }) => {
		shard.requires('invaderRaidSpawner');
		await setupRaidRoom(shard, {
			state: {
				raidGoal: null,
				harvestedEnergy: INVADERS_ENERGY_GOAL,
			},
		});

		await runRaidSpawner(shard);
		const creeps = await invaderCreeps(shard);

		expect(creeps).toHaveLength(1);
		expectInvaderCreepBasics(creeps);
	});

	test('INVADER-RAID-003 raid goal 1 bypasses harvested-energy threshold', async ({ shard }) => {
		shard.requires('invaderRaidSpawner');
		await setupRaidRoom(shard, {
			state: {
				raidGoal: 1,
				harvestedEnergy: 0,
			},
		});

		await runRaidSpawner(shard);
		const creeps = await invaderCreeps(shard);

		expect(creeps).toHaveLength(1);
		expectInvaderCreepBasics(creeps);
	});

	test('INVADER-RAID-004 existing Invader-owned creep suppresses a new raid', async ({ shard }) => {
		shard.requires('invaderRaidSpawner');
		await setupRaidRoom(shard, { state: { raidGoal: 1 } });
		await shard.placeCreep(ROOM, {
			pos: [10, 10],
			owner: INVADER_OWNER,
			body: [MOVE],
			name: 'existing-invader',
		});
		await shard.setInvaderRaidState(ROOM, { active: false });

		await runRaidSpawner(shard);

		expect(await invaderCreeps(shard)).toHaveLength(1);
	});

	test('INVADER-RAID-005 non-normal room status suppresses raid spawning', async ({ shard }) => {
		shard.requires('invaderRaidSpawner');
		await setupRaidRoom(shard, {
			state: {
				raidGoal: 1,
				status: 'closed',
			},
		});

		await runRaidSpawner(shard);

		expect(await invaderCreeps(shard)).toHaveLength(0);
	});

	test('INVADER-RAID-006 active room suppresses inactive-room raid spawning', async ({ shard }) => {
		shard.requires('invaderRaidSpawner');
		await setupRaidRoom(shard, {
			state: {
				raidGoal: 1,
				active: true,
			},
		});

		await runRaidSpawner(shard);

		expect(await invaderCreeps(shard)).toHaveLength(0);
	});

	test('INVADER-RAID-007 all-wall room edges provide no qualifying exit', async ({ shard }) => {
		shard.requires('invaderRaidSpawner');
		await setupRaidRoom(shard, {
			exitTiles: [],
			state: { raidGoal: 1 },
		});

		await runRaidSpawner(shard);

		expect(await invaderCreeps(shard)).toHaveLength(0);
	});

	test('INVADER-RAID-007 adjacent owned controller blocks that exit', async ({ shard }) => {
		shard.requires('invaderRaidSpawner');
		await setupRaidRoom(shard, {
			extraRooms: [{ name: CORE_ROOM, owner: 'p2', rcl: 1 }],
			state: { raidGoal: 1 },
		});

		await runRaidSpawner(shard);

		expect(await invaderCreeps(shard)).toHaveLength(0);
	});

	test('INVADER-RAID-007 adjacent reserved controller blocks that exit', async ({ shard }) => {
		shard.requires('invaderRaidSpawner');
		await setupRaidRoom(shard, { state: { raidGoal: 1 } });
		await shard.setInvaderRaidState(CORE_ROOM, {
			controllerReservation: { owner: 'p2', ticksToEnd: 5000 },
		});

		await runRaidSpawner(shard);

		expect(await invaderCreeps(shard)).toHaveLength(0);
	});

	test('INVADER-RAID-008 one qualifying one-tile exit places the raid exactly on that edge tile', async ({ shard }) => {
		shard.requires('invaderRaidSpawner');
		await setupRaidRoom(shard, {
			exitTiles: [[17, 0]],
			state: { raidGoal: 1 },
		});

		await runRaidSpawner(shard);
		const creeps = await invaderCreeps(shard);

		expect(creeps).toHaveLength(1);
		expect(creeps[0].pos).toEqual({ x: 17, y: 0, roomName: ROOM });
		expectInvaderCreepBasics(creeps);
	});

	for (const row of invaderRaidCompositionCases) {
		test(`INVADER-RAID-009 ${row.label}`, async ({ shard }) => {
			shard.requires('invaderRaidSpawner');
			await setupRaidRoom(shard, {
				roomName: row.roomName,
				coreRoom: row.coreRoom,
				exitTiles: row.exitTiles,
				owner: row.owner,
				rcl: row.rcl,
				state: { raidGoal: 1 },
			});

			await runRaidSpawner(shard, row.random);
			const creeps = await invaderCreeps(shard, row.roomName);

			expect(creeps).toHaveLength(row.expected.length);
			expectInvaderCreepBasics(creeps);
			expect(creeps.map(creep => publicBody(creep))).toEqual(
				row.expected.map(expected => invaderRaidExpectedBody(expected)),
			);
			expect(creeps.map(creep => [creep.pos.x, creep.pos.y])).toEqual(row.exitTiles);
		});
	}

	test('INVADER-RAID-010 successful raid resets harvested budget for the next spawner pass', async ({ shard }) => {
		shard.requires('invaderRaidSpawner');
		await setupRaidRoom(shard, {
			state: {
				raidGoal: null,
				harvestedEnergy: INVADERS_ENERGY_GOAL,
			},
		});

		await runRaidSpawner(shard);
		expect(await invaderCreeps(shard)).toHaveLength(1);

		await shard.clearInvaderRaidCreeps(ROOM);
		await shard.setInvaderRaidState(ROOM, { active: false });
		await runRaidSpawner(shard);

		expect(await invaderCreeps(shard)).toHaveLength(0);
	});
});
