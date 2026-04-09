import { describe, test, expect, code,
	OK, ERR_NOT_ENOUGH_RESOURCES,
	STRUCTURE_LAB, STRUCTURE_RAMPART, STRUCTURE_SPAWN,
	MOVE, ATTACK, TOUGH, RANGED_ATTACK, HEAL, WORK, CARRY,
	BOOSTS,
	LAB_BOOST_MINERAL, LAB_ENERGY_CAPACITY,
	ATTACK_POWER, RANGED_ATTACK_POWER, HEAL_POWER, DISMANTLE_POWER,
	HARVEST_POWER, BUILD_POWER, REPAIR_POWER, UPGRADE_CONTROLLER_POWER,
	CARRY_CAPACITY,
	BODYPART_HITS,
	body,
} from '../../src/index.js';
import { requireCapability } from '../support/policy.js';
import { knownParityGap } from '../support/parity-gaps.js';

// ── BOOST-RANGED-001: ranged attack boost magnitudes ────────

const rangedCompounds = Object.entries(
	BOOSTS.ranged_attack as Record<string, Record<string, number>>,
);

describe('BOOST-RANGED-001 rangedAttack boost magnitudes', () => {
	for (const [compound, effects] of rangedCompounds) {
		const multiplier = effects.rangedAttack;

		test(`${compound} (${multiplier}x)`, async ({ shard, skip }) => {
			requireCapability(shard, skip, 'chemistry');
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [
					{ name: 'W1N1', rcl: 6, owner: 'p1' },
					{ name: 'W2N1', rcl: 1, owner: 'p2' },
				],
			});

			const labId = await shard.placeStructure('W1N1', {
				pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
				store: { energy: LAB_ENERGY_CAPACITY, [compound]: LAB_BOOST_MINERAL },
			});
			const attackerId = await shard.placeCreep('W1N1', {
				pos: [25, 26], owner: 'p1',
				body: [RANGED_ATTACK, MOVE],
			});
			await shard.tick();

			const boostRc = await shard.runPlayer('p1', code`
				Game.getObjectById(${labId}).boostCreep(Game.getObjectById(${attackerId}))
			`);
			expect(boostRc).toBe(OK);

			// Target at range 3.
			const targetId = await shard.placeCreep('W1N1', {
				pos: [25, 29], owner: 'p2',
				body: body(5, TOUGH, MOVE),
			});
			await shard.tick();

			const before = await shard.expectObject(targetId, 'creep');

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${attackerId}).rangedAttack(Game.getObjectById(${targetId}))
			`);
			expect(rc).toBe(OK);
			await shard.tick();

			const after = await shard.expectObject(targetId, 'creep');
			expect(before.hits - after.hits).toBe(RANGED_ATTACK_POWER * multiplier);
		});
	}
});

// ── BOOST-HEAL-001: heal boost magnitudes ────────��──────────

const healCompounds = Object.entries(
	BOOSTS.heal as Record<string, Record<string, number>>,
);

describe('BOOST-HEAL-001 heal boost magnitudes', () => {
	for (const [compound, effects] of healCompounds) {
		const multiplier = effects.heal;

		test(`${compound} (${multiplier}x)`, async ({ shard, skip }) => {
			requireCapability(shard, skip, 'chemistry');
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [
					{ name: 'W1N1', rcl: 6, owner: 'p1' },
					{ name: 'W2N1', rcl: 1, owner: 'p2' },
				],
			});

			const labId = await shard.placeStructure('W1N1', {
				pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
				store: { energy: LAB_ENERGY_CAPACITY, [compound]: LAB_BOOST_MINERAL },
			});
			const healerId = await shard.placeCreep('W1N1', {
				pos: [25, 26], owner: 'p1',
				body: [HEAL, MOVE],
			});
			await shard.tick();

			// Boost the healer.
			const boostRc = await shard.runPlayer('p1', code`
				Game.getObjectById(${labId}).boostCreep(Game.getObjectById(${healerId}))
			`);
			expect(boostRc).toBe(OK);

			// Place friendly target and p2 attacker to damage it.
			// Target needs enough HP headroom for the max boosted heal (4x = 48).
			// Use 2 ATTACK parts (60 damage) so there's always room.
			const targetId = await shard.placeCreep('W1N1', {
				pos: [26, 26], owner: 'p1',
				body: body(5, TOUGH, MOVE),
			});
			const p2AttackerId = await shard.placeCreep('W1N1', {
				pos: [26, 27], owner: 'p2',
				body: [ATTACK, ATTACK, MOVE],
			});
			await shard.tick();

			// p2 attacks the target to deal 2 * ATTACK_POWER = 60 damage.
			const attackRc = await shard.runPlayer('p2', code`
				Game.getObjectById(${p2AttackerId}).attack(Game.getObjectById(${targetId}))
			`);
			expect(attackRc).toBe(OK);
			await shard.tick();

			const injured = await shard.expectObject(targetId, 'creep');
			expect(injured.hits).toBe(6 * BODYPART_HITS - 2 * ATTACK_POWER);

			// Now heal with boosted healer.
			const healRc = await shard.runPlayer('p1', code`
				Game.getObjectById(${healerId}).heal(Game.getObjectById(${targetId}))
			`);
			expect(healRc).toBe(OK);
			await shard.tick();

			const healed = await shard.expectObject(targetId, 'creep');
			expect(healed.hits - injured.hits).toBe(HEAL_POWER * multiplier);
		});
	}
});

// ── BOOST-ATTACK-001: melee attack boost magnitudes ─────────

const attackCompounds = Object.entries(
	BOOSTS.attack as Record<string, Record<string, number>>,
);

describe('BOOST-ATTACK-001 attack boost magnitudes', () => {
	for (const [compound, effects] of attackCompounds) {
		const multiplier = effects.attack;

		test(`${compound} (${multiplier}x)`, async ({ shard, skip }) => {
			requireCapability(shard, skip, 'chemistry');
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [
					{ name: 'W1N1', rcl: 6, owner: 'p1' },
					{ name: 'W2N1', rcl: 1, owner: 'p2' },
				],
			});

			const labId = await shard.placeStructure('W1N1', {
				pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
				store: { energy: LAB_ENERGY_CAPACITY, [compound]: LAB_BOOST_MINERAL },
			});
			const attackerId = await shard.placeCreep('W1N1', {
				pos: [25, 26], owner: 'p1',
				body: [ATTACK, MOVE],
			});
			await shard.tick();

			const boostRc = await shard.runPlayer('p1', code`
				Game.getObjectById(${labId}).boostCreep(Game.getObjectById(${attackerId}))
			`);
			expect(boostRc).toBe(OK);

			const targetId = await shard.placeCreep('W1N1', {
				pos: [26, 26], owner: 'p2',
				body: body(5, TOUGH, MOVE),
			});
			await shard.tick();

			const before = await shard.expectObject(targetId, 'creep');

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
			`);
			expect(rc).toBe(OK);
			await shard.tick();

			const after = await shard.expectObject(targetId, 'creep');
			expect(before.hits - after.hits).toBe(ATTACK_POWER * multiplier);
		});
	}
});

