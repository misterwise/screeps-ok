import { describe, test, expect, code,
	OK,
	WORK, CARRY, MOVE, body,
} from '../../src/index.js';

// All tests in this file exercise Deposit behavior (finite highway resources
// with exponential exhaustion and absolute decay). They are the canonical
// verification against the vanilla engine source in
// node_modules/@screeps/engine/src/game/deposits.js, creeps.js:387-394, and
// processor.js:421-426. The vanilla adapter supports deposits via
// placeObject('deposit', ...) — including a spec.decayTime override needed by
// DEPOSIT-HARVEST-005. xxscreeps does not yet implement deposits and skips
// these tests via shard.requires('deposit').

describe('creep.harvest(deposit)', () => {
	test('DEPOSIT-HARVEST-001 harvest increases lastCooldown along DEPOSIT_EXHAUST_MULTIPLY * harvested^DEPOSIT_EXHAUST_POW', async ({ shard }) => {
		// Engine formula (deposits.js:36):
		//   lastCooldown = ceil(DEPOSIT_EXHAUST_MULTIPLY * pow(harvested, DEPOSIT_EXHAUST_POW))
		//   = ceil(0.001 * pow(harvested, 1.2))
		// With 1 harvest of HARVEST_DEPOSIT_POWER*1 = 1, harvested=1 → ceil(0.001) = 1.
		// Subsequent harvests must compound: the cooldown after harvest N ≥
		// cooldown after harvest N-1 (strictly increasing as harvested grows).
		shard.requires('deposit');
		await shard.ownedRoom('p1');
		const depositId = await shard.placeObject('W1N1', 'deposit', {
			pos: [25, 26], depositType: 'silicon',
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: body(10, WORK, CARRY, MOVE),
		});
		await shard.tick();

		// First harvest: lastCooldown must be ≥ 1 (per ceil() on any positive value).
		const rc1 = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${depositId}))
		`);
		expect(rc1).toBe(OK);
		await shard.tick();

		const deposit1 = await shard.runPlayer('p1', code`
			({ lastCooldown: Game.getObjectById(${depositId}).lastCooldown })
		`) as { lastCooldown: number };
		expect(deposit1.lastCooldown).toBeGreaterThanOrEqual(1);

		// Wait for cooldown to expire so we can harvest again.
		for (let i = 0; i < 50; i++) await shard.tick();

		// Second harvest: lastCooldown must be > first-harvest lastCooldown
		// (since harvested^1.2 is strictly increasing).
		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${depositId}))
		`);
		await shard.tick();

		const deposit2 = await shard.runPlayer('p1', code`
			({ lastCooldown: Game.getObjectById(${depositId}).lastCooldown })
		`) as { lastCooldown: number };
		expect(deposit2.lastCooldown).toBeGreaterThanOrEqual(deposit1.lastCooldown);
	});

	test('DEPOSIT-HARVEST-002 deposit types are silicon, metal, biomass, and mist', async ({ shard }) => {
		// Canonical deposit types per the Screeps API.
		shard.requires('deposit');
		await shard.ownedRoom('p1');
		const siliconId = await shard.placeObject('W1N1', 'deposit', {
			pos: [10, 10], depositType: 'silicon',
		});
		const metalId = await shard.placeObject('W1N1', 'deposit', {
			pos: [20, 10], depositType: 'metal',
		});
		const biomassId = await shard.placeObject('W1N1', 'deposit', {
			pos: [30, 10], depositType: 'biomass',
		});
		const mistId = await shard.placeObject('W1N1', 'deposit', {
			pos: [40, 10], depositType: 'mist',
		});
		await shard.tick();

		const types = await shard.runPlayer('p1', code`
			({
				silicon: Game.getObjectById(${siliconId}).depositType,
				metal: Game.getObjectById(${metalId}).depositType,
				biomass: Game.getObjectById(${biomassId}).depositType,
				mist: Game.getObjectById(${mistId}).depositType,
			})
		`) as { silicon: string; metal: string; biomass: string; mist: string };

		expect(types.silicon).toBe('silicon');
		expect(types.metal).toBe('metal');
		expect(types.biomass).toBe('biomass');
		expect(types.mist).toBe('mist');
	});

	test('DEPOSIT-HARVEST-003 harvest refreshes ticksToDecay to DEPOSIT_DECAY_TIME', async ({ shard }) => {
		// Engine reality (processor.js:421-426): a deposit with a null
		// decayTime is removed on its first processed tick, so the player API
		// never observes ticksToDecay === undefined for a live deposit. A
		// freshly placed deposit always has a positive decayTime (seeded by
		// the world generator on MMO, by the adapter's placeObject here).
		// Each harvest (harvest.js:138) refreshes decayTime to
		// DEPOSIT_DECAY_TIME + gameTime, restoring ticksToDecay to ~50000.
		// This test verifies that refresh: place a deposit with a short
		// decayTime, advance ticks until ticksToDecay drops well below
		// DEPOSIT_DECAY_TIME, harvest once, observe the refresh.
		shard.requires('deposit');
		await shard.ownedRoom('p1');
		// Seed a 100-tick decayTime so we can observe the refresh as a clear jump.
		const depositId = await shard.placeObject('W1N1', 'deposit', {
			pos: [25, 26], depositType: 'silicon', decayTime: 100,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		await shard.tick();

		const before = await shard.runPlayer('p1', code`
			({ ticksToDecay: Game.getObjectById(${depositId}).ticksToDecay })
		`) as { ticksToDecay: number };
		expect(typeof before.ticksToDecay).toBe('number');
		// The seeded decayTime (100) is much smaller than DEPOSIT_DECAY_TIME (50000),
		// so a successful refresh below will be a strict, observable jump.
		expect(before.ticksToDecay).toBeLessThan(200);

		// Harvest once and let the processor register the first-harvest decay timer.
		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${depositId}))
		`);
		await shard.tick();

		const after = await shard.runPlayer('p1', code`
			({ ticksToDecay: Game.getObjectById(${depositId}).ticksToDecay })
		`) as { ticksToDecay: number };
		// After harvest, decayTime is bulk.update(target, {decayTime: DEPOSIT_DECAY_TIME + gameTime})
		// (harvest.js:138). Allow a small slack for the tick we just advanced.
		expect(typeof after.ticksToDecay).toBe('number');
		expect(after.ticksToDecay).toBeGreaterThan(49990);
		expect(after.ticksToDecay).toBeLessThanOrEqual(50000);
	});

	test('DEPOSIT-HARVEST-004 lastCooldown reflects the most recent cooldown value', async ({ shard }) => {
		// `lastCooldown` is the cooldown imposed by the most recent harvest.
		// Before any harvest it is 0; after harvest it equals the cooldown
		// that was started for the current cycle (matches `.cooldown` on the
		// first post-harvest tick, before the countdown elapses).
		shard.requires('deposit');
		await shard.ownedRoom('p1');
		const depositId = await shard.placeObject('W1N1', 'deposit', {
			pos: [25, 26], depositType: 'silicon',
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: body(10, WORK, CARRY, MOVE),
		});
		await shard.tick();

		const before = await shard.runPlayer('p1', code`
			({ lastCooldown: Game.getObjectById(${depositId}).lastCooldown })
		`) as { lastCooldown: number };
		expect(before.lastCooldown).toBe(0);

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${depositId}))
		`);
		await shard.tick();

		const after = await shard.runPlayer('p1', code`
			({
				lastCooldown: Game.getObjectById(${depositId}).lastCooldown,
				cooldown: Game.getObjectById(${depositId}).cooldown,
			})
		`) as { lastCooldown: number; cooldown: number };
		expect(after.lastCooldown).toBeGreaterThanOrEqual(1);
		// `cooldown` should be >= (lastCooldown - 1) on the same tick the cooldown was applied.
		expect(after.cooldown).toBeGreaterThanOrEqual(after.lastCooldown - 1);
	});

	test('DEPOSIT-HARVEST-005 deposit disappears when the decay timer expires', async ({ shard }) => {
		// Engine reality (processor.js:421-426): each tick, the processor
		// removes any deposit where `gameTime >= decayTime - 1`. To exercise
		// the decay path in test time we must (a) seed a short decayTime and
		// (b) NOT harvest, because harvest.js:138 unconditionally refreshes
		// decayTime to DEPOSIT_DECAY_TIME + gameTime (~50000 ticks).
		shard.requires('deposit');
		await shard.ownedRoom('p1');
		const depositId = await shard.placeObject('W1N1', 'deposit', {
			pos: [25, 26], depositType: 'silicon', decayTime: 5,
		});
		await shard.tick();

		// Confirm the deposit is visible with a small ticksToDecay before we wait it out.
		const armed = await shard.runPlayer('p1', code`
			const d = Game.getObjectById(${depositId});
			({ exists: d !== null, ticksToDecay: d ? d.ticksToDecay : null })
		`) as { exists: boolean; ticksToDecay: number | null };
		expect(armed.exists).toBe(true);
		expect(typeof armed.ticksToDecay).toBe('number');
		expect(armed.ticksToDecay!).toBeLessThan(10);

		// Advance well past the seeded decay window (the +1 in the processor's
		// `gameTime >= decayTime - 1` check means a small margin is sufficient).
		for (let i = 0; i < (armed.ticksToDecay! + 3); i++) await shard.tick();

		const gone = await shard.runPlayer('p1', code`
			(Game.getObjectById(${depositId}) == null)
		`) as boolean;
		expect(gone).toBe(true);
	});
});
