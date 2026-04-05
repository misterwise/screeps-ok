import { describe, test, expect, code, MOVE, WORK, CARRY, ERR_TIRED } from '../../src/index.js';

describe('creep fatigue', () => {
	test('MOVE-FATIGUE-001 a creep composed only of MOVE parts generates no fatigue on plains', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE],
		});
		await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(TOP)`);
		await shard.tick();

		const creep = await shard.expectObject(id, 'creep');
		expect(creep.pos.y).toBe(24);
		expect(creep.fatigue).toBe(0);
	});

	test('MOVE-FATIGUE-001 non-MOVE parts on plains generate 2 fatigue each, balanced by one MOVE part', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// 1 MOVE + 1 WORK = 2 fatigue per move on plains (MOVE cancels 2, WORK adds 2)
		// Actually: each non-move part adds 2 fatigue on plains, each MOVE removes 2
		// 1 WORK = 2 fatigue generated, 1 MOVE = 2 fatigue removed -> net 0
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [WORK, MOVE],
		});
		await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(TOP)`);
		await shard.tick();

		const creep = await shard.expectObject(id, 'creep');
		expect(creep.pos.y).toBe(24);
		expect(creep.fatigue).toBe(0); // 1:1 move ratio = no fatigue on plains
	});

	test('MOVE-FATIGUE-001 insufficient MOVE parts leave residual fatigue on plains', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// 2 WORK + 1 MOVE: generates 4 fatigue, removes 2 -> net 2
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [WORK, WORK, MOVE],
		});
		await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(TOP)`);
		await shard.tick();

		const creep = await shard.expectObject(id, 'creep');
		expect(creep.pos.y).toBe(24); // still moves
		expect(creep.fatigue).toBe(2);
	});

	test('MOVE-BASIC-003 move() returns ERR_TIRED while the creep has fatigue > 0', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [WORK, WORK, WORK, MOVE],
		});

		await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(TOP)`);
		await shard.tick();

		const after1 = await shard.expectObject(id, 'creep');
		expect(after1.pos.y).toBe(24);
		expect(after1.fatigue).toBe(4);

		const rc = await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(TOP)`);
		expect(rc).toBe(ERR_TIRED);
		await shard.tick();

		const after2 = await shard.expectObject(id, 'creep');
		expect(after2.pos.y).toBe(24);
		expect(after2.fatigue).toBe(2);
	});

	test('MOVE-FATIGUE-002 each undamaged MOVE part reduces fatigue by 2 at the start of each tick', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [WORK, WORK, WORK, MOVE],
		});

		await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(TOP)`);
		await shard.tick();

		const after1 = await shard.expectObject(id, 'creep');
		expect(after1.fatigue).toBe(4);

		await shard.tick();

		const after2 = await shard.expectObject(id, 'creep');
		expect(after2.fatigue).toBe(2);
	});

	test('MOVE-FATIGUE-003 empty CARRY parts do not contribute weight for fatigue calculation', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// Empty CARRY is treated as weightless (Screeps specific behavior)
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [CARRY, MOVE],
			// No store — empty carry
		});
		await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(TOP)`);
		await shard.tick();

		const creep = await shard.expectObject(id, 'creep');
		expect(creep.pos.y).toBe(24);
		expect(creep.fatigue).toBe(0);
	});

	test('MOVE-FATIGUE-004 non-empty CARRY parts contribute weight for fatigue calculation like other non-MOVE parts', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// 2 full CARRY + 1 MOVE: CARRY parts with cargo count as weighted
		// Need to fill capacity to make them count (50 per CARRY = 100 total)
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [CARRY, CARRY, MOVE],
			store: { energy: 100 }, // fills both CARRY parts
		});
		await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(TOP)`);
		await shard.tick();

		const creep = await shard.expectObject(id, 'creep');
		expect(creep.pos.y).toBe(24);
		// 2 CARRY with cargo = 4 fatigue, 1 MOVE = 2 removed -> net 2
		expect(creep.fatigue).toBe(2);
	});
});