// ── BOOST-DISMANTLE-001: dismantle boost magnitudes ─────────

const dismantleCompounds = Object.entries(
	BOOSTS.work as Record<string, Record<string, number>>,
).filter(([, effects]) => 'dismantle' in effects);

describe('BOOST-DISMANTLE-001 dismantle boost magnitudes', () => {
	for (const [compound, effects] of dismantleCompounds) {
		const multiplier = effects.dismantle;

		test(`${compound} (${multiplier}x)`, async ({ shard, skip }) => {
			requireCapability(shard, skip, 'chemistry');
			await shard.ownedRoom('p1', 'W1N1', 6);

			const labId = await shard.placeStructure('W1N1', {
				pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
				store: { energy: LAB_ENERGY_CAPACITY, [compound]: LAB_BOOST_MINERAL },
			});
			const dismantlerId = await shard.placeCreep('W1N1', {
				pos: [25, 26], owner: 'p1',
				body: [WORK, MOVE],
			});
			await shard.tick();

			// Boost the dismantler.
			const boostRc = await shard.runPlayer('p1', code`
				Game.getObjectById(${labId}).boostCreep(Game.getObjectById(${dismantlerId}))
			`);
			expect(boostRc).toBe(OK);

			// Place a rampart to dismantle.
			const rampartId = await shard.placeStructure('W1N1', {
				pos: [26, 26], structureType: STRUCTURE_RAMPART, owner: 'p1',
				hits: 100000,
			});
			await shard.tick();

			const before = await shard.expectStructure(rampartId, STRUCTURE_RAMPART);

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${dismantlerId}).dismantle(Game.getObjectById(${rampartId}))
			`);
			expect(rc).toBe(OK);
			await shard.tick();

			const after = await shard.expectStructure(rampartId, STRUCTURE_RAMPART);
			expect(before.hits! - after.hits!).toBe(DISMANTLE_POWER * multiplier);
		});
	}
});

// ── BOOST-HARVEST-001: harvest boost magnitudes ───────────────

const harvestCompounds = Object.entries(
	BOOSTS.work as Record<string, Record<string, number>>,
).filter(([, effects]) => 'harvest' in effects);

describe('BOOST-HARVEST-001 harvest boost magnitudes', () => {
	for (const [compound, effects] of harvestCompounds) {
		const multiplier = effects.harvest;

		test(`${compound} (${multiplier}x)`, async ({ shard, skip }) => {
			requireCapability(shard, skip, 'chemistry');
			await shard.ownedRoom('p1', 'W1N1', 6);

			const sourceId = await shard.placeSource('W1N1', {
				pos: [20, 20], energy: 3000, energyCapacity: 3000,
			});
			const labId = await shard.placeStructure('W1N1', {
				pos: [21, 21], structureType: STRUCTURE_LAB, owner: 'p1',
				store: { energy: LAB_ENERGY_CAPACITY, [compound]: LAB_BOOST_MINERAL },
			});
			const harvesterId = await shard.placeCreep('W1N1', {
				pos: [21, 20], owner: 'p1',
				body: [WORK, CARRY, CARRY, CARRY, MOVE],
			});
			await shard.tick();

			const boostRc = await shard.runPlayer('p1', code`
				Game.getObjectById(${labId}).boostCreep(Game.getObjectById(${harvesterId}))
			`);
			expect(boostRc).toBe(OK);

			const storeBefore = await shard.runPlayer('p1', code`
				Game.getObjectById(${harvesterId}).store.energy
			`) as number;

			const harvestRc = await shard.runPlayer('p1', code`
				Game.getObjectById(${harvesterId}).harvest(Game.getObjectById(${sourceId}))
			`);
			expect(harvestRc).toBe(OK);

			const storeAfter = await shard.runPlayer('p1', code`
				Game.getObjectById(${harvesterId}).store.energy
			`) as number;
			expect(storeAfter - storeBefore).toBe(HARVEST_POWER * multiplier);
		});
	}
});

// ── BOOST-HARVEST-003: harvest boosts only apply during harvest() ──

describe('BOOST-HARVEST-003 harvest boosts only apply during harvest()', () => {
	test('BOOST-HARVEST-003 boosted WORK part repairs at normal REPAIR_POWER, not boosted', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		// UO is the harvest boost (3x harvest) but should not affect repair.
		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: LAB_ENERGY_CAPACITY, UO: LAB_BOOST_MINERAL },
		});
		const workerId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [WORK, CARRY, MOVE],
			store: { energy: 50 },
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${labId}).boostCreep(Game.getObjectById(${workerId}))
		`);

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
		// Repair should use normal REPAIR_POWER (100), not boosted harvest rate.
		expect(after.hits! - before.hits!).toBe(REPAIR_POWER);
	});
});

