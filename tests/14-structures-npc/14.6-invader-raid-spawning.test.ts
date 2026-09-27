import {
	describe, test, expect,
	FIND_CREEPS, INVADERS_ENERGY_GOAL,
	MOVE,
} from '../../src/index.js';
import type { CreepSnapshot } from '../../src/index.js';
import type { ShardFixture } from '../../src/fixture.js';
import { CORE_ROOM, INVADER_OWNER, ONE_CREEP_RAID_RANDOM, ROOM, setupRaidRoom } from '../invader-raid-helpers.js';
import {
	invaderRaidCompositionCases, invaderRaidExpectedBody,
} from '../../src/matrices/invader-raid-composition.js';

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
		// The cron inserts raiders without ageTime; the creep tick sets it on their first tick (creeps/tick.js:88).
		expect(creep.ticksToLive).toBeNull();
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

	test('INVADER-RAID-007 an adjacent room with no controller leaves that exit qualifying', async ({ shard }) => {
		shard.requires('invaderRaidSpawner');
		// The only exit leads into the core's room, which has no controller.
		await setupRaidRoom(shard, {
			extraRooms: [{ name: CORE_ROOM, controller: false }],
			state: { raidGoal: 1 },
		});

		await runRaidSpawner(shard);

		expect(await invaderCreeps(shard)).toHaveLength(1);
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
		test(`INVADER-RAID-009:${row.key} ${row.label}`, async ({ shard }) => {
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

	test('INVADER-RAID-010 successful raid resets the harvested budget and sets a new threshold', async ({ shard }) => {
		shard.requires('invaderRaidSpawner');
		await setupRaidRoom(shard, {
			state: {
				raidGoal: null,
				harvestedEnergy: INVADERS_ENERGY_GOAL,
			},
		});
		// The raid's last two draws set the next threshold (cronjobs.js:433-437):
		// 0 makes it floor(INVADERS_ENERGY_GOAL × 0.7), and 0.5 leaves it unscaled.
		const nextGoal = Math.floor(INVADERS_ENERGY_GOAL * 0.7);
		await runRaidSpawner(shard, [...ONE_CREEP_RAID_RANDOM.slice(0, -2), 0, 0.5]);
		expect(await invaderCreeps(shard)).toHaveLength(1);

		const counts = [];
		for (const harvestedEnergy of [undefined, nextGoal - 1, nextGoal]) {
			await shard.clearInvaderRaidCreeps(ROOM);
			await shard.setInvaderRaidState(ROOM, { active: false, ...(harvestedEnergy === undefined ? {} : { harvestedEnergy }) });
			await runRaidSpawner(shard);
			counts.push((await invaderCreeps(shard)).length);
		}
		// The budget restarted at 0, and the new threshold is the one that counts.
		expect(counts).toEqual([0, 0, 1]);
	});
});
