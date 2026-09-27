import { describe, test, expect, code,
	OK,
	WORK, CARRY, MOVE, body,
	FIND_DROPPED_RESOURCES, CARRY_CAPACITY, ENERGY_DECAY,
	RESOURCE_SILICON, RESOURCE_METAL, STRUCTURE_CONTAINER, HARVEST_DEPOSIT_POWER,
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

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store[RESOURCE_SILICON]).toBe(3 * HARVEST_DEPOSIT_POWER);
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
		expect(creep.store).toEqual({ energy: 45, [RESOURCE_SILICON]: CARRY_CAPACITY - 45 });

		const drops = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		const pile = drops.find(r => r.pos.x === 25 && r.pos.y === 25 && r.resourceType === RESOURCE_SILICON);
		expect(pile).toBeDefined();
		const overflow = 10 - 5;
		expect(pile!.amount).toBe(overflow - Math.ceil(overflow / ENERGY_DECAY));
	});

	for (const row of depositHarvestValidationCases) {
		test(`DEPOSIT-HARVEST-006:${row.label} harvest(deposit) validation returns the canonical code`, async ({ shard }) => {
			shard.requires('deposit');
			const blockers = shard.validationBlockers(row);
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
					...(blockers.has('cooldown') ? { cooldown: 10 } : {}),
				});

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${creepId}).harvest(Game.getObjectById(${targetId}))
			`);
			expect(rc).toBe(row.expectedRc);
		});
	}
});