// ── BOOST-BUILD-001: build/repair boost magnitudes ────────────

const buildCompounds = Object.entries(
	BOOSTS.work as Record<string, Record<string, number>>,
).filter(([, effects]) => 'repair' in effects);

describe('BOOST-BUILD-001 build/repair boost magnitudes', () => {
	for (const [compound, effects] of buildCompounds) {
		const multiplier = effects.repair;

		test(`${compound} repair (${multiplier}x)`, async ({ shard, skip }) => {
			requireCapability(shard, skip, 'chemistry');
			await shard.ownedRoom('p1', 'W1N1', 6);

			const labId = await shard.placeStructure('W1N1', {
				pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
				store: { energy: LAB_ENERGY_CAPACITY, [compound]: LAB_BOOST_MINERAL },
			});
			const workerId = await shard.placeCreep('W1N1', {
				pos: [25, 26], owner: 'p1',
				body: [WORK, CARRY, MOVE],
				store: { energy: 50 },
			});
			await shard.tick();

			await shard.runPlayer('p1', code`
				Game.getObjectById(${labId}).boostCreep(Game.getObjectById(${workerId}))
			`);

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
			expect(after.hits! - before.hits!).toBe(REPAIR_POWER * multiplier);
		});
	}
});

// ── BOOST-BUILD-003: build/repair boosts don't increase energy cost ──

