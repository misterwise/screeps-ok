import { describe, test, expect, code, OK, MOVE, CARRY, ATTACK, body, BODYPART_HITS, BODYPART_COST, CREEP_CORPSE_RATE, CREEP_LIFE_TIME, CREEP_PART_MAX_ENERGY, CARRY_CAPACITY, FIND_TOMBSTONES, RESOURCE_ENERGY, RESOURCE_HYDROGEN } from '../../src/index.js';
import type { ShardFixture } from '../../src/fixture.js';

describe('Tombstone', () => {
	test('TOMBSTONE-001 killing a creep creates a tombstone with the creep name, death time, and store', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		// 7 ATTACK parts deal 210, past the 2-part victim's 200 hits.
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: body(7, ATTACK, MOVE),
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: [CARRY, MOVE],
			name: 'victim',
			store: { [RESOURCE_HYDROGEN]: 30 },
		});
		await shard.tick();

		// Capture Game.time in the same timing model the engine uses for deathTime
		const attackResult = await shard.runPlayer('p1', code`
			const rc = Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}));
			({ rc, time: Game.time })
		`) as { rc: number; time: number };
		expect(attackResult.rc).toBe(OK);
		expect(await shard.getObject(targetId)).toBeNull();

		// The victim dies on the attack tick; its carried hydrogen stays in the store beside the corpse energy.
		const tombstones = await shard.findInRoom('W1N1', FIND_TOMBSTONES);
		expect(tombstones.map(t => ({ x: t.pos.x, y: t.pos.y, creepName: t.creepName, deathTime: t.deathTime, hydrogen: t.store[RESOURCE_HYDROGEN] })))
			.toEqual([{ x: 25, y: 26, creepName: 'victim', deathTime: attackResult.time, hydrogen: 30 }]);
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

		// The TTL the attack tick reads is the one it dies with.
		const ttl = await shard.runPlayer('p1', code`
			const target = Game.getObjectById(${targetId});
			Game.getObjectById(${attackerId}).attack(target);
			target.ticksToLive
		`) as number;

		// Each part returns its cost at CREEP_CORPSE_RATE, scaled by the life left (_die.js:40-57).
		const lifeRate = CREEP_CORPSE_RATE * ttl / CREEP_LIFE_TIME;
		const bodyEnergy = Math.floor(targetBody.reduce((sum, part) => sum + Math.min(CREEP_PART_MAX_ENERGY, BODYPART_COST[part] * lifeRate), 0));

		const tombstones = await shard.findInRoom('W1N1', FIND_TOMBSTONES);
		expect(tombstones.map(t => ({ creepName: t.creepName, energy: t.store[RESOURCE_ENERGY] })))
			.toEqual([{ creepName: 'carrier', energy: bodyEnergy + carriedEnergy }]);
	});

	test('TOMBSTONE-004 tombstone is removed when ticksToDecay reaches 0', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const tombId = await shard.placeTombstone('W1N1', {
			pos: [25, 25],
			creepName: 'ephemeral',
			ticksToDecay: 3,
		});
		await shard.tick();

		// Removed during the tick that reads 1.
		const readings: (number | null)[] = [];
		for (let i = 0; i < 3; i++) {
			readings.push(await shard.runPlayer('p1', code`
				Game.getObjectById(${tombId})?.ticksToDecay ?? null
			`) as number | null);
		}
		expect(readings).toEqual([2, 1, null]);
	});

	test('TOMBSTONE-005 tombstone ticksToDecay strictly decreases each tick', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const tombId = await shard.placeTombstone('W1N1', {
			pos: [25, 25],
			creepName: 'fading',
			ticksToDecay: 50,
		});
		await shard.tick();

		const t0 = await shard.expectObject(tombId, 'tombstone');
		await shard.tick();
		const t1 = await shard.expectObject(tombId, 'tombstone');
		await shard.tick();
		const t2 = await shard.expectObject(tombId, 'tombstone');

		expect(t1.ticksToDecay).toBe(t0.ticksToDecay - 1);
		expect(t2.ticksToDecay).toBe(t1.ticksToDecay - 1);
	});

	// TOMBSTONE-006..017: deceased-creep field exposure on tombstone.creep.
	// Set up a single natural-death scenario shared across the rows below.
	// The owner-username assertion compares post-death to the live creep's
	// owner.username captured pre-death (both resolve through the engine's
	// user registry, so the value is engine-specific but self-consistent).
	async function killAndReadTombstone(shard: ShardFixture) {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const targetBody = [CARRY, MOVE];
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: body(7, ATTACK, MOVE),
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: targetBody,
			name: 'fallen',
		});
		await shard.tick();
		const live = await shard.runPlayer('p2', code`
			(() => {
				const c = Game.getObjectById(${targetId});
				return { id: c.id, owner: c.owner.username, ttl: c.ticksToLive };
			})()
		`) as { id: string; owner: string; ttl: number };
		await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${targetId}))
		`);
		const tombstones = await shard.findInRoom('W1N1', FIND_TOMBSTONES);
		const tomb = tombstones.find(t => t.creepName === 'fallen');
		expect(tomb).toBeDefined();
		const fields = await shard.runPlayer('p1', code`
			(() => {
				const t = Game.getObjectById(${tomb!.id});
				const c = t.creep;
				const read = (fn) => { try { const v = fn(); return v === undefined ? null : v; } catch (err) { return 'THREW:' + (err && err.message); } };
				return {
					sameId: c.id === t.id,
					creepId: c.id,
					creepName: c.name,
					owner: c.owner.username,
					bodyTypes: c.body.map(part => part.type),
					spawning: read(() => c.spawning),
					my: read(() => c.my),
					ticksToLive: read(() => c.ticksToLive),
					fatigue: read(() => c.fatigue),
					hits: read(() => c.hits),
					hitsMax: read(() => c.hitsMax),
					carryCapacity: read(() => c.carryCapacity),
					storeUsed: read(() => c.store.getUsedCapacity()),
					storeCap: read(() => c.store.getCapacity()),
					carryUsed: read(() => c.carry.getUsedCapacity()),
				};
			})()
		`) as {
			sameId: boolean; creepId: string; creepName: string; owner: string; bodyTypes: string[];
			spawning: unknown; my: unknown; ticksToLive: unknown; fatigue: unknown; hits: unknown;
			hitsMax: unknown; carryCapacity: unknown; storeUsed: unknown; storeCap: unknown; carryUsed: unknown;
		};
		return { tomb: tomb!, targetId, targetBody, live, fields };
	}

	test('TOMBSTONE-006 tombstone.creep.body preserves deceased body part order', async ({ shard }) => {
		const { fields, targetBody } = await killAndReadTombstone(shard);
		expect(fields.bodyTypes).toEqual(targetBody);
	});

	test('TOMBSTONE-007 tombstone.creep.id equals deceased id and differs from tombstone.id', async ({ shard }) => {
		const { fields, tomb, live } = await killAndReadTombstone(shard);
		expect(fields.creepId).toBe(live.id);
		expect(fields.sameId).toBe(false);
		expect(fields.creepId).not.toBe(tomb.id);
	});

	test('TOMBSTONE-008 tombstone.creep.owner.username matches deceased owner', async ({ shard }) => {
		const { fields, live } = await killAndReadTombstone(shard);
		expect(fields.owner).toBe(live.owner);
	});

	test('TOMBSTONE-009 tombstone.creep.name matches deceased name', async ({ shard }) => {
		const { fields } = await killAndReadTombstone(shard);
		expect(fields.creepName).toBe('fallen');
	});

	test('TOMBSTONE-010 tombstone.creep.spawning is false', async ({ shard }) => {
		const { fields } = await killAndReadTombstone(shard);
		expect(fields.spawning).toBe(false);
	});

	test('TOMBSTONE-011 tombstone.creep.my is false for a non-owning observer', async ({ shard }) => {
		const { fields } = await killAndReadTombstone(shard);
		expect(fields.my).toBe(false);
	});

	test('TOMBSTONE-012 tombstone.creep.ticksToLive preserves the deceased creep near-death TTL', async ({ shard }) => {
		const { fields, live } = await killAndReadTombstone(shard);
		// live.ttl was read the tick before the killing blow.
		expect(fields.ticksToLive).toBe(live.ttl - 1);
	});

	test('TOMBSTONE-013 tombstone.creep.fatigue is 0', async ({ shard }) => {
		const { fields } = await killAndReadTombstone(shard);
		expect(fields.fatigue).toBe(0);
	});

	test('TOMBSTONE-014 tombstone.creep.hits is 0', async ({ shard }) => {
		const { fields } = await killAndReadTombstone(shard);
		expect(fields.hits).toBe(0);
	});

	test('TOMBSTONE-015 tombstone.creep.hitsMax equals body.length * BODYPART_HITS', async ({ shard }) => {
		const { fields, targetBody } = await killAndReadTombstone(shard);
		expect(fields.hitsMax).toBe(targetBody.length * BODYPART_HITS);
	});

	test('TOMBSTONE-016 tombstone.creep.carryCapacity equals active CARRY parts times CARRY_CAPACITY', async ({ shard }) => {
		const { fields, targetBody } = await killAndReadTombstone(shard);
		const carryParts = targetBody.filter(part => part === CARRY).length;
		expect(fields.carryCapacity).toBe(carryParts * CARRY_CAPACITY);
	});

	test('TOMBSTONE-017 tombstone.creep.store and carry are an empty store sized to carryCapacity', async ({ shard }) => {
		const { fields, targetBody } = await killAndReadTombstone(shard);
		const carryParts = targetBody.filter(part => part === CARRY).length;
		expect(fields.storeUsed).toBe(0);
		expect(fields.carryUsed).toBe(0);
		expect(fields.storeCap).toBe(carryParts * CARRY_CAPACITY);
	});

	test('TOMBSTONE-018 tombstone.creep.saying exposes the deceased public saying at death', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			name: 'sayer',
		});
		await shard.tick();
		await shard.runPlayer('p1', code`
			(() => {
				const c = Game.getObjectById(${creepId});
				c.say('bye', true);
				c.suicide();
			})()
		`);
		const tombstones = await shard.findInRoom('W1N1', FIND_TOMBSTONES);
		const tomb = tombstones.find(t => t.creepName === 'sayer');
		expect(tomb).toBeDefined();
		const saying = await shard.runPlayer('p1', code`
			(() => {
				try { return Game.getObjectById(${tomb!.id}).creep.saying ?? null; }
				catch (err) { return 'THREW:' + (err && err.message); }
			})()
		`);
		expect(saying).toBe('bye');
	});
});
