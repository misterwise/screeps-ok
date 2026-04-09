import { describe, test, expect, code,
	OK, ERR_NOT_OWNER, ERR_NOT_IN_RANGE, ERR_NOT_ENOUGH_RESOURCES,
	ERR_FULL, ERR_INVALID_ARGS, ERR_INVALID_TARGET, ERR_TIRED, ERR_RCL_NOT_ENOUGH,
	STRUCTURE_LAB, STRUCTURE_CONTAINER,
	LAB_REACTION_AMOUNT, LAB_MINERAL_CAPACITY, REACTION_TIME, REACTIONS,
	POWER_INFO, PWR_OPERATE_LAB,
} from '../../src/index.js';
import { labRunCases } from '../support/matrices/lab-run.js';
import { labReverseCases } from '../support/matrices/lab-reverse.js';

describe('Lab runReaction', () => {
	// ---- Matrix: product mapping (LAB-RUN-001) ----
	for (const { reagent1, reagent2, expectedProduct } of labRunCases) {
		test(`LAB-RUN-001:${reagent1}+${reagent2} runReaction produces ${expectedProduct}`, async ({ shard }) => {
			shard.requires('chemistry');
			await shard.ownedRoom('p1', 'W1N1', 6);

			// Calling lab — receives product. Must be empty or hold the product type.
			const labId = await shard.placeStructure('W1N1', {
				pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
				store: { energy: 2000 },
			});
			// Reagent lab 1 — within range 2 of calling lab.
			const lab1 = await shard.placeStructure('W1N1', {
				pos: [25, 27], structureType: STRUCTURE_LAB, owner: 'p1',
				store: { energy: 2000, [reagent1]: LAB_REACTION_AMOUNT },
			});
			// Reagent lab 2 — within range 2 of calling lab.
			const lab2 = await shard.placeStructure('W1N1', {
				pos: [27, 25], structureType: STRUCTURE_LAB, owner: 'p1',
				store: { energy: 2000, [reagent2]: LAB_REACTION_AMOUNT },
			});

			const rc = await shard.runPlayer('p1', code`
				const lab = Game.getObjectById(${labId});
				lab.runReaction(Game.getObjectById(${lab1}), Game.getObjectById(${lab2}))
			`);
			expect(rc).toBe(OK);
			await shard.tick();

			const lab = await shard.expectStructure(labId, STRUCTURE_LAB);
			expect(lab.mineralType).toBe(expectedProduct);
			expect(lab.store[expectedProduct]).toBe(LAB_REACTION_AMOUNT);
		});
	}

	// ---- LAB-RUN-002: consumes LAB_REACTION_AMOUNT from both reagent labs ----
	test('LAB-RUN-002 runReaction consumes LAB_REACTION_AMOUNT from each reagent lab', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000 },
		});
		const startAmount = 100;
		const lab1 = await shard.placeStructure('W1N1', {
			pos: [25, 27], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, H: startAmount },
		});
		const lab2 = await shard.placeStructure('W1N1', {
			pos: [27, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, O: startAmount },
		});

		const rc = await shard.runPlayer('p1', code`
			const lab = Game.getObjectById(${labId});
			lab.runReaction(Game.getObjectById(${lab1}), Game.getObjectById(${lab2}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const r1 = await shard.expectStructure(lab1, STRUCTURE_LAB);
		expect(r1.store.H).toBe(startAmount - LAB_REACTION_AMOUNT);
		const r2 = await shard.expectStructure(lab2, STRUCTURE_LAB);
		expect(r2.store.O).toBe(startAmount - LAB_REACTION_AMOUNT);
	});

	// ---- LAB-RUN-004: returns OK and sets cooldown ----
	test('LAB-RUN-004 runReaction sets cooldown to REACTION_TIME[product]', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000 },
		});
		const lab1 = await shard.placeStructure('W1N1', {
			pos: [25, 27], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, H: 100 },
		});
		const lab2 = await shard.placeStructure('W1N1', {
			pos: [27, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, O: 100 },
		});

		await shard.runPlayer('p1', code`
			const lab = Game.getObjectById(${labId});
			lab.runReaction(Game.getObjectById(${lab1}), Game.getObjectById(${lab2}))
		`);
		// runPlayer IS a tick cycle — intent is already processed, no extra tick() needed.

		const lab = await shard.expectStructure(labId, STRUCTURE_LAB);
		// H + O → OH. Cooldown = REACTION_TIME['OH'] - 1 (one tick elapsed during runPlayer).
		const expected = REACTION_TIME['OH'];
		expect(lab.cooldown).toBe(expected - 1);
	});

	// ---- LAB-RUN-005: ERR_NOT_IN_RANGE ----
	test('LAB-RUN-005 runReaction returns ERR_NOT_IN_RANGE when reagent lab is too far', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000 },
		});
		// Reagent lab 1 — within range.
		const lab1 = await shard.placeStructure('W1N1', {
			pos: [25, 27], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, H: 100 },
		});
		// Reagent lab 2 — range 3 (> 2), out of range.
		const lab2 = await shard.placeStructure('W1N1', {
			pos: [28, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, O: 100 },
		});

		const rc = await shard.runPlayer('p1', code`
			const lab = Game.getObjectById(${labId});
			lab.runReaction(Game.getObjectById(${lab1}), Game.getObjectById(${lab2}))
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});

	// ---- LAB-RUN-006: ERR_NOT_ENOUGH_RESOURCES ----
	test('LAB-RUN-006 runReaction returns ERR_NOT_ENOUGH_RESOURCES when reagent lab is empty', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000 },
		});
		const lab1 = await shard.placeStructure('W1N1', {
			pos: [25, 27], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, H: 100 },
		});
		// Lab2 has no mineral.
		const lab2 = await shard.placeStructure('W1N1', {
			pos: [27, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000 },
		});

		const rc = await shard.runPlayer('p1', code`
			const lab = Game.getObjectById(${labId});
			lab.runReaction(Game.getObjectById(${lab1}), Game.getObjectById(${lab2}))
		`);
		expect(rc).toBe(ERR_NOT_ENOUGH_RESOURCES);
	});

	// ---- LAB-RUN-007: ERR_FULL ----
	test('LAB-RUN-007 runReaction returns ERR_FULL when calling lab mineral store is at capacity', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		// Calling lab already full of OH.
		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, OH: LAB_MINERAL_CAPACITY },
		});
		const lab1 = await shard.placeStructure('W1N1', {
			pos: [25, 27], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, H: 100 },
		});
		const lab2 = await shard.placeStructure('W1N1', {
			pos: [27, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, O: 100 },
		});

		const rc = await shard.runPlayer('p1', code`
			const lab = Game.getObjectById(${labId});
			lab.runReaction(Game.getObjectById(${lab1}), Game.getObjectById(${lab2}))
		`);
		expect(rc).toBe(ERR_FULL);
	});

	// ---- LAB-RUN-008: ERR_INVALID_ARGS ----
	test('LAB-RUN-008 runReaction returns ERR_INVALID_ARGS when reagent pair has no product', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000 },
		});
		// Both labs have H — no valid reaction for H+H.
		const lab1 = await shard.placeStructure('W1N1', {
			pos: [25, 27], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, H: 100 },
		});
		const lab2 = await shard.placeStructure('W1N1', {
			pos: [27, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, H: 100 },
		});

		const rc = await shard.runPlayer('p1', code`
			const lab = Game.getObjectById(${labId});
			lab.runReaction(Game.getObjectById(${lab1}), Game.getObjectById(${lab2}))
		`);
		expect(rc).toBe(ERR_INVALID_ARGS);
	});

	// ---- LAB-RUN-009: ERR_INVALID_TARGET ----
	test('LAB-RUN-009 runReaction returns ERR_INVALID_TARGET when argument is not a lab', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000 },
		});
		const lab1 = await shard.placeStructure('W1N1', {
			pos: [25, 27], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, H: 100 },
		});
		// A container is not a lab.
		const container = await shard.placeStructure('W1N1', {
			pos: [27, 25], structureType: STRUCTURE_CONTAINER,
			store: { energy: 100 },
		});

		const rc = await shard.runPlayer('p1', code`
			const lab = Game.getObjectById(${labId});
			lab.runReaction(Game.getObjectById(${lab1}), Game.getObjectById(${container}))
		`);
		expect(rc).toBe(ERR_INVALID_TARGET);
	});

	// ---- LAB-RUN-010: ERR_TIRED ----
	test('LAB-RUN-010 runReaction returns ERR_TIRED when lab is on cooldown', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000 },
		});
		const lab1 = await shard.placeStructure('W1N1', {
			pos: [25, 27], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, H: 100 },
		});
		const lab2 = await shard.placeStructure('W1N1', {
			pos: [27, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, O: 100 },
		});

		// First reaction succeeds and puts the lab on cooldown.
		const rc1 = await shard.runPlayer('p1', code`
			const lab = Game.getObjectById(${labId});
			lab.runReaction(Game.getObjectById(${lab1}), Game.getObjectById(${lab2}))
		`);
		expect(rc1).toBe(OK);
		await shard.tick();

		// Second reaction while still on cooldown.
		const rc2 = await shard.runPlayer('p1', code`
			const lab = Game.getObjectById(${labId});
			lab.runReaction(Game.getObjectById(${lab1}), Game.getObjectById(${lab2}))
		`);
		expect(rc2).toBe(ERR_TIRED);
	});

	// ---- LAB-RUN-011: ERR_RCL_NOT_ENOUGH ----
	test('LAB-RUN-011 runReaction returns ERR_RCL_NOT_ENOUGH when calling lab is inactive', async ({ shard }) => {
		shard.requires('chemistry');
		// Lab requires RCL 6. Place at RCL 5 — lab is inactive.
		await shard.ownedRoom('p1', 'W1N1', 5);

		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000 },
		});
		const lab1 = await shard.placeStructure('W1N1', {
			pos: [25, 27], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, H: 100 },
		});
		const lab2 = await shard.placeStructure('W1N1', {
			pos: [27, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, O: 100 },
		});

		const rc = await shard.runPlayer('p1', code`
			const lab = Game.getObjectById(${labId});
			lab.runReaction(Game.getObjectById(${lab1}), Game.getObjectById(${lab2}))
		`);
		expect(rc).toBe(ERR_RCL_NOT_ENOUGH);
	});

	// ---- LAB-RUN-003: PWR_OPERATE_LAB boosts reaction amount ----
	test('LAB-RUN-003 runReaction with PWR_OPERATE_LAB active produces boosted amount', async ({ shard }) => {
		shard.requires('powerCreeps');
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 8);

		const boostedAmount = LAB_REACTION_AMOUNT + POWER_INFO[PWR_OPERATE_LAB]!.effect![0];

		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000 },
		});
		const lab1 = await shard.placeStructure('W1N1', {
			pos: [25, 27], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, H: boostedAmount },
		});
		const lab2 = await shard.placeStructure('W1N1', {
			pos: [27, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, O: boostedAmount },
		});
		await shard.placePowerCreep('W1N1', {
			pos: [25, 26], owner: 'p1', name: 'LabBoostPC',
			powers: { [PWR_OPERATE_LAB]: 1 },
			store: { ops: 100 },
		});
		await shard.tick();

		// Apply PWR_OPERATE_LAB first, then run the reaction next tick.
		const powerRc = await shard.runPlayer('p1', code`
			Game.powerCreeps['LabBoostPC'].usePower(PWR_OPERATE_LAB, Game.getObjectById(${labId}))
		`);
		expect(powerRc).toBe(OK);

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${labId}).runReaction(Game.getObjectById(${lab1}), Game.getObjectById(${lab2}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const lab = await shard.expectStructure(labId, STRUCTURE_LAB);
		expect(lab.mineralType).toBe('OH');
		expect(lab.store['OH']).toBe(boostedAmount);

		const r1 = await shard.expectStructure(lab1, STRUCTURE_LAB);
		expect(r1.store.H ?? 0).toBe(0);
		const r2 = await shard.expectStructure(lab2, STRUCTURE_LAB);
		expect(r2.store.O ?? 0).toBe(0);
	});

	// ---- LAB-RUN-012: ERR_NOT_OWNER ----
	test('LAB-RUN-012 runReaction returns ERR_NOT_OWNER on unowned lab', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 6, owner: 'p1' },
				{ name: 'W2N1', rcl: 6, owner: 'p2' },
			],
		});

		// Lab owned by p2 in p1's room — p1 cannot run reactions on it.
		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p2',
			store: { energy: 2000 },
		});
		const lab1 = await shard.placeStructure('W1N1', {
			pos: [25, 27], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, H: 100 },
		});
		const lab2 = await shard.placeStructure('W1N1', {
			pos: [27, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, O: 100 },
		});

		const rc = await shard.runPlayer('p1', code`
			const lab = Game.getObjectById(${labId});
			lab.runReaction(Game.getObjectById(${lab1}), Game.getObjectById(${lab2}))
		`);
		expect(rc).toBe(ERR_NOT_OWNER);
	});
});