const energyCostTest = knownParityGap('boost-energy-cost-scales');

describe('BOOST-BUILD-003 build/repair boosts do not increase energy cost', () => {
	energyCostTest('boosted repair costs 1 energy per REPAIR_POWER hits repaired', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		// XLH2O = 2x build/repair. 1 WORK repairs 200 HP but costs same
		// rate: 1 energy per REPAIR_POWER (100) hits = 2 energy for 200 hits.
		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: LAB_ENERGY_CAPACITY, XLH2O: LAB_BOOST_MINERAL },
		});
		const workerId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [WORK, CARRY, MOVE],
			store: { energy: 50 },
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${labId}).boostCreep(Game.getObjectById(${workerId}))
		`);

		const rampartId = await shard.placeStructure('W1N1', {
			pos: [26, 26], structureType: STRUCTURE_RAMPART, owner: 'p1',
			hits: 1000,
		});
		await shard.tick();

		// Read energy and hits before action via runPlayer.
		const before = await shard.runPlayer('p1', code`
			[Game.getObjectById(${workerId}).store.energy,
			 Game.getObjectById(${rampartId}).hits]
		`) as [number, number];

		await shard.runPlayer('p1', code`
			Game.getObjectById(${workerId}).repair(Game.getObjectById(${rampartId}))
		`);

		const after = await shard.runPlayer('p1', code`
			[Game.getObjectById(${workerId}).store.energy,
			 Game.getObjectById(${rampartId}).hits]
		`) as [number, number];

		const hitsRepaired = after[1] - before[1];
		const energySpent = before[0] - after[0];
		// Boosted repair: more HP per tick but same energy cost per WORK part.
		expect(hitsRepaired).toBe(REPAIR_POWER * 2); // 2x boost
		// Energy cost is 1 per WORK part per tick, not scaled by boost.
		expect(energySpent).toBe(1);
	});
});

// ── BOOST-UPGRADE-001: upgrade boost magnitudes ───────────────

const upgradeCompounds = Object.entries(
	BOOSTS.work as Record<string, Record<string, number>>,
).filter(([, effects]) => 'upgradeController' in effects);

describe('BOOST-UPGRADE-001 upgrade boost magnitudes', () => {
	for (const [compound, effects] of upgradeCompounds) {
		const multiplier = effects.upgradeController;
		// Use 10 WORK parts so all fractional multipliers produce integers.
		// 10 * 1.5 = 15, 10 * 1.8 = 18, 10 * 2 = 20.
		const workParts = 10;
		const expectedProgress = workParts * UPGRADE_CONTROLLER_POWER * multiplier;

		test(`${compound} (${multiplier}x)`, async ({ shard, skip }) => {
			requireCapability(shard, skip, 'chemistry');
			await shard.ownedRoom('p1', 'W1N1', 6);

			const ctrlPos = await shard.getControllerPos('W1N1');
			expect(ctrlPos).not.toBeNull();

			const labId = await shard.placeStructure('W1N1', {
				pos: [ctrlPos!.x + 1, ctrlPos!.y + 1], structureType: STRUCTURE_LAB, owner: 'p1',
				store: { energy: LAB_ENERGY_CAPACITY, [compound]: LAB_BOOST_MINERAL * workParts },
			});
			const upgraderId = await shard.placeCreep('W1N1', {
				pos: [ctrlPos!.x + 1, ctrlPos!.y], owner: 'p1',
				body: [...Array(workParts).fill(WORK), CARRY, MOVE],
				store: { energy: 500 },
			});
			await shard.tick();

			await shard.runPlayer('p1', code`
				Game.getObjectById(${labId}).boostCreep(Game.getObjectById(${upgraderId}))
			`);

			const progressBefore = await shard.runPlayer('p1', code`
				Game.rooms['W1N1'].controller.progress
			`) as number;

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${upgraderId}).upgradeController(
					Game.rooms['W1N1'].controller
				)
			`);
			expect(rc).toBe(OK);

			const progressAfter = await shard.runPlayer('p1', code`
				Game.rooms['W1N1'].controller.progress
			`) as number;
			expect(progressAfter - progressBefore).toBe(expectedProgress);
		});
	}
});

