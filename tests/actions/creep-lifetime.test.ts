import { describe, test, expect, code, OK, MOVE, CARRY, CLAIM, STRUCTURE_SPAWN, BODYPART_COST, CREEP_LIFE_TIME, CREEP_CLAIM_LIFE_TIME, CREEP_SPAWN_TIME } from '../../src/index.js';

describe('creep lifetime', () => {
	test('CREEP-LIFETIME-001 ticksToLive decrements by 1 each tick', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE],
		});
		await shard.tick();

		// Observe via getObject (no tick consumed) for tick-precise comparison
		const snap1 = await shard.expectObject(id, 'creep');
		const ttl1 = snap1.ticksToLive;
		await shard.tick();
		const snap2 = await shard.expectObject(id, 'creep');
		const ttl2 = snap2.ticksToLive;

		expect(typeof ttl1).toBe('number');
		expect(typeof ttl2).toBe('number');
		expect(ttl2).toBe(ttl1 - 1);
	});

	test('CREEP-LIFETIME-002 creep without CLAIM starts with CREEP_LIFE_TIME ticksToLive', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// Spawn a non-CLAIM creep through the real spawning pipeline
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: BODYPART_COST[MOVE] },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([MOVE], 'NoClaim')
		`);
		expect(rc).toBe(OK);

		// Wait for spawning to complete: 1 body part * CREEP_SPAWN_TIME
		await shard.tick(CREEP_SPAWN_TIME + 1);

		const ttl = await shard.runPlayer('p1', code`
			const c = Game.creeps['NoClaim'];
			c && !c.spawning ? c.ticksToLive : null
		`) as number | null;
		expect(ttl).not.toBeNull();
		// TTL should be near CREEP_LIFE_TIME, minus a few ticks of aging
		expect(ttl!).toBeGreaterThanOrEqual(CREEP_LIFE_TIME - CREEP_SPAWN_TIME - 2);
		expect(ttl!).toBeLessThanOrEqual(CREEP_LIFE_TIME);
	});

	test('CREEP-LIFETIME-003 creep with CLAIM part starts with CREEP_CLAIM_LIFE_TIME ticksToLive', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// Spawn a CLAIM creep through the real spawning pipeline
		const cost = BODYPART_COST[CLAIM] + BODYPART_COST[MOVE];
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: cost },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([CLAIM, MOVE], 'ClaimCreep')
		`);
		expect(rc).toBe(OK);

		// Wait for spawning to complete: 2 body parts * CREEP_SPAWN_TIME
		await shard.tick(2 * CREEP_SPAWN_TIME + 1);

		const ttl = await shard.runPlayer('p1', code`
			const c = Game.creeps['ClaimCreep'];
			c && !c.spawning ? c.ticksToLive : null
		`) as number | null;
		expect(ttl).not.toBeNull();
		// TTL should be near CREEP_CLAIM_LIFE_TIME, minus a few ticks of aging
		expect(ttl!).toBeGreaterThanOrEqual(CREEP_CLAIM_LIFE_TIME - 2 * CREEP_SPAWN_TIME - 2);
		expect(ttl!).toBeLessThanOrEqual(CREEP_CLAIM_LIFE_TIME);
	});
});
