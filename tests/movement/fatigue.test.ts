import { describe, test, expect, code, MOVE, WORK, CARRY, ERR_TIRED } from '../../src/index.js';

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
});