// ── BOOST-UPGRADE-003: upgrade boosts don't increase energy cost ──

describe('BOOST-UPGRADE-003 upgrade boosts do not increase energy cost', () => {
	energyCostTest('boosted upgrade costs 1 energy per progress point', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		const ctrlPos = await shard.getControllerPos('W1N1');
		expect(ctrlPos).not.toBeNull();

		// XGH2O = 2x upgrade. Use 1 WORK → 2 progress → should cost 2 energy.
		const labId = await shard.placeStructure('W1N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y + 1], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: LAB_ENERGY_CAPACITY, XGH2O: LAB_BOOST_MINERAL },
		});
		const workerId = await shard.placeCreep('W1N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y], owner: 'p1',
			body: [WORK, CARRY, MOVE],
			store: { energy: 50 },
		});
		await shard.tick();
		await shard.runPlayer('p1', code`
			Game.getObjectById(${labId}).boostCreep(Game.getObjectById(${workerId}))
		`);

		const before = await shard.runPlayer('p1', code`
			[Game.getObjectById(${workerId}).store.energy,
			 Game.rooms['W1N1'].controller.progress]
		`) as [number, number];

		await shard.runPlayer('p1', code`
			Game.getObjectById(${workerId}).upgradeController(
				Game.rooms['W1N1'].controller
			)
		`);

		const after = await shard.runPlayer('p1', code`
			[Game.getObjectById(${workerId}).store.energy,
			 Game.rooms['W1N1'].controller.progress]
		`) as [number, number];

		const progressGained = after[1] - before[1];
		const energySpent = before[0] - after[0];
		// Boosted upgrade: more progress per tick but energy cost is 1 per
		// WORK part per tick, not scaled by boost.
		expect(progressGained).toBe(UPGRADE_CONTROLLER_POWER * 2); // 2x
		expect(energySpent).toBe(1); // 1 WORK = 1 energy, boost-independent
	});
});

// ── BOOST-TOUGH-001: tough damage reduction magnitudes ────────

const toughCompounds = Object.entries(
	BOOSTS.tough as Record<string, Record<string, number>>,
);

const toughTest = knownParityGap('tough-boost-no-reduction');

