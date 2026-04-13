import { describe, test, expect, code, body,
	OK,
	MOVE, WORK, CARRY, ATTACK, TOUGH,
	BODYPART_HITS, ATTACK_POWER, HARVEST_POWER,
} from '../../src/index.js';

describe('creep body part damage', () => {
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
		expect(target.hits).toBe(3 * BODYPART_HITS - ATTACK_POWER);
		expect(target.body.map(part => part.hits)).toEqual([BODYPART_HITS - ATTACK_POWER, BODYPART_HITS, BODYPART_HITS]);
	});

	test('COMBAT-BODYPART-002 each body part has 100 hits and contributes to hitsMax', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [TOUGH, TOUGH, MOVE],
		});

		const creep = await shard.expectObject(id, 'creep');
		expect(creep.hits).toBe(3 * BODYPART_HITS);
		expect(creep.hitsMax).toBe(3 * BODYPART_HITS);
		expect(creep.body.map(part => part.hits)).toEqual([BODYPART_HITS, BODYPART_HITS, BODYPART_HITS]);
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
		expect(target.hits).toBe(3 * BODYPART_HITS - 4 * ATTACK_POWER);
		expect(target.body.map(part => part.hits)).toEqual([0, 2 * BODYPART_HITS - 4 * ATTACK_POWER, BODYPART_HITS]);

		const activeTough = await shard.runPlayer('p1', code`
			Game.getObjectById(${targetId}).getActiveBodyparts(TOUGH)
		`);
		expect(activeTough).toBe(0);
	});

	test('COMBAT-BODYPART-004 a damaged body part with HP > 0 functions at full effectiveness', async ({ shard }) => {
		// Engine harvest.js:35 (and the `_.filter` pattern in every action
		// processor) counts any WORK part with `hits > 0 || _oldHits > 0` at full
		// HARVEST_POWER. Damage a [WORK, MOVE] harvester so the WORK part sits at
		// ~10 HP and confirm the subsequent harvest yields HARVEST_POWER energy.
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		// Attacker: 3 ATTACK deals 90 damage. Harvester: WORK + CARRY + MOVE (300 HP).
		// After 1 attack: hits 210. Body (recalculated back-to-front):
		//   MOVE=100, CARRY=100, WORK=10 (all still active, WORK partially damaged).
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p2',
			body: body(3, ATTACK, MOVE),
		});
		const harvesterId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 27], energy: 3000, energyCapacity: 3000,
		});
		await shard.tick();

		await shard.runPlayer('p2', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${harvesterId}))
		`);

		// Confirm the WORK part survived but is damaged.
		const damaged = await shard.expectObject(harvesterId, 'creep');
		expect(damaged.hits).toBe(300 - 90);
		expect(damaged.body.map(p => p.hits)).toEqual([10, 100, 100]);

		await shard.runPlayer('p1', code`
			Game.getObjectById(${harvesterId}).harvest(Game.getObjectById(${srcId}))
		`);

		const harvester = await shard.expectObject(harvesterId, 'creep');
		expect(harvester.store.energy).toBe(HARVEST_POWER);
	});
});
