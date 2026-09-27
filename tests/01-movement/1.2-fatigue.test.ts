import { describe, test, expect, code,
	MOVE, WORK, CARRY, RANGED_ATTACK, OK,
	BODYPART_HITS, TERRAIN_SWAMP,
	body,
} from '../../src/index.js';

describe('creep fatigue', () => {
	test('MOVE-FATIGUE-001 each non-MOVE part on plains generates 2 fatigue', async ({ shard }) => {
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

	test('MOVE-FATIGUE-002 each undamaged MOVE part reduces fatigue by 2 at the start of each tick', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [WORK, WORK, WORK, WORK, WORK, MOVE, MOVE],
		});
		await shard.tick();

		// 5 weighted parts make 10; two MOVE parts take off 4 a tick.
		await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(TOP)`);
		const after1 = await shard.expectObject(id, 'creep');
		expect(after1.fatigue).toBe(6);

		await shard.tick();
		const after2 = await shard.expectObject(id, 'creep');
		expect(after2.fatigue).toBe(2);
	});

	test('MOVE-FATIGUE-003 empty CARRY parts do not contribute weight for fatigue calculation', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [CARRY, CARRY, CARRY, MOVE],
		});
		await shard.tick();
		await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(TOP)`);

		// Weighted, three CARRY parts would leave 6 - 2 = 4.
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
		terrain[24 * 50 + 25] = TERRAIN_SWAMP;
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
