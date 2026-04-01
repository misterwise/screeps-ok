import { describe, test, expect, code } from '../../src/index.js';

describe('movement: fatigue', () => {
	test('MOVE part on plains: no fatigue', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: ['move'],
		});
		await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(TOP)`);
		await shard.tick();

		const creep = await shard.getObject(id);
		expect(creep?.kind).toBe('creep');
		if (creep?.kind === 'creep') {
			expect(creep.pos.y).toBe(24);
			expect(creep.fatigue).toBe(0);
		}
	});

	test('non-MOVE parts generate fatigue on plains', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		// 1 MOVE + 1 WORK = 2 fatigue per move on plains (MOVE cancels 2, WORK adds 2)
		// Actually: each non-move part adds 2 fatigue on plains, each MOVE removes 2
		// 1 WORK = 2 fatigue generated, 1 MOVE = 2 fatigue removed → net 0
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: ['work', 'move'],
		});
		await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(TOP)`);
		await shard.tick();

		const creep = await shard.getObject(id);
		if (creep?.kind === 'creep') {
			expect(creep.pos.y).toBe(24);
			expect(creep.fatigue).toBe(0); // 1:1 move ratio = no fatigue on plains
		}
	});

	test('insufficient MOVE parts cause fatigue on plains', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		// 2 WORK + 1 MOVE: generates 4 fatigue, removes 2 → net 2
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: ['work', 'work', 'move'],
		});
		await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(TOP)`);
		await shard.tick();

		const creep = await shard.getObject(id);
		if (creep?.kind === 'creep') {
			expect(creep.pos.y).toBe(24); // still moves
			expect(creep.fatigue).toBe(2);
		}
	});

	test('creep with fatigue cannot move', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		// 3 WORK + 1 MOVE: generates 6, removes 2 → 4 fatigue after first move
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: ['work', 'work', 'work', 'move'],
		});

		// First move
		await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(TOP)`);
		await shard.tick();

		const after1 = await shard.getObject(id);
		if (after1?.kind === 'creep') {
			expect(after1.pos.y).toBe(24);
			expect(after1.fatigue).toBe(4);
		}

		// Second move — should fail due to fatigue
		const rc = await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(TOP)`);
		await shard.tick();

		const after2 = await shard.getObject(id);
		if (after2?.kind === 'creep') {
			expect(after2.pos.y).toBe(24); // didn't move
			// Fatigue decreases by 2*MOVE parts per tick = 2
			expect(after2.fatigue).toBe(2);
		}
	});

	test('empty CARRY parts do not generate fatigue', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		// Empty CARRY is treated as weightless (Screeps specific behavior)
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: ['carry', 'move'],
			// No store — empty carry
		});
		await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(TOP)`);
		await shard.tick();

		const creep = await shard.getObject(id);
		if (creep?.kind === 'creep') {
			expect(creep.pos.y).toBe(24);
			expect(creep.fatigue).toBe(0);
		}
	});

	test('full CARRY parts generate fatigue like other parts', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		// 1 full CARRY + 0 MOVE = 2 fatigue, 0 removed
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: ['carry', 'carry', 'move'],
			store: { energy: 1 }, // at least 1 energy makes carry "full" for weight
		});
		await shard.runPlayer('p1', code`Game.getObjectById(${id}).move(TOP)`);
		await shard.tick();

		const creep = await shard.getObject(id);
		if (creep?.kind === 'creep') {
			expect(creep.pos.y).toBe(24);
			// 2 CARRY with cargo = 4 fatigue, 1 MOVE = 2 removed → net 2
			expect(creep.fatigue).toBe(2);
		}
	});
});
