import { describe, test, expect, code, OK, MOVE, CARRY, ATTACK, TOUGH, FIND_TOMBSTONES, RESOURCE_POWER } from '../../src/index.js';
import { creepDeathResourceCases } from '../support/matrices/creep-death-sources.js';
import { knownParityGap } from '../support/parity-gaps.js';

describe('creep.suicide()', () => {
	test('CREEP-SUICIDE-001 destroys the creep', async ({ shard }) => {
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

	knownParityGap('tombstone-corpse-rate')('suicide at high remaining TTL also reclaims body energy into the tombstone', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { [RESOURCE_POWER]: 30 },
			name: 'SuicideEnergyCreep',
		});

		await shard.runPlayer('p1', code`
			Game.creeps['SuicideEnergyCreep'].suicide()
		`);
		await shard.tick();

		const tombstones = await shard.findInRoom('W1N1', FIND_TOMBSTONES);
		const tomb = tombstones.find(t => t.creepName === 'SuicideEnergyCreep');
		expect(tomb).toBeDefined();
		if (tomb) {
			expect(tomb.store.energy).toBe(19);
			expect(tomb.store.power).toBe(30);
		}
	});

	for (const { label, creepName, ticksToLive, trigger } of creepDeathResourceCases) {
		knownParityGap('tombstone-corpse-rate')(`CREEP-DEATH-008 [${label}] preserves carried resources in the tombstone`, async ({ shard }) => {
			await shard.ownedRoom('p1');
			await shard.placeCreep('W1N1', {
				pos: [25, 25], owner: 'p1',
				body: [CARRY, MOVE],
				store: { [RESOURCE_POWER]: 30 },
				ticksToLive,
				name: creepName,
			});

			if (trigger === 'suicide') {
				await shard.runPlayer('p1', code`
					Game.creeps[${creepName}].suicide()
				`);
			} else {
				await shard.tick();
			}

			if (trigger === 'suicide') {
				await shard.tick();
			}

			const tombstones = await shard.findInRoom('W1N1', FIND_TOMBSTONES);
			expect(tombstones.length).toBeGreaterThanOrEqual(1);
			const tomb = tombstones.find(t => t.creepName === creepName);
			expect(tomb).toBeDefined();
			if (tomb) {
				expect(tomb.store.power).toBe(30);
			}
		});
	}
});

describe('creep.say()', () => {
	test('CREEP-SAY-001 say() makes the message visible to the owner for one tick', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).say('hello')
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const visible = await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).saying
		`);
		expect(visible).toBe('hello');

		await shard.tick();

		const hidden = await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).saying
		`);
		expect(hidden).toBeNull();
	});

	test('CREEP-SAY-002 say(message, true) makes the message visible to all players', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const speakerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE],
		});
		await shard.placeCreep('W1N1', {
			pos: [26, 25], owner: 'p2',
			body: [MOVE],
		});

		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${speakerId}).say('public', true)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const seen = await shard.runPlayers({
			p1: code`Game.getObjectById(${speakerId}).saying`,
			p2: code`Game.getObjectById(${speakerId}).saying`,
		});
		expect(seen.p1).toBe('public');
		expect(seen.p2).toBe('public');
	});

	test('CREEP-SAY-003 without the public flag, only the owner sees the message', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const speakerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE],
		});
		await shard.placeCreep('W1N1', {
			pos: [26, 25], owner: 'p2',
			body: [MOVE],
		});

		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${speakerId}).say('private')
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const seenByOwner = await shard.runPlayer('p1', code`
			Game.getObjectById(${speakerId}).saying
		`);
		const seenByOther = await shard.runPlayer('p2', code`
			Game.getObjectById(${speakerId}).saying
		`);
		expect(seenByOwner).toBe('private');
		expect(seenByOther).toBeNull();
	});
});

describe('creep body part damage', () => {
	test('COMBAT-BODYPART-002 each body part has 100 hits and contributes to hitsMax', async ({ shard }) => {
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

	test('COMBAT-BODYPART-001 incoming damage is applied to the earliest surviving body part first', async ({ shard }) => {
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

	test('COMBAT-BODYPART-003 a body part at 0 hits is excluded from getActiveBodyparts(type)', async ({ shard }) => {
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

		const activeTough = await shard.runPlayer('p1', code`
			Game.getObjectById(${targetId}).getActiveBodyparts(TOUGH)
		`);
		expect(activeTough).toBe(0);
	});
});
