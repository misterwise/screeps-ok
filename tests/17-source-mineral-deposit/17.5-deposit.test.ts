import { describe, test, expect, code,
	OK, WORK, CARRY, MOVE, body,
	RESOURCE_SILICON,
	DEPOSIT_DECAY_TIME, DEPOSIT_EXHAUST_MULTIPLY, DEPOSIT_EXHAUST_POW,
} from '../../src/index.js';
import { depositTypeCases } from '../../src/matrices/deposit-type.js';
import type { DepositSpec } from '../../src/adapter.js';
import type { ShardFixture } from '../../src/fixture.js';

// Same operation order as the engine, so the float rounds identically.
const exhaustCooldown = (harvested: number) =>
	Math.ceil(DEPOSIT_EXHAUST_MULTIPLY * Math.pow(harvested, DEPOSIT_EXHAUST_POW));

// 10 WORK harvests 10 per use. From a seeded 1195 the first harvest lands on
// 1205 (cooldown 5) and the second on 1215, across the boundary to 6.
const SEEDED_HARVESTED = 1195;
const WORK_PARTS = 10;

async function placeHarvestedDeposit(shard: ShardFixture, extra: Partial<DepositSpec> = {}) {
	await shard.ownedRoom('p1');
	const depositId = await shard.placeObject('W1N1', 'deposit', {
		pos: [25, 26], depositType: RESOURCE_SILICON, harvested: SEEDED_HARVESTED, ...extra,
	});
	const creepId = await shard.placeCreep('W1N1', {
		pos: [25, 25], owner: 'p1', body: body(WORK_PARTS, WORK, CARRY, MOVE),
	});
	await shard.tick();
	return { depositId, creepId };
}

describe('Deposit lifecycle', () => {
	for (const row of depositTypeCases) {
		test(`DEPOSIT-001:${row.label} deposit exposes the canonical depositType`, async ({ shard }) => {
			shard.requires('deposit');
			await shard.ownedRoom('p1');
			const depositId = await shard.placeObject('W1N1', 'deposit', {
				pos: [25, 25], depositType: row.expectedType,
			});
			await shard.tick();

			const depositType = await shard.runPlayer('p1', code`
				Game.getObjectById(${depositId}).depositType
			`);
			expect(depositType).toBe(row.expectedType);
		});
	}

	test('DEPOSIT-002 deposit lastCooldown matches the exhaust formula for its harvested count', async ({ shard }) => {
		shard.requires('deposit');
		const { depositId, creepId } = await placeHarvestedDeposit(shard);

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${depositId}))
		`);
		expect(rc).toBe(OK);

		const lastCooldown = await shard.runPlayer('p1', code`
			Game.getObjectById(${depositId}).lastCooldown
		`);
		expect(lastCooldown).toBe(exhaustCooldown(SEEDED_HARVESTED + WORK_PARTS));
		expect(lastCooldown).toBe(5);
	});

	test('DEPOSIT-003 deposit cooldown counts down the wait after a harvest and reads 0 once it has elapsed', async ({ shard }) => {
		shard.requires('deposit');
		const { depositId, creepId } = await placeHarvestedDeposit(shard);

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${depositId}))
		`);
		expect(rc).toBe(OK);

		// A 5-tick cooldown anchored on the harvest tick.
		const readings: number[] = [];
		for (let i = 0; i < 5; i++) {
			readings.push(await shard.runPlayer('p1', code`
				Game.getObjectById(${depositId}).cooldown
			`) as number);
		}
		expect(readings).toEqual([4, 3, 2, 1, 0]);
	});

	test('DEPOSIT-004 a harvest restarts ticksToDecay at DEPOSIT_DECAY_TIME and it then decreases by 1 each tick', async ({ shard }) => {
		shard.requires('deposit');
		const { depositId, creepId } = await placeHarvestedDeposit(shard, { ticksToDecay: 100 });

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${depositId}))
		`);
		expect(rc).toBe(OK);

		const readings: number[] = [];
		for (let i = 0; i < 2; i++) {
			readings.push(await shard.runPlayer('p1', code`
				Game.getObjectById(${depositId}).ticksToDecay
			`) as number);
		}
		expect(readings).toEqual([DEPOSIT_DECAY_TIME - 1, DEPOSIT_DECAY_TIME - 2]);
	});

	test('DEPOSIT-005 repeated harvests increase lastCooldown and the next cooldown', async ({ shard }) => {
		shard.requires('deposit');
		const { depositId, creepId } = await placeHarvestedDeposit(shard);

		const first = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${depositId}))
		`);
		expect(first).toBe(OK);
		const afterFirst = await shard.runPlayer('p1', code`
			Game.getObjectById(${depositId}).lastCooldown
		`);
		expect(afterFirst).toBe(5);

		// The 5-tick cooldown reads 0 on the fifth tick after the harvest.
		await shard.tick(3);
		const second = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${depositId}))
		`);
		expect(second).toBe(OK);

		const afterSecond = await shard.runPlayer('p1', code`
			const d = Game.getObjectById(${depositId});
			({ lastCooldown: d.lastCooldown, cooldown: d.cooldown })
		`);
		expect(afterSecond).toEqual({
			lastCooldown: exhaustCooldown(SEEDED_HARVESTED + 2 * WORK_PARTS),
			cooldown: exhaustCooldown(SEEDED_HARVESTED + 2 * WORK_PARTS) - 1,
		});
		expect(afterSecond).toEqual({ lastCooldown: 6, cooldown: 5 });
	});

	test('DEPOSIT-006 deposit is removed when ticksToDecay reaches 0', async ({ shard }) => {
		shard.requires('deposit');
		await shard.ownedRoom('p1');
		const depositId = await shard.placeObject('W1N1', 'deposit', {
			pos: [25, 25], depositType: RESOURCE_SILICON, ticksToDecay: 3,
		});
		await shard.tick();

		// The deposit is removed during the tick that reads 1.
		const readings: (number | null)[] = [];
		for (let i = 0; i < 3; i++) {
			readings.push(await shard.runPlayer('p1', code`
				Game.getObjectById(${depositId})?.ticksToDecay ?? null
			`) as number | null);
		}
		expect(readings).toEqual([2, 1, null]);
	});
});
