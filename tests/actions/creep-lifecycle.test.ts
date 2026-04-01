import { describe, test, expect, code } from '../../src/index.js';

describe('creep.suicide()', () => {
	test('destroys the creep', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: ['move'],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).suicide()
		`);
		expect(rc).toBe(0);
		await shard.tick();

		const creep = await shard.getObject(id);
		expect(creep).toBeNull();
	});

	test('creates a tombstone with carried resources', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: ['carry', 'move'],
			store: { energy: 30 },
			name: 'SuicideCreep',
		});

		await shard.runPlayer('p1', code`
			Game.creeps['SuicideCreep'].suicide()
		`);
		await shard.tick();

		const tombstones = await shard.findInRoom('W1N1', 'tombstones');
		expect(tombstones.length).toBeGreaterThanOrEqual(1);
		const tomb = tombstones.find((t: any) => t.kind === 'tombstone' && t.creepName === 'SuicideCreep');
		expect(tomb).toBeDefined();
		if (tomb?.kind === 'tombstone') {
			expect(tomb.store.energy).toBe(30);
		}
	});
});

describe('creep.say()', () => {
	test('returns OK', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: ['move'],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).say('hello')
		`);
		expect(rc).toBe(0);
	});
});

describe('creep body part damage', () => {
	test('30 damage reduces total hits from 300 to 270', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: ['attack', 'move'],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: ['tough', 'tough', 'move'],
		});

		await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);
		await shard.tick();

		const target = await shard.getObject(targetId);
		if (target?.kind === 'creep') {
			expect(target.hits).toBe(270);
			// Exactly one body part should have taken 30 damage
			const damaged = target.body.filter(p => p.hits < 100);
			expect(damaged).toHaveLength(1);
			expect(damaged[0].hits).toBe(70);
		}
	});
});