describe('Lab reverseReaction', () => {
	// ---- Matrix: reverse mapping (LAB-REVERSE-001) ----
	for (const { compound, expectedReagent1, expectedReagent2 } of labReverseCases) {
		test(`LAB-REVERSE-001:${compound} reverseReaction splits into ${expectedReagent1}+${expectedReagent2}`, async ({ shard }) => {
			shard.requires('chemistry');
			await shard.ownedRoom('p1', 'W1N1', 6);

			// Calling lab holds the compound to decompose.
			const labId = await shard.placeStructure('W1N1', {
				pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
				store: { energy: 2000, [compound]: LAB_REACTION_AMOUNT },
			});
			// Output lab 1 — will receive expectedReagent1.
			const lab1 = await shard.placeStructure('W1N1', {
				pos: [25, 27], structureType: STRUCTURE_LAB, owner: 'p1',
				store: { energy: 2000 },
			});
			// Output lab 2 — will receive expectedReagent2.
			const lab2 = await shard.placeStructure('W1N1', {
				pos: [27, 25], structureType: STRUCTURE_LAB, owner: 'p1',
				store: { energy: 2000 },
			});

			const rc = await shard.runPlayer('p1', code`
				const lab = Game.getObjectById(${labId});
				lab.reverseReaction(Game.getObjectById(${lab1}), Game.getObjectById(${lab2}))
			`);
			expect(rc).toBe(OK);
			await shard.tick();

			// The two output labs should each receive one reagent.
			const r1 = await shard.expectStructure(lab1, STRUCTURE_LAB);
			const r2 = await shard.expectStructure(lab2, STRUCTURE_LAB);
			const received = [r1.mineralType, r2.mineralType].sort();
			expect(received).toEqual([expectedReagent1, expectedReagent2].sort());
		});
	}

	// ---- LAB-REVERSE-002: consumes compound, adds to output labs ----
	test('LAB-REVERSE-002 reverseReaction consumes LAB_REACTION_AMOUNT compound and distributes to output labs', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		const startAmount = 100;
		// OH → H + O
		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, OH: startAmount },
		});
		const lab1 = await shard.placeStructure('W1N1', {
			pos: [25, 27], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000 },
		});
		const lab2 = await shard.placeStructure('W1N1', {
			pos: [27, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000 },
		});

		const rc = await shard.runPlayer('p1', code`
			const lab = Game.getObjectById(${labId});
			lab.reverseReaction(Game.getObjectById(${lab1}), Game.getObjectById(${lab2}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const calling = await shard.expectStructure(labId, STRUCTURE_LAB);
		expect(calling.store.OH).toBe(startAmount - LAB_REACTION_AMOUNT);

		// Each output lab receives LAB_REACTION_AMOUNT of one reagent.
		const r1 = await shard.expectStructure(lab1, STRUCTURE_LAB);
		const r2 = await shard.expectStructure(lab2, STRUCTURE_LAB);
		const minerals = {
			[r1.mineralType!]: r1.store[r1.mineralType!],
			[r2.mineralType!]: r2.store[r2.mineralType!],
		};
		expect(minerals['H']).toBe(LAB_REACTION_AMOUNT);
		expect(minerals['O']).toBe(LAB_REACTION_AMOUNT);
	});

	// ---- LAB-REVERSE-004: sets cooldown ----
	test('LAB-REVERSE-004 reverseReaction sets cooldown to REACTION_TIME[compound]', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, OH: 100 },
		});
		const lab1 = await shard.placeStructure('W1N1', {
			pos: [25, 27], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000 },
		});
		const lab2 = await shard.placeStructure('W1N1', {
			pos: [27, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000 },
		});

		await shard.runPlayer('p1', code`
			const lab = Game.getObjectById(${labId});
			lab.reverseReaction(Game.getObjectById(${lab1}), Game.getObjectById(${lab2}))
		`);
		// runPlayer IS a tick cycle — intent is already processed.

		const lab = await shard.expectStructure(labId, STRUCTURE_LAB);
		// Cooldown = REACTION_TIME['OH'] - 1 (one tick elapsed during runPlayer).
		const expected = REACTION_TIME['OH'];
		expect(lab.cooldown).toBe(expected - 1);
	});

	// ---- LAB-REVERSE-005: ERR_NOT_IN_RANGE ----
	test('LAB-REVERSE-005 reverseReaction returns ERR_NOT_IN_RANGE when output lab is too far', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, OH: 100 },
		});
		const lab1 = await shard.placeStructure('W1N1', {
			pos: [25, 27], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000 },
		});
		// Range 3 — out of range.
		const lab2 = await shard.placeStructure('W1N1', {
			pos: [28, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000 },
		});

		const rc = await shard.runPlayer('p1', code`
			const lab = Game.getObjectById(${labId});
			lab.reverseReaction(Game.getObjectById(${lab1}), Game.getObjectById(${lab2}))
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});

	// ---- LAB-REVERSE-006: ERR_NOT_ENOUGH_RESOURCES ----
	test('LAB-REVERSE-006 reverseReaction returns ERR_NOT_ENOUGH_RESOURCES when calling lab has insufficient compound', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		// Lab has less than LAB_REACTION_AMOUNT of OH.
		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, OH: LAB_REACTION_AMOUNT - 1 },
		});
		const lab1 = await shard.placeStructure('W1N1', {
			pos: [25, 27], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000 },
		});
		const lab2 = await shard.placeStructure('W1N1', {
			pos: [27, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000 },
		});

		const rc = await shard.runPlayer('p1', code`
			const lab = Game.getObjectById(${labId});
			lab.reverseReaction(Game.getObjectById(${lab1}), Game.getObjectById(${lab2}))
		`);
		expect(rc).toBe(ERR_NOT_ENOUGH_RESOURCES);
	});

	// ---- LAB-REVERSE-007: ERR_FULL ----
	test('LAB-REVERSE-007 reverseReaction returns ERR_FULL when output lab mineral store is at capacity', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, OH: 100 },
		});
		// Output lab 1 is full of H — no capacity for more.
		const lab1 = await shard.placeStructure('W1N1', {
			pos: [25, 27], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, H: LAB_MINERAL_CAPACITY },
		});
		const lab2 = await shard.placeStructure('W1N1', {
			pos: [27, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000 },
		});

		const rc = await shard.runPlayer('p1', code`
			const lab = Game.getObjectById(${labId});
			lab.reverseReaction(Game.getObjectById(${lab1}), Game.getObjectById(${lab2}))
		`);
		expect(rc).toBe(ERR_FULL);
	});

	// ---- LAB-REVERSE-008: ERR_INVALID_ARGS ----
	test('LAB-REVERSE-008 reverseReaction returns ERR_INVALID_ARGS when compound has no reverse pair', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		// Base mineral H is not a compound — has no reverse reaction.
		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, H: 100 },
		});
		const lab1 = await shard.placeStructure('W1N1', {
			pos: [25, 27], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000 },
		});
		const lab2 = await shard.placeStructure('W1N1', {
			pos: [27, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000 },
		});

		const rc = await shard.runPlayer('p1', code`
			const lab = Game.getObjectById(${labId});
			lab.reverseReaction(Game.getObjectById(${lab1}), Game.getObjectById(${lab2}))
		`);
		expect(rc).toBe(ERR_INVALID_ARGS);
	});

	// ---- LAB-REVERSE-009: ERR_INVALID_TARGET ----
	test('LAB-REVERSE-009 reverseReaction returns ERR_INVALID_TARGET when argument is not a lab', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, OH: 100 },
		});
		const lab1 = await shard.placeStructure('W1N1', {
			pos: [25, 27], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000 },
		});
		const container = await shard.placeStructure('W1N1', {
			pos: [27, 25], structureType: STRUCTURE_CONTAINER,
			store: { energy: 100 },
		});

		const rc = await shard.runPlayer('p1', code`
			const lab = Game.getObjectById(${labId});
			lab.reverseReaction(Game.getObjectById(${lab1}), Game.getObjectById(${container}))
		`);
		expect(rc).toBe(ERR_INVALID_TARGET);
	});

	// ---- LAB-REVERSE-010: ERR_TIRED ----
	test('LAB-REVERSE-010 reverseReaction returns ERR_TIRED when lab is on cooldown', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, OH: 100 },
		});
		const lab1 = await shard.placeStructure('W1N1', {
			pos: [25, 27], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000 },
		});
		const lab2 = await shard.placeStructure('W1N1', {
			pos: [27, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000 },
		});

		// First reverse succeeds and puts the lab on cooldown.
		const rc1 = await shard.runPlayer('p1', code`
			const lab = Game.getObjectById(${labId});
			lab.reverseReaction(Game.getObjectById(${lab1}), Game.getObjectById(${lab2}))
		`);
		expect(rc1).toBe(OK);
		await shard.tick();

		// Second reverse while still on cooldown.
		const rc2 = await shard.runPlayer('p1', code`
			const lab = Game.getObjectById(${labId});
			lab.reverseReaction(Game.getObjectById(${lab1}), Game.getObjectById(${lab2}))
		`);
		expect(rc2).toBe(ERR_TIRED);
	});

	// ---- LAB-REVERSE-011: ERR_RCL_NOT_ENOUGH ----
	test('LAB-REVERSE-011 reverseReaction returns ERR_RCL_NOT_ENOUGH when calling lab is inactive', async ({ shard }) => {
		shard.requires('chemistry');
		// Lab requires RCL 6. Place at RCL 5 — lab is inactive.
		await shard.ownedRoom('p1', 'W1N1', 5);

		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, OH: 100 },
		});
		const lab1 = await shard.placeStructure('W1N1', {
			pos: [25, 27], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000 },
		});
		const lab2 = await shard.placeStructure('W1N1', {
			pos: [27, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000 },
		});

		const rc = await shard.runPlayer('p1', code`
			const lab = Game.getObjectById(${labId});
			lab.reverseReaction(Game.getObjectById(${lab1}), Game.getObjectById(${lab2}))
		`);
		expect(rc).toBe(ERR_RCL_NOT_ENOUGH);
	});

	// ---- LAB-REVERSE-003: PWR_OPERATE_LAB boosts reverse reaction amount ----
	test('LAB-REVERSE-003 reverseReaction with PWR_OPERATE_LAB active consumes and produces boosted amount', async ({ shard }) => {
		shard.requires('powerCreeps');
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 8);

		const boostedAmount = LAB_REACTION_AMOUNT + POWER_INFO[PWR_OPERATE_LAB]!.effect![0];

		// OH → H + O
		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, OH: boostedAmount },
		});
		const lab1 = await shard.placeStructure('W1N1', {
			pos: [25, 27], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000 },
		});
		const lab2 = await shard.placeStructure('W1N1', {
			pos: [27, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000 },
		});
		await shard.placePowerCreep('W1N1', {
			pos: [25, 26], owner: 'p1', name: 'LabReversePC',
			powers: { [PWR_OPERATE_LAB]: 1 },
			store: { ops: 100 },
		});
		await shard.tick();

		// Apply power first, then reverse reaction next tick.
		const powerRc = await shard.runPlayer('p1', code`
			Game.powerCreeps['LabReversePC'].usePower(PWR_OPERATE_LAB, Game.getObjectById(${labId}))
		`);
		expect(powerRc).toBe(OK);

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${labId}).reverseReaction(Game.getObjectById(${lab1}), Game.getObjectById(${lab2}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const calling = await shard.expectStructure(labId, STRUCTURE_LAB);
		expect(calling.store.OH ?? 0).toBe(0);

		const r1 = await shard.expectStructure(lab1, STRUCTURE_LAB);
		const r2 = await shard.expectStructure(lab2, STRUCTURE_LAB);
		const minerals = {
			[r1.mineralType!]: r1.store[r1.mineralType!],
			[r2.mineralType!]: r2.store[r2.mineralType!],
		};
		expect(minerals['H']).toBe(boostedAmount);
		expect(minerals['O']).toBe(boostedAmount);
	});

	// ---- LAB-REVERSE-012: ERR_NOT_OWNER ----
	test('LAB-REVERSE-012 reverseReaction returns ERR_NOT_OWNER on unowned lab', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 6, owner: 'p1' },
				{ name: 'W2N1', rcl: 6, owner: 'p2' },
			],
		});

		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p2',
			store: { energy: 2000, OH: 100 },
		});
		const lab1 = await shard.placeStructure('W1N1', {
			pos: [25, 27], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000 },
		});
		const lab2 = await shard.placeStructure('W1N1', {
			pos: [27, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000 },
		});

		const rc = await shard.runPlayer('p1', code`
			const lab = Game.getObjectById(${labId});
			lab.reverseReaction(Game.getObjectById(${lab1}), Game.getObjectById(${lab2}))
		`);
		expect(rc).toBe(ERR_NOT_OWNER);
	});
});
