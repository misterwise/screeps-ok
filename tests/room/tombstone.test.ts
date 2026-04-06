import { describe, test, expect, code, OK, MOVE, CARRY, ATTACK, TOUGH, body, ATTACK_POWER, BODYPART_HITS, TOMBSTONE_DECAY_PER_PART, FIND_TOMBSTONES } from '../../src/index.js';

describe('Tombstone', () => {
	test('TOMBSTONE-001 killing a creep creates a tombstone with the creep name, death time, and store', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		// Target with 1 TOUGH (100 HP) — one ATTACK hit (30 damage) won't kill.
		// Use a weak target that dies in one hit: 1 part = 100 HP, ATTACK_POWER = 30.
		// Need target with <= ATTACK_POWER HP. Can't have < 1 part.
		// Instead: use 1 TOUGH target and 4 ATTACK parts (4 * 30 = 120 > 100).
		// 7 ATTACK parts = 210 damage, enough to kill a 2-part creep (200 HP)
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: body(7, ATTACK, MOVE),
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: [CARRY, MOVE],
			name: 'victim',
			store: { energy: 30 },
		});
		await shard.tick();

		const gameTimeBefore = await shard.getGameTime();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);
		await shard.tick();
		// Allow an extra tick for destruction cleanup if needed
		await shard.tick();

		// Target should be dead
		const target = await shard.getObject(targetId);
		expect(target).toBeNull();

		// Find the tombstone — target was at [25, 26]
		const tombstones = await shard.findInRoom('W1N1', FIND_TOMBSTONES);
		expect(tombstones.length).toBeGreaterThanOrEqual(1);
		const tomb = tombstones.find(t => t.pos.x === 25 && t.pos.y === 26);
		expect(tomb).toBeDefined();
		expect(tomb!.creepName).toBe('victim');
		// deathTime should be the tick when the creep died
		expect(tomb!.deathTime).toBeGreaterThanOrEqual(gameTimeBefore + 1);
		expect(tomb!.deathTime).toBeLessThanOrEqual(gameTimeBefore + 2);
		expect(tomb!.store).toBeDefined();
	});

	test('TOMBSTONE-002 creep tombstone ticksToDecay equals body.length * TOMBSTONE_DECAY_PER_PART', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		// 4-part target (400 HP) needs 14+ ATTACK parts to one-shot (14 * 30 = 420)
		const bodyParts = [TOUGH, TOUGH, TOUGH, MOVE];
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: body(14, ATTACK, MOVE),
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: bodyParts,
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);
		await shard.tick();
		await shard.tick();

		const tombstones = await shard.findInRoom('W1N1', FIND_TOMBSTONES);
		const tomb = tombstones.find(t => t.pos.x === 25 && t.pos.y === 26);
		expect(tomb).toBeDefined();
		// Initial decay = bodyParts.length * TOMBSTONE_DECAY_PER_PART
		// We observe 1-2 ticks after creation, so allow for decrement.
		const expectedInitial = bodyParts.length * TOMBSTONE_DECAY_PER_PART;
		expect(tomb!.ticksToDecay).toBeGreaterThanOrEqual(expectedInitial - 2);
		expect(tomb!.ticksToDecay).toBeLessThanOrEqual(expectedInitial);
	});
});
