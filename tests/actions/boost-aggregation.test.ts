import { describe, test, expect, code,
	OK,
	STRUCTURE_LAB, STRUCTURE_RAMPART,
	MOVE, ATTACK, WORK, CARRY,
	BOOSTS,
	LAB_BOOST_MINERAL, LAB_ENERGY_CAPACITY,
	ATTACK_POWER, REPAIR_POWER,
	body,
} from '../../src/index.js';
import { requireCapability } from '../support/policy.js';

// ── BOOST-AGGREGATION-001: per-part additive aggregation ──────
// Total effect equals the sum of each active body part's individual
// boosted or unboosted contribution. Tests use mixed bodies where
// some parts are boosted and others are not.

describe('BOOST-AGGREGATION-001 per-part boost aggregation', () => {
	test('BOOST-AGGREGATION-001 attack: 1 boosted + 1 unboosted ATTACK sums correctly', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'chemistry');
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 6, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});

		// UH = 2x attack. Boost only 1 of 2 ATTACK parts.
		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: LAB_ENERGY_CAPACITY, UH: LAB_BOOST_MINERAL },
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [ATTACK, ATTACK, MOVE],
		});
		await shard.tick();

		// Boost only 1 part via bodyPartsCount.
		const boostRc = await shard.runPlayer('p1', code`
			Game.getObjectById(${labId}).boostCreep(
				Game.getObjectById(${attackerId}), 1
			)
		`);
		expect(boostRc).toBe(OK);

		const targetId = await shard.placeCreep('W1N1', {
			pos: [26, 26], owner: 'p2',
			body: body(6, MOVE),
		});
		await shard.tick();

		const before = await shard.expectObject(targetId, 'creep');

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const after = await shard.expectObject(targetId, 'creep');
		// 1 boosted ATTACK (30*2=60) + 1 unboosted ATTACK (30) = 90 total.
		expect(before.hits - after.hits).toBe(ATTACK_POWER * 2 + ATTACK_POWER);
	});

	test('BOOST-AGGREGATION-001 repair: 2 boosted + 1 unboosted WORK sums correctly', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		// LH = 1.5x build/repair. Boost only 2 of 3 WORK parts.
		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: LAB_ENERGY_CAPACITY, LH: LAB_BOOST_MINERAL * 2 },
		});
		const workerId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [WORK, WORK, WORK, CARRY, MOVE],
			store: { energy: 50 },
		});
		await shard.tick();

		const boostRc = await shard.runPlayer('p1', code`
			Game.getObjectById(${labId}).boostCreep(
				Game.getObjectById(${workerId}), 2
			)
		`);
		expect(boostRc).toBe(OK);

		const rampartId = await shard.placeStructure('W1N1', {
			pos: [26, 26], structureType: STRUCTURE_RAMPART, owner: 'p1',
			hits: 1000,
		});
		await shard.tick();

		const before = await shard.expectStructure(rampartId, STRUCTURE_RAMPART);

		await shard.runPlayer('p1', code`
			Game.getObjectById(${workerId}).repair(Game.getObjectById(${rampartId}))
		`);
		await shard.tick();

		const after = await shard.expectStructure(rampartId, STRUCTURE_RAMPART);
		// 2 boosted WORK (100*1.5=150 each) + 1 unboosted WORK (100) = 400.
		expect(after.hits! - before.hits!).toBe(
			REPAIR_POWER * 1.5 * 2 + REPAIR_POWER,
		);
	});
});
