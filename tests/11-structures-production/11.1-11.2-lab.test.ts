import { describe, test, expect, code,
	OK,
	STRUCTURE_LAB, STRUCTURE_CONTAINER,
	LAB_REACTION_AMOUNT, LAB_MINERAL_CAPACITY, REACTION_TIME,
	POWER_INFO, PWR_OPERATE_LAB,
} from '../../src/index.js';
import { labRunCases } from '../../src/matrices/lab-run.js';
import { labReverseCases } from '../../src/matrices/lab-reverse.js';
import { labRunValidationCases } from '../../src/matrices/lab-run-validation.js';
import { labReverseValidationCases } from '../../src/matrices/lab-reverse-validation.js';

describe('Lab runReaction', () => {
	// ---- Matrix: product mapping (LAB-RUN-001) ----
	for (const { reagent1, reagent2, expectedProduct } of labRunCases) {
		test(`LAB-RUN-001:${expectedProduct} runReaction(${reagent1}, ${reagent2}) produces ${expectedProduct}`, async ({ shard }) => {
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

	// ---- LAB-RUN-003: PWR_OPERATE_LAB boosts reaction amount ----
	test('LAB-RUN-003 runReaction with PWR_OPERATE_LAB active produces boosted amount', async ({ shard }) => {
		shard.requires('powerCreeps');
		shard.requires('chemistry');
		shard.requires('powerEffects');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1', powerEnabled: true }],
		});

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

		const lab = await shard.expectStructure(labId, STRUCTURE_LAB);
		expect(lab.mineralType).toBe('OH');
		expect(lab.store['OH']).toBe(boostedAmount);

		const r1 = await shard.expectStructure(lab1, STRUCTURE_LAB);
		expect(r1.store.H ?? 0).toBe(0);
		const r2 = await shard.expectStructure(lab2, STRUCTURE_LAB);
		expect(r2.store.O ?? 0).toBe(0);
	});

	for (const row of labRunValidationCases) {
		test(`LAB-RUN-013:${row.label} runReaction() validation returns the canonical code`, async ({ shard }) => {
			shard.requires('chemistry');
			const blockers = shard.validationBlockers(row);
			const labOwner = blockers.has('not-owner') ? 'p2' : 'p1';
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [{ name: 'W1N1', rcl: blockers.has('rcl') ? 5 : 6, owner: 'p1' }],
			});
			const labStore: Record<string, number> = blockers.has('full')
				? blockers.has('invalid-args')
					? { energy: 2000, Z: LAB_MINERAL_CAPACITY }
					: { energy: 2000, OH: LAB_MINERAL_CAPACITY }
				: blockers.has('invalid-args')
					? { energy: 2000, Z: 1 }
					: { energy: 2000 };
			const labId = await shard.placeStructure('W1N1', {
				pos: [25, 25],
				structureType: STRUCTURE_LAB,
				owner: labOwner,
				store: labStore,
				...(blockers.has('cooldown') ? { cooldown: REACTION_TIME['OH'] } : {}),
			});
			// Reagents H + O make OH; H + H makes nothing. A far lab is at range 3.
			const lab1 = blockers.has('invalid-lab1')
				? await shard.placeStructure('W1N1', {
					pos: [25, 27], structureType: STRUCTURE_CONTAINER, store: { energy: 100 },
				})
				: await shard.placeStructure('W1N1', {
					pos: blockers.has('range-lab1') ? [25, 28] : [25, 27],
					structureType: STRUCTURE_LAB,
					owner: 'p1',
					store: { energy: 2000, H: blockers.has('not-enough-lab1') ? LAB_REACTION_AMOUNT - 1 : 100 },
				});
			let lab2: string | null;
			if (blockers.has('invalid-target')) {
				lab2 = null;
			} else if (blockers.has('self-target')) {
				lab2 = labId;
			} else if (blockers.has('not-a-lab')) {
				lab2 = await shard.placeStructure('W1N1', {
					pos: [27, 25], structureType: STRUCTURE_CONTAINER, store: { energy: 100 },
				});
			} else {
				lab2 = await shard.placeStructure('W1N1', {
					pos: blockers.has('range') ? [28, 25] : [27, 25],
					structureType: STRUCTURE_LAB,
					owner: 'p1',
					store: {
						energy: 2000,
						[blockers.has('no-product') ? 'H' : 'O']: blockers.has('not-enough') ? LAB_REACTION_AMOUNT - 1 : 100,
					},
				});
			}

			const rc = await shard.runPlayer('p1', code`
				const lab2 = ${lab2};
				Game.getObjectById(${labId}).runReaction(Game.getObjectById(${lab1}), lab2 && Game.getObjectById(lab2))
			`);
			expect(rc).toBe(row.expectedRc);
		});
	}
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

	// ---- LAB-REVERSE-003: PWR_OPERATE_LAB boosts reverse reaction amount ----
	test('LAB-REVERSE-003 reverseReaction with PWR_OPERATE_LAB active consumes and produces boosted amount', async ({ shard }) => {
		shard.requires('powerCreeps');
		shard.requires('chemistry');
		shard.requires('powerEffects');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1', powerEnabled: true }],
		});

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

	for (const row of labReverseValidationCases) {
		test(`LAB-REVERSE-013:${row.label} reverseReaction() validation returns the canonical code`, async ({ shard }) => {
			shard.requires('chemistry');
			const blockers = shard.validationBlockers(row);
			const labOwner = blockers.has('not-owner') ? 'p2' : 'p1';
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [{ name: 'W1N1', rcl: blockers.has('rcl') ? 5 : 6, owner: 'p1' }],
			});
			const compound = blockers.has('invalid-reverse-pair') ? 'H' : 'OH';
			const compoundAmount = blockers.has('not-enough') ? LAB_REACTION_AMOUNT - 1 : 100;
			const labId = await shard.placeStructure('W1N1', {
				pos: [25, 25],
				structureType: STRUCTURE_LAB,
				owner: labOwner,
				store: { energy: 2000, [compound]: compoundAmount },
				...(blockers.has('cooldown') ? { cooldown: REACTION_TIME['OH'] } : {}),
			});
			// OH reverses to H in lab1 and O in lab2. A far lab is at range 3.
			let lab1Id: string;
			if (blockers.has('invalid-lab1')) {
				lab1Id = await shard.placeStructure('W1N1', {
					pos: [25, 27], structureType: STRUCTURE_CONTAINER, store: { energy: 100 },
				});
			} else {
				lab1Id = await shard.placeStructure('W1N1', {
					pos: blockers.has('range') ? [28, 25] : [25, 27],
					structureType: STRUCTURE_LAB,
					owner: 'p1',
					store: blockers.has('full') ? { energy: 2000, H: LAB_MINERAL_CAPACITY } : { energy: 2000 },
				});
			}
			let lab2Id: string | null;
			if (blockers.has('same-lab')) {
				lab2Id = lab1Id;
			} else if (blockers.has('invalid-target')) {
				lab2Id = null;
			} else if (blockers.has('self-target')) {
				lab2Id = labId;
			} else if (blockers.has('not-a-lab')) {
				lab2Id = await shard.placeStructure('W1N1', {
					pos: [27, 25], structureType: STRUCTURE_CONTAINER, store: { energy: 100 },
				});
			} else {
				lab2Id = await shard.placeStructure('W1N1', {
					pos: blockers.has('range-lab2') ? [25, 22] : [27, 25],
					structureType: STRUCTURE_LAB,
					owner: 'p1',
					store: blockers.has('full-lab2') ? { energy: 2000, O: LAB_MINERAL_CAPACITY } : { energy: 2000 },
				});
			}

			const rc = await shard.runPlayer('p1', code`
				const lab2 = ${lab2Id};
				Game.getObjectById(${labId}).reverseReaction(Game.getObjectById(${lab1Id}), lab2 && Game.getObjectById(lab2))
			`);
			expect(rc).toBe(row.expectedRc);
		});
	}
});
