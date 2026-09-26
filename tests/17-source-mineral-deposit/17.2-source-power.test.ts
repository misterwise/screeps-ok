import { describe, test, expect, code,
	OK,
	PWR_REGEN_SOURCE, PWR_DISRUPT_SOURCE, PWR_REGEN_MINERAL, RESOURCE_HYDROGEN,
} from '../../src/index.js';
import type { ShardFixture } from '../../src/fixture.js';
import { sourcePowerCases } from '../../src/matrices/source-power.js';
import { mineralPowerCases } from '../../src/matrices/mineral-power.js';

// Catalog row suffixes are letters only.
const LEVEL_WORDS = ['One', 'Two', 'Three', 'Four', 'Five'];

// Reads around the first two pulses; the first lands period - 1 ticks after the use tick.
async function readPulses(shard: ShardFixture, period: number, read: () => Promise<number>) {
	await shard.tick(period - 2);
	const beforeFirst = await read();
	await shard.tick(1);
	const first = await read();
	await shard.tick(period - 1);
	const beforeSecond = await read();
	await shard.tick(1);
	return [beforeFirst, first, beforeSecond, await read()];
}

describe('Source power effects', () => {
	for (const row of sourcePowerCases) {
		const level = row.powerLevel + 1;
		test(`SOURCE-POWER-001:level${LEVEL_WORDS[row.powerLevel]} PWR_REGEN_SOURCE adds its effect once per period`, async ({ shard }) => {
			shard.requires('powerCreeps');
			shard.requires('powerEffects');
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1', powerEnabled: true }],
			});
			const sourceId = await shard.placeSource('W1N1', {
				pos: [25, 25], energy: 0, energyCapacity: 3000,
			});
			await shard.placePowerCreep('W1N1', {
				pos: [25, 26], owner: 'p1',
				powers: { [PWR_REGEN_SOURCE]: level },
			});
			await shard.tick();

			const rc = await shard.runPlayer('p1', code`
				Object.values(Game.powerCreeps)[0].usePower(PWR_REGEN_SOURCE, Game.getObjectById(${sourceId}))
			`);
			expect(rc).toBe(OK);

			const pulses = await readPulses(shard, row.expectedPeriod,
				async () => (await shard.expectObject(sourceId, 'source')).energy);
			const effect = row.expectedEffect;
			expect(pulses).toEqual([0, effect, effect, 2 * effect]);
		});
	}

	test('SOURCE-POWER-002 PWR_DISRUPT_SOURCE holds the regeneration timer while active', async ({ shard }) => {
		shard.requires('powerCreeps');
		shard.requires('powerEffects');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1', powerEnabled: true }],
		});
		const sourceId = await shard.placeSource('W1N1', {
			pos: [25, 25], energy: 0, energyCapacity: 3000, ticksToRegeneration: 10,
		});
		await shard.placePowerCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			powers: { [PWR_DISRUPT_SOURCE]: 1 },
			store: { ops: 200 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Object.values(Game.powerCreeps)[0].usePower(PWR_DISRUPT_SOURCE, Game.getObjectById(${sourceId}))
		`);
		expect(rc).toBe(OK);
		const held = await shard.expectObject(sourceId, 'source');
		expect({ energy: held.energy, ticksToRegeneration: held.ticksToRegeneration })
			.toEqual({ energy: 0, ticksToRegeneration: 9 });

		// Well past the seeded regeneration tick, inside the 100-tick effect.
		await shard.tick(20);
		const later = await shard.expectObject(sourceId, 'source');
		expect({ energy: later.energy, ticksToRegeneration: later.ticksToRegeneration })
			.toEqual({ energy: 0, ticksToRegeneration: 9 });
	});
});

describe('Mineral power effects', () => {
	for (const row of mineralPowerCases) {
		const level = row.powerLevel + 1;
		test(`MINERAL-POWER-001:level${LEVEL_WORDS[row.powerLevel]} PWR_REGEN_MINERAL adds its effect once per period`, async ({ shard }) => {
			shard.requires('powerCreeps');
			shard.requires('powerEffects');
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1', powerEnabled: true }],
			});
			// The power only pulses on a mineral with amount left and no regeneration timer.
			const mineralId = await shard.placeMineral('W1N1', {
				pos: [25, 25], mineralType: RESOURCE_HYDROGEN, mineralAmount: 1000,
			});
			await shard.placePowerCreep('W1N1', {
				pos: [25, 26], owner: 'p1',
				powers: { [PWR_REGEN_MINERAL]: level },
			});
			await shard.tick();

			const rc = await shard.runPlayer('p1', code`
				Object.values(Game.powerCreeps)[0].usePower(PWR_REGEN_MINERAL, Game.getObjectById(${mineralId}))
			`);
			expect(rc).toBe(OK);

			const pulses = await readPulses(shard, row.expectedPeriod,
				async () => (await shard.expectObject(mineralId, 'mineral')).mineralAmount);
			const effect = row.expectedEffect;
			expect(pulses).toEqual([1000, 1000 + effect, 1000 + effect, 1000 + 2 * effect]);
		});
	}
});
