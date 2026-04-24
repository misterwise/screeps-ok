import { describe, test, expect, code,
	OK, ERR_NOT_OWNER, ERR_BUSY,
	MOVE, WORK, CARRY, ATTACK, TOUGH, CLAIM,
	STRUCTURE_SPAWN,
	FIND_TOMBSTONES, RESOURCE_POWER,
	BODYPART_COST,
	CREEP_SPAWN_TIME, CREEP_LIFE_TIME, CREEP_CLAIM_LIFE_TIME,
	CREEP_PART_MAX_ENERGY, CREEP_CORPSE_RATE,
} from '../../src/index.js';
import { creepDeathResourceCases } from '../../src/matrices/creep-death-sources.js';

describe('creep.suicide()', () => {
	test('CREEP-SUICIDE-001 destroys the creep', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).suicide()
		`);
		expect(rc).toBe(OK);

		const creep = await shard.getObject(id);
		expect(creep).toBeNull();
	});

	test('CREEP-SUICIDE-002 suicide creates a tombstone at the creep position', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 50 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).suicide()
		`);
		expect(rc).toBe(OK);

		const tombstones = await shard.findInRoom('W1N1', FIND_TOMBSTONES);
		const tomb = tombstones.find(t => t.pos.x === 25 && t.pos.y === 25);
		expect(tomb).toBeDefined();
	});

	test('CREEP-SUICIDE-003 suicide returns ERR_NOT_OWNER on another player\'s creep', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const enemyId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p2',
			body: [MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${enemyId}).suicide()
		`);
		expect(rc).toBe(ERR_NOT_OWNER);
	});

	test('CREEP-SUICIDE-004 suicide returns ERR_BUSY on a spawning creep', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 1);
		// Place a spawn explicitly (ownedRoom doesn't create one).
		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: 'spawn', owner: 'p1',
			store: { energy: 300 },
		});
		await shard.tick();

		// Start spawning a creep (1 MOVE = 50 energy, well within 300).
		const result = await shard.runPlayer('p1', code`
			const spawns = Object.values(Game.spawns);
			if (!spawns.length) ({ rc: -99 });
			else {
				const rc = spawns[0].spawnCreep([MOVE, MOVE, MOVE], 'TestCreep');
				({ rc })
			}
		`) as { rc: number };
		expect(result.rc).toBe(OK);

		// The creep is now spawning (3 parts × 3 ticks each = 9 ticks).
		const suicideRc = await shard.runPlayer('p1', code`
			const creep = Game.creeps['TestCreep'];
			creep ? creep.suicide() : -99
		`);
		expect(suicideRc).toBe(ERR_BUSY);
	});

	test('CREEP-DEATH-009 suicide at high remaining TTL also reclaims body energy into the tombstone', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { [RESOURCE_POWER]: 30 },
			name: 'SuicideEnergyCreep',
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.creeps['SuicideEnergyCreep'].suicide()
		`);
		// runPlayer processed the suicide (1 tick). Observe via findInRoom.
		const tombstones = await shard.findInRoom('W1N1', FIND_TOMBSTONES);
		const tomb = tombstones.find(t => t.creepName === 'SuicideEnergyCreep');
		expect(tomb).toBeDefined();
		if (tomb) {
			expect(tomb.store.energy).toBe(19);
			expect(tomb.store.power).toBe(30);
		}
	});

	test('CREEP-DEATH-010 CLAIM body reclaims body energy at the CREEP_CLAIM_LIFE_TIME rate', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CLAIM, MOVE],
			name: 'ClaimSuicide',
			ticksToLive: 600,
		});
		await shard.tick();

		// Capture ticksToLive as observed by the suicide tick's buryCreep.
		const { ttl } = await shard.runPlayer('p1', code`
			const creep = Game.creeps['ClaimSuicide'];
			const ttl = creep.ticksToLive;
			creep.suicide();
			({ ttl })
		`) as { ttl: number };

		const tombstones = await shard.findInRoom('W1N1', FIND_TOMBSTONES);
		const tomb = tombstones.find(t => t.creepName === 'ClaimSuicide');
		expect(tomb).toBeDefined();

		// Engine formula with CLAIM body: lifeRate = CREEP_CORPSE_RATE * ttl / CREEP_CLAIM_LIFE_TIME.
		// Regressing to CREEP_LIFE_TIME here would yield ~40% of the expected value.
		const lifeRate = CREEP_CORPSE_RATE * ttl / CREEP_CLAIM_LIFE_TIME;
		let bodyEnergy = 0;
		for (const part of [CLAIM, MOVE]) {
			bodyEnergy += Math.min(CREEP_PART_MAX_ENERGY, BODYPART_COST[part] * lifeRate);
		}
		bodyEnergy = Math.floor(bodyEnergy);

		expect(tomb!.store.energy ?? 0).toBe(bodyEnergy);
	});

	for (const { label, creepName, ticksToLive, trigger } of creepDeathResourceCases) {
		test(`CREEP-DEATH-008 [${label}] preserves carried resources in the tombstone`, async ({ shard }) => {
			await shard.ownedRoom('p1');
			await shard.placeCreep('W1N1', {
				pos: [25, 25], owner: 'p1',
				body: [CARRY, MOVE],
				store: { [RESOURCE_POWER]: 30 },
				ticksToLive,
				name: creepName,
			});
			await shard.tick();

			if (trigger === 'suicide') {
				await shard.runPlayer('p1', code`
					Game.creeps[${creepName}].suicide()
				`);
				// runPlayer processed the suicide (1 tick)
			} else {
				// TTL death — tick until creep dies
				await shard.tick();
			}

			const tombstones = await shard.findInRoom('W1N1', FIND_TOMBSTONES);
			expect(tombstones.length).toBe(1);
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
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).say('hello')
		`);
		expect(rc).toBe(OK);
		// runPlayer consumed 1 tick — saying is now visible. Observe via
		// the next runPlayer (1 more tick) which is still within the 1-tick
		// visibility window on the immediately following tick.
		const visible = await shard.runPlayer('p1', code`
			Game.getObjectById(${id}).saying
		`);
		expect(visible).toBe('hello');

		// One more tick — saying should have expired
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
		// runPlayer consumed 1 tick — saying is visible. runPlayers
		// consumes 1 more tick (still within visibility window).
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
		// Observe via runPlayers (1 more tick, within visibility window)
		const seen = await shard.runPlayers({
			p1: code`Game.getObjectById(${speakerId}).saying`,
			p2: code`Game.getObjectById(${speakerId}).saying`,
		});
		expect(seen.p1).toBe('private');
		expect(seen.p2).toBeNull();
	});
});

describe('Creep spawning state', () => {
	test('CREEP-SPAWNING-001 creep.spawning is true while the creep is being spawned', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([WORK, MOVE], 'SpawningCheck')
		`);
		expect(rc).toBe(OK);

		// 2 parts × CREEP_SPAWN_TIME ticks — check partway through.
		const spawning = await shard.runPlayer('p1', code`
			const c = Game.creeps['SpawningCheck'];
			c ? c.spawning : null
		`);
		expect(spawning).toBe(true);
	});

	test('CREEP-SPAWNING-002 creep.ticksToLive is undefined while spawning', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([WORK, MOVE], 'TTLCheck')
		`);

		const ttl = await shard.runPlayer('p1', code`
			const c = Game.creeps['TTLCheck'];
			c ? c.ticksToLive : 'missing'
		`);
		// ticksToLive is undefined (serializes as null over JSON) while spawning.
		expect(ttl).toBeNull();
	});

	test('CREEP-SPAWNING-003 a spawning creep cannot perform actions', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 2, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		// Place an enemy adjacent so attack has a valid target.
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 24], owner: 'p2', body: [TOUGH, MOVE],
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([ATTACK, MOVE], 'ActionCheck')
		`);

		// Creep is mid-spawn — try to attack.
		const rc = await shard.runPlayer('p1', code`
			const c = Game.creeps['ActionCheck'];
			const t = Game.getObjectById(${targetId});
			c && t ? c.attack(t) : -99
		`);
		expect(rc).toBe(ERR_BUSY);
	});

	test('CREEP-SPAWNING-004 a spawning creep body parts are visible before spawning completes', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([WORK, CARRY, MOVE], 'BodyCheck')
		`);

		// Mid-spawn — body should already be readable.
		const body = await shard.runPlayer('p1', code`
			const c = Game.creeps['BodyCheck'];
			c ? c.body.map(p => p.type) : null
		`);
		expect(body).toEqual([WORK, CARRY, MOVE]);
	});
});
