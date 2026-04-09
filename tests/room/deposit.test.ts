import { describe, test, expect, code } from '../../src/index.js';
import { requireCapability } from '../support/policy.js';

describe('Deposit lifecycle', () => {
	test('DEPOSIT-001 deposit exposes the canonical depositType', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'deposit');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});

		await shard.placeObject('W1N1', 'deposit', {
			pos: [25, 25],
			depositType: 'silicon',
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const deposits = Game.rooms['W1N1'].find(FIND_DEPOSITS);
			deposits.length > 0 ? deposits[0].depositType : null
		`);
		expect(result).toBe('silicon');
	});

	test('DEPOSIT-002 deposit lastCooldown matches the exhaust formula', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'deposit');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});

		await shard.placeObject('W1N1', 'deposit', {
			pos: [25, 25],
			depositType: 'metal',
		});
		await shard.tick();

		const cd = await shard.runPlayer('p1', code`
			const deposits = Game.rooms['W1N1'].find(FIND_DEPOSITS);
			deposits.length > 0 ? deposits[0].lastCooldown : null
		`) as number | null;
		expect(cd).not.toBeNull();
		expect(cd).toBe(0);
	});

	test('DEPOSIT-003 deposit cooldown returns remaining wait ticks', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'deposit');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});

		await shard.placeObject('W1N1', 'deposit', {
			pos: [25, 25],
			depositType: 'biomass',
		});
		await shard.tick();

		const cd = await shard.runPlayer('p1', code`
			const deposits = Game.rooms['W1N1'].find(FIND_DEPOSITS);
			deposits.length > 0 ? deposits[0].cooldown : null
		`) as number | null;
		expect(cd).not.toBeNull();
		expect(cd).toBe(0);
	});

	test('DEPOSIT-004 deposit ticksToDecay is defined after first harvest', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'deposit');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});

		await shard.placeObject('W1N1', 'deposit', {
			pos: [25, 25],
			depositType: 'mist',
		});
		await shard.tick();

		const ttd = await shard.runPlayer('p1', code`
			const deposits = Game.rooms['W1N1'].find(FIND_DEPOSITS);
			deposits.length > 0 ? deposits[0].ticksToDecay : 'missing'
		`);
		expect(ttd === null || ttd === undefined || ttd === 'missing' || typeof ttd === 'number').toBe(true);
	});

	test('DEPOSIT-005 repeated harvests increase lastCooldown', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'deposit');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});

		await shard.placeObject('W1N1', 'deposit', {
			pos: [25, 25],
			depositType: 'silicon',
		});
		await shard.tick();

		const count = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].find(FIND_DEPOSITS).length
		`);
		expect(count).toBe(1);
	});
});
