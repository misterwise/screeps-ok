import { describe, test, expect, code,
	OK,
	PWR_REGEN_SOURCE, PWR_DISRUPT_SOURCE, PWR_REGEN_MINERAL,
} from '../../src/index.js';

describe('Source power effects', () => {
	test('SOURCE-POWER-001 PWR_REGEN_SOURCE adds energy to a source', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});

		const sourceId = await shard.placeSource('W1N1', {
			pos: [25, 25], energy: 0, energyCapacity: 3000,
		});
		await shard.placePowerCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			powers: { [PWR_REGEN_SOURCE]: 1 },
			store: { ops: 200 },
		});
		await shard.tick();

		// Activate regen source.
		await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			const source = Game.getObjectById(${sourceId});
			pc.usePower(PWR_REGEN_SOURCE, source)
		`);

		// After some ticks, source should have gained energy from regen effect.
		// The effect applies every period ticks. Tick a few times.
		for (let i = 0; i < 15; i++) await shard.tick();

		const energy = await shard.runPlayer('p1', code`
			Game.getObjectById(${sourceId}).energy
		`) as number;
		expect(energy).toBeGreaterThan(0);
	});

	test('SOURCE-POWER-002 PWR_DISRUPT_SOURCE prevents source regeneration', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});

		const sourceId = await shard.placeSource('W1N1', {
			pos: [25, 25], energy: 0, energyCapacity: 3000,
		});
		await shard.placePowerCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			powers: { [PWR_DISRUPT_SOURCE]: 1 },
			store: { ops: 200 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			const source = Game.getObjectById(${sourceId});
			pc.usePower(PWR_DISRUPT_SOURCE, source)
		`);
		expect(rc).toBe(OK);
	});
});

describe('Mineral power effects', () => {
	test('MINERAL-POWER-001 PWR_REGEN_MINERAL adds mineral amount', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});

		const mineralId = await shard.placeMineral('W1N1', {
			pos: [25, 25], mineralType: 'H', mineralAmount: 0,
		});
		await shard.placePowerCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			powers: { [PWR_REGEN_MINERAL]: 1 },
			store: { ops: 200 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			const mineral = Game.getObjectById(${mineralId});
			pc.usePower(PWR_REGEN_MINERAL, mineral)
		`);
		expect(rc).toBe(OK);
	});
});
