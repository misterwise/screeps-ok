import { describe, test, expect, code, OK, MOVE, CARRY, ATTACK, TOUGH, body, ATTACK_POWER, BODYPART_HITS, BODYPART_COST, TOMBSTONE_DECAY_PER_PART, CREEP_CORPSE_RATE, CREEP_LIFE_TIME, FIND_TOMBSTONES, RESOURCE_ENERGY } from '../../src/index.js';

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

		// Capture Game.time in the same timing model the engine uses for deathTime
		const attackResult = await shard.runPlayer('p1', code`
			const rc = Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}));
			({ rc, time: Game.time })
		`) as { rc: number; time: number };
		expect(attackResult.rc).toBe(OK);
		const attackTime = attackResult.time;

		await shard.tick();
		// Allow an extra tick for destruction cleanup if needed
		await shard.tick();

		// Target should be dead
		const target = await shard.getObject(targetId);
		expect(target).toBeNull();

		// Bracket the expected deathTime with bot-visible Game.time
		const timeAfterDeath = await shard.runPlayer('p1', code`Game.time`) as number;

		// Find the tombstone — target was at [25, 26]
		const tombstones = await shard.findInRoom('W1N1', FIND_TOMBSTONES);
		expect(tombstones.length).toBe(1);
		const tomb = tombstones.find(t => t.pos.x === 25 && t.pos.y === 26);
		expect(tomb).toBeDefined();
		expect(tomb!.creepName).toBe('victim');
		// deathTime must fall between the attack tick and current observation
		expect(tomb!.deathTime).toBeGreaterThanOrEqual(attackTime);
		expect(tomb!.deathTime).toBeLessThanOrEqual(timeAfterDeath);
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

	test('TOMBSTONE-003 tombstone store contains the resources the creep was carrying at death', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const targetBody = [CARRY, MOVE];
		const carriedEnergy = 50;
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: body(7, ATTACK, MOVE),
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: targetBody,
			name: 'carrier',
			store: { energy: carriedEnergy },
		});
		await shard.tick();

		// Capture TTL on the attack tick to compute exact corpse energy.
		const ttl = await shard.runPlayer('p2', code`
			Game.creeps['carrier'].ticksToLive
		`) as number;

		await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);
		await shard.tick();
		await shard.tick();

		// Engine formula: lifeRate = CREEP_CORPSE_RATE * ttl / CREEP_LIFE_TIME
		// bodyEnergy = floor(sum of BODYPART_COST[part] * lifeRate per part)
		// tombstone.store.energy = bodyEnergy + carried
		const lifeRate = CREEP_CORPSE_RATE * ttl / CREEP_LIFE_TIME;
		let bodyEnergy = 0;
		for (const part of targetBody) {
			bodyEnergy += BODYPART_COST[part] * lifeRate;
		}
		bodyEnergy = Math.floor(bodyEnergy);
		const expectedEnergy = bodyEnergy + carriedEnergy;

		const tombstones = await shard.findInRoom('W1N1', FIND_TOMBSTONES);
		const tomb = tombstones.find(t => t.creepName === 'carrier');
		expect(tomb).toBeDefined();
		expect(tomb!.store[RESOURCE_ENERGY]).toBe(expectedEnergy);
	});

	test('TOMBSTONE-004 tombstone is removed when ticksToDecay reaches 0', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const tombId = await shard.placeTombstone('W1N1', {
			pos: [25, 25],
			creepName: 'ephemeral',
			ticksToDecay: 2,
		});
		await shard.tick();

		const tomb = await shard.getObject(tombId);
		expect(tomb).not.toBeNull();

		await shard.tick();
		await shard.tick();
		await shard.tick();

		const gone = await shard.getObject(tombId);
		expect(gone).toBeNull();
	});
});