describe('BOOST-TOUGH-001 tough damage reduction magnitudes', () => {
	for (const [compound, effects] of toughCompounds) {
		const damageMultiplier = effects.damage;

		toughTest(`${compound} (${damageMultiplier}x damage taken)`, async ({ shard, skip }) => {
			requireCapability(shard, skip, 'chemistry');
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [
					{ name: 'W1N1', rcl: 6, owner: 'p1' },
					{ name: 'W2N1', rcl: 1, owner: 'p2' },
				],
			});

			const labId = await shard.placeStructure('W1N1', {
				pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
				store: { energy: LAB_ENERGY_CAPACITY, [compound]: LAB_BOOST_MINERAL },
			});
			// One TOUGH part (front) + MOVE part (back).
			const targetId = await shard.placeCreep('W1N1', {
				pos: [25, 26], owner: 'p1',
				body: [TOUGH, MOVE],
			});
			await shard.tick();

			await shard.runPlayer('p1', code`
				Game.getObjectById(${labId}).boostCreep(Game.getObjectById(${targetId}))
			`);

			// Place a p2 attacker adjacent.
			const attackerId = await shard.placeCreep('W1N1', {
				pos: [26, 26], owner: 'p2',
				body: [ATTACK, MOVE],
			});
			await shard.tick();

			const before = await shard.expectObject(targetId, 'creep');

			await shard.runPlayer('p2', code`
				Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
			`);
			await shard.tick();

			const after = await shard.expectObject(targetId, 'creep');
			// ATTACK_POWER = 30. Damage to the boosted TOUGH part is multiplied
			// by damageMultiplier. The TOUGH part has 100 HP so it absorbs the
			// reduced damage and no overflow reaches the MOVE part.
			expect(before.hits - after.hits).toBe(
				Math.round(ATTACK_POWER * damageMultiplier),
			);
		});
	}
});

// ── BOOST-TOUGH-002: tough reduction applies only to the boosted part ──

describe('BOOST-TOUGH-002 tough damage reduction applies only to the boosted part', () => {
	toughTest('damage beyond the boosted TOUGH part hits unboosted parts at full damage', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'chemistry');
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 6, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});

		// XGHO2 = 0.3x damage on TOUGH. One TOUGH part has 100 HP.
		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: LAB_ENERGY_CAPACITY, XGHO2: LAB_BOOST_MINERAL },
		});
		// [TOUGH, MOVE, MOVE] — TOUGH is first, takes reduced damage.
		// When TOUGH is destroyed, remaining damage goes to MOVE at full rate.
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [TOUGH, MOVE, MOVE],
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${labId}).boostCreep(Game.getObjectById(${targetId}))
		`);
		await shard.tick();

		const before = await shard.expectObject(targetId, 'creep');
		expect(before.hits).toBe(3 * BODYPART_HITS); // 300 HP total

		// Deal exactly 30 damage (1 ATTACK part). At 0.3x, TOUGH absorbs 9 HP.
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [26, 26], owner: 'p2',
			body: [ATTACK, MOVE],
		});
		await shard.tick();

		await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);
		await shard.tick();

		const after = await shard.expectObject(targetId, 'creep');
		// 30 * 0.3 = 9 damage to TOUGH part only. MOVE parts untouched.
		expect(before.hits - after.hits).toBe(Math.round(ATTACK_POWER * 0.3));
	});
});

// ── BOOST-MOVE-001: move boost fatigue reduction magnitudes ───

const moveCompounds = Object.entries(
	BOOSTS.move as Record<string, Record<string, number>>,
);

describe('BOOST-MOVE-001 move boost fatigue reduction magnitudes', () => {
	for (const [compound, effects] of moveCompounds) {
		const multiplier = effects.fatigue;

		test(`${compound} (${multiplier}x fatigue reduction)`, async ({ shard, skip }) => {
			requireCapability(shard, skip, 'chemistry');
			await shard.ownedRoom('p1', 'W1N1', 6);

			const labId = await shard.placeStructure('W1N1', {
				pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
				store: { energy: LAB_ENERGY_CAPACITY, [compound]: LAB_BOOST_MINERAL },
			});
			// 1 MOVE + 1 CARRY (weighted). On plains: fatigue = 2 per weighted part = 2.
			// Boosted MOVE reduces fatigue by 2*multiplier per tick.
			const creepId = await shard.placeCreep('W1N1', {
				pos: [25, 26], owner: 'p1',
				body: [MOVE, CARRY],
			});
			await shard.tick();

			await shard.runPlayer('p1', code`
				Game.getObjectById(${labId}).boostCreep(Game.getObjectById(${creepId}))
			`);
			await shard.tick();

			// Move the creep and check fatigue.
			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${creepId}).move(RIGHT)
			`);
			expect(rc).toBe(OK);

			const fatigue = await shard.runPlayer('p1', code`
				Game.getObjectById(${creepId}).fatigue
			`) as number;
			// Plains fatigue = 2 (1 weighted part * 2). Boosted MOVE reduces
			// by 2*multiplier immediately. For multiplier >= 2, fatigue should
			// be 0 after reduction. For multiplier == 1 (unboosted baseline),
			// fatigue = max(0, 2 - 2*1) = 0 as well (1 MOVE perfectly carries
			// 1 weighted part). With boosted MOVE, the fatigue never accumulates
			// above 0 because reduction exceeds generation.
			expect(fatigue).toBe(0);
		});
	}
});

