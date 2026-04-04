import { describe, test, expect, code, OK, MOVE, CARRY, ATTACK, TOUGH, FIND_TOMBSTONES } from '../../src/index.js';

describe('creep.suicide()', () => {
	test('destroys the creep', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).suicide()
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const creep = await shard.getObject(id);
		expect(creep).toBeNull();
	});

	test('creates a tombstone with carried resources and reclaimed body energy', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 30 },
			name: 'SuicideCreep',
		});

		await shard.runPlayer('p1', code`
			Game.creeps['SuicideCreep'].suicide()
		`);
		await shard.tick();

		const tombstones = await shard.findInRoom('W1N1', FIND_TOMBSTONES);
		expect(tombstones.length).toBeGreaterThanOrEqual(1);
		const tomb = tombstones.find((t: any) => t.kind === 'tombstone' && t.creepName === 'SuicideCreep');
		expect(tomb).toBeDefined();
		if (tomb?.kind === 'tombstone') {
			// Vanilla also reclaims 19 energy from the [CARRY, MOVE] body at death.
			expect(tomb.store.energy).toBe(49);
		}
	});
});

describe('creep.say()', () => {
	test('returns OK', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).say('hello')
		`);
		expect(rc).toBe(OK);
	});
});

describe('creep body part damage', () => {
	test('each body part has 100 hits and contributes to hitsMax', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [TOUGH, TOUGH, MOVE],
		});

		const creep = await shard.expectObject(id, 'creep');
		expect(creep.hits).toBe(300);
		expect(creep.hitsMax).toBe(300);
		expect(creep.body.map(part => part.hits)).toEqual([100, 100, 100]);
	});

	test('incoming damage is applied to the earliest surviving body part first', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [ATTACK, MOVE],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: [TOUGH, TOUGH, MOVE],
		});

		await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);
		await shard.tick();

		const target = await shard.expectObject(targetId, 'creep');
		expect(target.hits).toBe(270);
		expect(target.body.map(part => part.hits)).toEqual([70, 100, 100]);
	});

	test('a body part at 0 hits is destroyed before later parts continue taking damage', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [ATTACK, ATTACK, ATTACK, ATTACK, MOVE],
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: [TOUGH, MOVE, MOVE],
		});

		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const target = await shard.expectObject(targetId, 'creep');
		expect(target.hits).toBe(180);
		expect(target.body.map(part => part.hits)).toEqual([0, 80, 100]);
	});
});
