import { describe, test, expect, code,
	OK, ERR_NOT_IN_RANGE, ERR_TIRED,
	WORK, CARRY, MOVE, body,
	FIND_DROPPED_RESOURCES, CARRY_CAPACITY, ENERGY_DECAY,
	RESOURCE_SILICON, RESOURCE_METAL, STRUCTURE_CONTAINER,
} from '../../src/index.js';
import { depositHarvestValidationCases } from '../../src/matrices/deposit-harvest-validation.js';
import { spawnBusyCreep } from '../intent-validation-helpers.js';

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
