import { describe, test, expect, code, OK, CARRY, MOVE, RUIN_DECAY, RUIN_DECAY_STRUCTURES, FIND_RUINS } from '../../src/index.js';

describe('Ruin', () => {
	test('RUIN-001 a ruin exposes structureType, destroyTime, store, and decay timer', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const ruinId = await shard.placeRuin('W1N1', {
			pos: [25, 25],
			structureType: 'container',
			store: { energy: 100 },
			ticksToDecay: 400,
		});
		await shard.tick();

		const ruin = await shard.expectObject(ruinId, 'ruin');
		expect(ruin.structureType).toBe('container');
		expect(typeof ruin.destroyTime).toBe('number');
		expect(ruin.ticksToDecay).toBeGreaterThan(0);
		expect(ruin.store.energy).toBeGreaterThan(0);
	});

	test('RUIN-003 ruin resources can be withdrawn', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const ruinId = await shard.placeRuin('W1N1', {
			pos: [25, 25],
			structureType: 'container',
			store: { energy: 100 },
			ticksToDecay: 400,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [CARRY, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).withdraw(Game.getObjectById(${ruinId}), RESOURCE_ENERGY, 10)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy).toBe(10);
	});
});
