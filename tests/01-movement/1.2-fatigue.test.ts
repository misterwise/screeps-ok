import { describe, test, expect, code,
	MOVE, WORK, CARRY, RANGED_ATTACK, OK, ERR_TIRED,
	BOOSTS, BODYPART_HITS,
	STRUCTURE_LAB, LAB_BOOST_MINERAL, LAB_ENERGY_CAPACITY,
	body,
} from '../../src/index.js';

describe('creep fatigue', () => {
	test('MOVE-FATIGUE-001 a creep composed only of MOVE parts generates no fatigue on plains', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE],
		});
		await shard.tick();
		await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(TOP)`);

		const creep = await shard.expectObject(id, 'creep');
		expect(creep.pos.y).toBe(24);
		expect(creep.fatigue).toBe(0);
	});

	test('MOVE-FATIGUE-001 non-MOVE parts on plains generate 2 fatigue each, balanced by one MOVE part', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [WORK, MOVE],
		});
		await shard.tick();
		await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(TOP)`);

		const creep = await shard.expectObject(id, 'creep');
		expect(creep.pos.y).toBe(24);
		expect(creep.fatigue).toBe(0);
	});

	test('MOVE-FATIGUE-001 insufficient MOVE parts leave residual fatigue on plains', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [WORK, WORK, MOVE],
		});
		await shard.tick();
		await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(TOP)`);

		const creep = await shard.expectObject(id, 'creep');
		expect(creep.pos.y).toBe(24);
		expect(creep.fatigue).toBe(2);
	});

	test('MOVE-BASIC-003 move() returns ERR_TIRED while the creep has fatigue > 0', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [WORK, WORK, WORK, MOVE],
		});
		await shard.tick();

		await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(TOP)`);
		// runPlayer processed the move — observe immediately
		const after1 = await shard.expectObject(id, 'creep');
		expect(after1.pos.y).toBe(24);
		expect(after1.fatigue).toBe(4);

		// Next runPlayer: creep still has fatigue, move should fail
		const rc = await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(TOP)`);
		expect(rc).toBe(ERR_TIRED);
		// 1 MOVE reduces fatigue by 2 during this tick: 4 → 2
		const after2 = await shard.expectObject(id, 'creep');
		expect(after2.pos.y).toBe(24);
		expect(after2.fatigue).toBe(2);
	});

	test('MOVE-FATIGUE-002 each undamaged MOVE part reduces fatigue by 2 at the start of each tick', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [WORK, WORK, WORK, MOVE],
		});
		await shard.tick();

		await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(TOP)`);
		const after1 = await shard.expectObject(id, 'creep');
		expect(after1.fatigue).toBe(4);

		// 1 tick: MOVE reduces fatigue by 2 → 4-2 = 2
		await shard.tick();
		const after2 = await shard.expectObject(id, 'creep');
		expect(after2.fatigue).toBe(2);
	});

	test('MOVE-FATIGUE-003 empty CARRY parts do not contribute weight for fatigue calculation', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [CARRY, MOVE],
		});
		await shard.tick();
		await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(TOP)`);

		const creep = await shard.expectObject(id, 'creep');
		expect(creep.pos.y).toBe(24);
		expect(creep.fatigue).toBe(0);
	});

	test('MOVE-FATIGUE-004 non-empty CARRY parts contribute weight for fatigue calculation like other non-MOVE parts', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [CARRY, CARRY, MOVE],
			store: { energy: 100 },
		});
		await shard.tick();
		await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(TOP)`);

		const creep = await shard.expectObject(id, 'creep');
		expect(creep.pos.y).toBe(24);
		expect(creep.fatigue).toBe(2);
	});

	test('MOVE-FATIGUE-005 moving onto swamp generates 10 fatigue per weighted body part', async ({ shard }) => {
		shard.requires('terrain', 'swamp tile required for swamp fatigue assertion');
		// [25, 24] = swamp, everything else plain.
		const terrain = new Array(2500).fill(0);
		terrain[24 * 50 + 25] = 2;
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1', terrain }],
		});
		// 1 weighted part (1 WORK) + 1 MOVE.
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [WORK, MOVE],
		});
		await shard.tick();

		await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(TOP)`);

		const creep = await shard.expectObject(id, 'creep');
		// Confirm the creep moved onto the swamp tile.
		expect(creep.pos.y).toBe(24);
		// Swamp generates 10 fatigue per weighted part. 1 weighted part = 10.
		// 1 MOVE part reduces fatigue by 2 → final = 8.
		expect(creep.fatigue).toBe(8);
	});
});

// MOVE-FATIGUE-006 — Boosted MOVE parts reduce fatigue per tick by the
// boosted amount. Iterate every move boost compound from BOOSTS.
const moveBoostCompounds = Object.entries(
	BOOSTS.move as Record<string, Record<string, number>>,
);

describe('MOVE-FATIGUE-006 boosted MOVE parts reduce fatigue by the boosted amount', () => {
	for (const [compound, effects] of moveBoostCompounds) {
		const multiplier = effects.fatigue;

		test(`${compound} (${multiplier}x reduction)`, async ({ shard }) => {
			shard.requires('chemistry');
			await shard.ownedRoom('p1', 'W1N1', 6);

			const labId = await shard.placeStructure('W1N1', {
				pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
				store: { energy: LAB_ENERGY_CAPACITY, [compound]: LAB_BOOST_MINERAL },
			});
			// 4 WORK + 1 MOVE: each plain move generates 8 fatigue (4 weighted * 2).
			// One boosted MOVE reduces fatigue by 2*multiplier per tick. With
			// multiplier in {2, 3, 4} and unboosted baseline 1, residual fatigue
			// after a single move is max(0, 8 - 2*multiplier) — distinct per
			// compound.
			const creepId = await shard.placeCreep('W1N1', {
				pos: [25, 26], owner: 'p1',
				body: body(4, WORK, MOVE),
			});
			await shard.tick();

			await shard.runPlayer('p1', code`
				Game.getObjectById(${labId}).boostCreep(Game.getObjectById(${creepId}))
			`);
			await shard.tick();

			await shard.runPlayer('p1', code`Game.getObjectById(${creepId}).move(LEFT)`);

			const creep = await shard.expectObject(creepId, 'creep');
			expect(creep.fatigue).toBe(Math.max(0, 8 - 2 * multiplier));
		});
	}
});

describe('MOVE-FATIGUE-008 fatigue reduction cannot go below zero', () => {
	test('MOVE-FATIGUE-008 excess MOVE capacity does not produce negative fatigue', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// 1 WORK (2 fatigue on plains) + 3 MOVE (6 reduction capacity).
		// MOVE capacity exceeds generated fatigue by 4, but fatigue must
		// floor at 0 rather than going negative.
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [WORK, MOVE, MOVE, MOVE],
		});
		await shard.tick();
		await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(TOP)`);

		const creep = await shard.expectObject(id, 'creep');
		expect(creep.pos.y).toBe(24);
		expect(creep.fatigue).toBe(0);
	});

	test('MOVE-FATIGUE-008 tick reduction on residual fatigue floors at zero', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// 2 WORK + 1 MOVE: move generates 4 fatigue, reduced by 2 → 2 residual.
		// Next tick: 1 MOVE reduces by 2 → 0 (not -0 or negative).
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [WORK, WORK, MOVE],
		});
		await shard.tick();

		await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(TOP)`);
		const after1 = await shard.expectObject(id, 'creep');
		expect(after1.fatigue).toBe(2);

		// One more tick: fatigue 2 - 2 = 0.
		await shard.tick();
		const after2 = await shard.expectObject(id, 'creep');
		expect(after2.fatigue).toBe(0);
	});
});

describe('MOVE-FATIGUE-007 damaged MOVE parts do not contribute to fatigue reduction', () => {
	test('MOVE-FATIGUE-007 a 0-HP MOVE part stops reducing fatigue', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});

		// 2 MOVE + 2 WORK.
		// All MOVE active: 2 reduction parts (4 fat reduction) cancels 2 weighted
		// parts (4 fatigue) → 0 residual.
		// One MOVE dead: only 1 reduction part (2 fat reduction) vs 4 fatigue
		// → 2 residual fatigue.
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE, MOVE, WORK, WORK],
		});
		// 10 RANGED_ATTACK parts deal exactly 100 damage at range 1, killing
		// one MOVE part outright (100 HP per part).
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2', body: body(10, RANGED_ATTACK, MOVE),
		});
		await shard.tick();

		await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).rangedAttack(Game.getObjectById(${creepId}))
		`);

		// Confirm exactly one MOVE part is dead and the other is alive before
		// asserting the fatigue rule, so a damage-distribution change shows up
		// here rather than as a confusing fatigue mismatch.
		const damaged = await shard.expectObject(creepId, 'creep');
		const moveParts = damaged.body.filter(p => p.type === MOVE);
		const deadMoves = moveParts.filter(p => p.hits === 0);
		const liveMoves = moveParts.filter(p => p.hits > 0);
		expect(deadMoves.length).toBe(1);
		expect(liveMoves.length).toBe(1);
		// All WORK parts should still be alive.
		const workParts = damaged.body.filter(p => p.type === WORK);
		expect(workParts.every(p => p.hits === BODYPART_HITS)).toBe(true);

		const moveRc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).move(LEFT)
		`);
		expect(moveRc).toBe(OK);

		const after = await shard.expectObject(creepId, 'creep');
		// 1 active MOVE → 2 fatigue reduction
		// 2 WORK    → 4 fatigue per move
		// Net residual fatigue after the move: 2.
		expect(after.fatigue).toBe(2);
	});
});