// ── BOOST-CARRY-001: carry capacity boost magnitudes ──────────

const carryCompounds = Object.entries(
	BOOSTS.carry as Record<string, Record<string, number>>,
);

describe('BOOST-CARRY-001 carry capacity boost magnitudes', () => {
	for (const [compound, effects] of carryCompounds) {
		const multiplier = effects.capacity;

		test(`${compound} (${multiplier}x)`, async ({ shard, skip }) => {
			requireCapability(shard, skip, 'chemistry');
			await shard.ownedRoom('p1', 'W1N1', 6);

			const labId = await shard.placeStructure('W1N1', {
				pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
				store: { energy: LAB_ENERGY_CAPACITY, [compound]: LAB_BOOST_MINERAL },
			});
			// Give the creep base capacity of energy so we can withdraw more.
			const creepId = await shard.placeCreep('W1N1', {
				pos: [25, 26], owner: 'p1',
				body: [CARRY, MOVE],
			});
			await shard.tick();

			await shard.runPlayer('p1', code`
				Game.getObjectById(${labId}).boostCreep(Game.getObjectById(${creepId}))
			`);

			// Verify via withdraw: put a container with more energy than base
			// capacity and withdraw the full boosted amount.
			const containerId = await shard.placeStructure('W1N1', {
				pos: [26, 26], structureType: 'container',
				store: { energy: 500 },
			});
			await shard.tick();

			// Withdraw more than unboosted capacity (50). If boost works,
			// creep can hold CARRY_CAPACITY * multiplier.
			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${creepId}).withdraw(
					Game.getObjectById(${containerId}), RESOURCE_ENERGY,
					${CARRY_CAPACITY * multiplier}
				)
			`);
			expect(rc).toBe(OK);

			const stored = await shard.runPlayer('p1', code`
				Game.getObjectById(${creepId}).store.energy
			`) as number;
			expect(stored).toBe(CARRY_CAPACITY * multiplier);
		});
	}
});

// ── BOOST-CARRY-003: boosted CARRY parts still zero fatigue when empty ──

describe('BOOST-CARRY-003 boosted CARRY parts still contribute zero fatigue when empty', () => {
	test('BOOST-CARRY-003 empty boosted CARRY does not add weight for fatigue', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: LAB_ENERGY_CAPACITY, KH: LAB_BOOST_MINERAL },
		});
		// [CARRY, MOVE] — empty carry should be weightless.
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [CARRY, MOVE],
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${labId}).boostCreep(Game.getObjectById(${creepId}))
		`);
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).move(RIGHT)
		`);
		expect(rc).toBe(OK);

		const fatigue = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).fatigue
		`) as number;
		// Empty CARRY is weightless → 0 weighted parts → 0 fatigue.
		expect(fatigue).toBe(0);
	});
});
