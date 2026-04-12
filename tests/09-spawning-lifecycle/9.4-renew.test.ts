import { describe, test, expect, code,
	OK, ERR_NOT_ENOUGH_ENERGY, ERR_FULL, ERR_NOT_IN_RANGE, ERR_BUSY,
	ERR_RCL_NOT_ENOUGH,
	MOVE, WORK, CARRY, CLAIM, BODYPART_COST,
	STRUCTURE_SPAWN, CREEP_LIFE_TIME, CREEP_CLAIM_LIFE_TIME, SPAWN_RENEW_RATIO,
} from '../../src/index.js';

describe('Spawn.renewCreep', () => {
	test('RENEW-CREEP-001 renewCreep returns OK and increases creep TTL', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [MOVE],
			ticksToLive: 100,
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const spawn = Game.getObjectById(${spawnId});
			const creep = Game.getObjectById(${creepId});
			spawn.renewCreep(creep)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		// renewCreep adds floor(600 / bodyLength) TTL per tick.
		// Body = [MOVE] → length 1 → +600 TTL. But capped at CREEP_LIFE_TIME.
		// 100 + 600 = 700, under cap.
		expect(creep.ticksToLive).toBeGreaterThan(100);
	});

	test('RENEW-CREEP-002 renewCreep deducts energy from the spawn', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [WORK, CARRY, MOVE],
			ticksToLive: 100,
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const spawn = Game.getObjectById(${spawnId});
			const creep = Game.getObjectById(${creepId});
			spawn.renewCreep(creep)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const spawn = await shard.expectStructure(spawnId, STRUCTURE_SPAWN);
		expect(spawn.store.energy).toBeLessThan(300);
	});

	test('RENEW-CREEP-008 renewCreep returns ERR_NOT_ENOUGH_ENERGY when spawn has insufficient energy', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 0 },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [MOVE],
			ticksToLive: 100,
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const spawn = Game.getObjectById(${spawnId});
			const creep = Game.getObjectById(${creepId});
			spawn.renewCreep(creep)
		`);
		expect(rc).toBe(ERR_NOT_ENOUGH_ENERGY);
	});

	test('RENEW-CREEP-001 renewCreep returns ERR_NOT_IN_RANGE when creep is not adjacent', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 28], owner: 'p1',
			body: [MOVE],
			ticksToLive: 100,
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const spawn = Game.getObjectById(${spawnId});
			const creep = Game.getObjectById(${creepId});
			spawn.renewCreep(creep)
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});

	test('RENEW-CREEP-010 renewCreep returns ERR_FULL when creep is already at CREEP_LIFE_TIME', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [MOVE],
			ticksToLive: CREEP_LIFE_TIME,
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const spawn = Game.getObjectById(${spawnId});
			const creep = Game.getObjectById(${creepId});
			spawn.renewCreep(creep)
		`);
		expect(rc).toBe(ERR_FULL);
	});

	test('RENEW-CREEP-007 renewCreep rejects creeps with any CLAIM body part', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [CLAIM, MOVE],
			ticksToLive: 100,
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const spawn = Game.getObjectById(${spawnId});
			const creep = Game.getObjectById(${creepId});
			spawn.renewCreep(creep)
		`);
		// Vanilla rejects CLAIM creeps from renewal.
		expect(rc).not.toBe(OK);
	});

	test('RENEW-CREEP-009 renewCreep returns ERR_BUSY when the spawn is currently spawning', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [MOVE],
			ticksToLive: 100,
		});

		// Start spawning to make the spawn busy.
		const spawnRc = await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([MOVE], 'Blocker')
		`);
		expect(spawnRc).toBe(OK);
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const spawn = Game.getObjectById(${spawnId});
			const creep = Game.getObjectById(${creepId});
			spawn.renewCreep(creep)
		`);
		expect(rc).toBe(ERR_BUSY);
	});
});
