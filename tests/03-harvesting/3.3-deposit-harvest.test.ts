import { describe, test, expect, code,
	OK, ERR_NOT_IN_RANGE, ERR_TIRED,
	WORK, CARRY, MOVE, body,
	FIND_DROPPED_RESOURCES, CARRY_CAPACITY, ENERGY_DECAY,
	RESOURCE_SILICON, RESOURCE_METAL, STRUCTURE_CONTAINER,
} from '../../src/index.js';
import { depositHarvestValidationCases } from '../../src/matrices/deposit-harvest-validation.js';
import { spawnBusyCreep } from '../intent-validation-helpers.js';

// Deposit lifecycle tests (DEPOSIT-001 through DEPOSIT-006) that were previously
// mislabeled as DEPOSIT-HARVEST-* have been relabeled to their correct section 17.5
// catalog IDs. They remain in this file pending consolidation with
// tests/17-source-mineral-deposit/17.5-deposit.test.ts.

describe('deposit lifecycle (section 17.5)', () => {
	test('DEPOSIT-005 repeated harvests increase lastCooldown', async ({ shard }) => {
		shard.requires('deposit');
		await shard.ownedRoom('p1');
		const depositId = await shard.placeObject('W1N1', 'deposit', {
			pos: [25, 26], depositType: RESOURCE_SILICON,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: body(10, WORK, CARRY, MOVE),
		});
		await shard.tick();

		const rc1 = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${depositId}))
		`);
		expect(rc1).toBe(OK);
		await shard.tick();

		const deposit1 = await shard.runPlayer('p1', code`
			({ lastCooldown: Game.getObjectById(${depositId}).lastCooldown })
		`) as { lastCooldown: number };
		expect(deposit1.lastCooldown).toBeGreaterThanOrEqual(1);

		for (let i = 0; i < 50; i++) await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${depositId}))
		`);
		await shard.tick();

		const deposit2 = await shard.runPlayer('p1', code`
			({ lastCooldown: Game.getObjectById(${depositId}).lastCooldown })
		`) as { lastCooldown: number };
		expect(deposit2.lastCooldown).toBeGreaterThanOrEqual(deposit1.lastCooldown);
	});

	test('DEPOSIT-001 deposit exposes canonical depositType values', async ({ shard }) => {
		shard.requires('deposit');
		await shard.ownedRoom('p1');
		const siliconId = await shard.placeObject('W1N1', 'deposit', {
			pos: [10, 10], depositType: RESOURCE_SILICON,
		});
		const metalId = await shard.placeObject('W1N1', 'deposit', {
			pos: [20, 10], depositType: RESOURCE_METAL,
		});
		await shard.tick();

		const types = await shard.runPlayer('p1', code`
			({
				silicon: Game.getObjectById(${siliconId}).depositType,
				metal: Game.getObjectById(${metalId}).depositType,
			})
		`) as { silicon: string; metal: string };

		expect(types.silicon).toBe(RESOURCE_SILICON);
		expect(types.metal).toBe(RESOURCE_METAL);
	});

	test('DEPOSIT-004 harvest refreshes ticksToDecay to DEPOSIT_DECAY_TIME', async ({ shard }) => {
		shard.requires('deposit');
		await shard.ownedRoom('p1');
		const depositId = await shard.placeObject('W1N1', 'deposit', {
			pos: [25, 26], depositType: RESOURCE_SILICON, decayTime: 100,
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
		expect(before.ticksToDecay).toBeLessThan(200);

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${depositId}))
		`);
		await shard.tick();

		const after = await shard.runPlayer('p1', code`
			({ ticksToDecay: Game.getObjectById(${depositId}).ticksToDecay })
		`) as { ticksToDecay: number };
		expect(typeof after.ticksToDecay).toBe('number');
		expect(after.ticksToDecay).toBeGreaterThan(49990);
		expect(after.ticksToDecay).toBeLessThanOrEqual(50000);
	});

	test('DEPOSIT-003 lastCooldown reflects the most recent cooldown value', async ({ shard }) => {
		shard.requires('deposit');
		await shard.ownedRoom('p1');
		const depositId = await shard.placeObject('W1N1', 'deposit', {
			pos: [25, 26], depositType: RESOURCE_SILICON,
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
		expect(after.cooldown).toBeGreaterThanOrEqual(after.lastCooldown - 1);
	});

	test('DEPOSIT-006 deposit disappears when the decay timer expires', async ({ shard }) => {
		shard.requires('deposit');
		await shard.ownedRoom('p1');
		const depositId = await shard.placeObject('W1N1', 'deposit', {
			pos: [25, 26], depositType: RESOURCE_SILICON, decayTime: 5,
		});
		await shard.tick();

		const armed = await shard.runPlayer('p1', code`
			const d = Game.getObjectById(${depositId});
			({ exists: d !== null, ticksToDecay: d ? d.ticksToDecay : null })
		`) as { exists: boolean; ticksToDecay: number | null };
		expect(armed.exists).toBe(true);
		expect(typeof armed.ticksToDecay).toBe('number');
		expect(armed.ticksToDecay!).toBeLessThan(10);

		for (let i = 0; i < (armed.ticksToDecay! + 3); i++) await shard.tick();

		const gone = await shard.runPlayer('p1', code`
			(Game.getObjectById(${depositId}) == null)
		`) as boolean;
		expect(gone).toBe(true);
	});
});

describe('creep.harvest(deposit)', () => {
	test('DEPOSIT-HARVEST-001 harvest(deposit) adds HARVEST_DEPOSIT_POWER per WORK to creep store', async ({ shard }) => {
		shard.requires('deposit');
		await shard.ownedRoom('p1');
		const depositId = await shard.placeObject('W1N1', 'deposit', {
			pos: [25, 26], depositType: RESOURCE_SILICON,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: body(3, WORK, CARRY, MOVE),
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${depositId}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		// HARVEST_DEPOSIT_POWER = 1 per WORK part; 3 WORK = 3 silicon.
		expect((creep.store as Record<string, number>)[RESOURCE_SILICON]).toBe(3);
	});

	test('DEPOSIT-HARVEST-002 harvest(deposit) returns ERR_NOT_IN_RANGE when not adjacent', async ({ shard }) => {
		shard.requires('deposit');
		await shard.ownedRoom('p1');
		const depositId = await shard.placeObject('W1N1', 'deposit', {
			pos: [25, 26], depositType: RESOURCE_SILICON,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [10, 10], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${depositId}))
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});

	test('DEPOSIT-HARVEST-003 harvest(deposit) returns ERR_TIRED during deposit cooldown', async ({ shard }) => {
		shard.requires('deposit');
		await shard.ownedRoom('p1');
		// Pre-seed deposit with active cooldown (10 ticks into the future).
		const depositId = await shard.placeObject('W1N1', 'deposit', {
			pos: [25, 26], depositType: RESOURCE_SILICON, cooldownTime: 10,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${depositId}))
		`);
		expect(rc).toBe(ERR_TIRED);
	});

	test('DEPOSIT-HARVEST-004 harvest(deposit) returns OK when preconditions met', async ({ shard }) => {
		shard.requires('deposit');
		await shard.ownedRoom('p1');
		const depositId = await shard.placeObject('W1N1', 'deposit', {
			pos: [25, 26], depositType: RESOURCE_METAL,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${depositId}))
		`);
		expect(rc).toBe(OK);
	});

	test('DEPOSIT-HARVEST-005 harvest(deposit) overflows resource when exceeding carry capacity', async ({ shard }) => {
		shard.requires('deposit');
		await shard.ownedRoom('p1');
		const depositId = await shard.placeObject('W1N1', 'deposit', {
			pos: [25, 26], depositType: RESOURCE_SILICON,
		});
		// 10 WORK = 10 silicon/tick, 1 CARRY (50 cap) pre-loaded with 45 energy → 5 free.
		// Overflow = 10 - 5 = 5. In-tick decay reduces by ceil(5/ENERGY_DECAY) = 1.
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: body(10, WORK, CARRY, MOVE),
			store: { energy: 45 },
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${depositId}))
		`);

		const creep = await shard.expectObject(creepId, 'creep');
		const totalStored = (creep.store.energy ?? 0) +
			((creep.store as Record<string, number>)[RESOURCE_SILICON] ?? 0);
		expect(totalStored).toBe(CARRY_CAPACITY);

		const drops = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		const pile = drops.find(r => r.pos.x === 25 && r.pos.y === 25 && r.resourceType === RESOURCE_SILICON);
		expect(pile).toBeDefined();
		const overflow = 10 - 5;
		expect(pile!.amount).toBe(overflow - Math.ceil(overflow / ENERGY_DECAY));
	});

	for (const row of depositHarvestValidationCases) {
		test(`DEPOSIT-HARVEST-006:${row.label} harvest(deposit) validation returns the canonical code`, async ({ shard }) => {
			shard.requires('deposit');
			const blockers = new Set(row.blockers);
			const owner = blockers.has('not-owner') ? 'p2' : 'p1';
			if (owner === 'p2') {
				await shard.createShard({
					players: ['p1', 'p2'],
					rooms: [{ name: 'W1N1', rcl: 1, owner: blockers.has('busy') ? 'p2' : 'p1' }],
				});
				if (!blockers.has('busy')) {
					await shard.placeCreep('W1N1', { pos: [20, 20], owner: 'p1', body: [MOVE] });
				}
			} else {
				await shard.ownedRoom('p1');
			}

			const creepId = blockers.has('busy')
				? await spawnBusyCreep(shard, {
					owner,
					observerOwner: owner === 'p2' ? 'p1' : undefined,
					body: blockers.has('no-bodypart') ? [CARRY, MOVE] : [WORK, CARRY, MOVE],
				})
				: await shard.placeCreep('W1N1', {
					pos: [25, 25],
					owner,
					body: blockers.has('no-bodypart') ? [CARRY, MOVE] : [WORK, CARRY, MOVE],
				});
			const targetId = blockers.has('invalid-target')
				? await shard.placeStructure('W1N1', {
					pos: blockers.has('range') ? [30, 30] : [25, 26],
					structureType: STRUCTURE_CONTAINER,
					store: { energy: 50 },
				})
				: await shard.placeObject('W1N1', 'deposit', {
					pos: blockers.has('range') ? [30, 30] : [25, 26],
					depositType: RESOURCE_SILICON,
					...(blockers.has('cooldown') ? { cooldownTime: 10 } : {}),
				});

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${creepId}).harvest(Game.getObjectById(${targetId}))
			`);
			expect(rc).toBe(row.expectedRc);
		});
	}
});
