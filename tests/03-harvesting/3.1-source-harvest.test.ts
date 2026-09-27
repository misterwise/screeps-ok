import { describe, test, expect, code, body,
	OK, ERR_NOT_IN_RANGE,
	WORK, CARRY, MOVE, CLAIM,
	HARVEST_POWER, CARRY_CAPACITY, ENERGY_DECAY, FIND_DROPPED_RESOURCES,
	RESOURCE_ENERGY, STRUCTURE_CONTAINER,
} from '../../src/index.js';
import type { PlayerCode } from '../../src/index.js';
import { harvestValidationCases } from '../../src/matrices/harvest-validation.js';
import { spawnBusyCreep } from '../intent-validation-helpers.js';

describe('creep.harvest()', () => {
	test('HARVEST-001 harvest deposits HARVEST_POWER energy per WORK part into the creep store', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 26], energy: 3000, energyCapacity: 3000,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${srcId}))
		`);
		expect(rc).toBe(OK);

		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy).toBe(HARVEST_POWER);
	});

	test('HARVEST-009 harvest reduces source energy by the harvested amount', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 26], energy: 3000, energyCapacity: 3000,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${srcId}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const source = await shard.expectObject(srcId, 'source');
		expect(source.energy).toBe(3000 - HARVEST_POWER);
	});

	test('HARVEST-001 multiple WORK parts harvest proportionally', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: body(3, WORK, CARRY, MOVE),
		});
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 26], energy: 3000, energyCapacity: 3000,
		});

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${srcId}))
		`);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy).toBe(3 * HARVEST_POWER);
	});

	test('HARVEST-007 harvest() requires range 1: diagonal-adjacent OK, distance 2 returns ERR_NOT_IN_RANGE', async ({ shard }) => {
		// The exact boundary: diagonal (Chebyshev 1) works, distance 2 fails.
		await shard.ownedRoom('p1');
		const diagCreep = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		const diagSrc = await shard.placeSource('W1N1', {
			pos: [26, 26], energy: 3000, energyCapacity: 3000,
		});
		const farCreep = await shard.placeCreep('W1N1', {
			pos: [30, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		const farSrc = await shard.placeSource('W1N1', {
			pos: [32, 25], energy: 3000, energyCapacity: 3000,
		});

		const result = await shard.runPlayer('p1', code`
			({
				diagonal: Game.getObjectById(${diagCreep}).harvest(Game.getObjectById(${diagSrc})),
				farOrthogonal: Game.getObjectById(${farCreep}).harvest(Game.getObjectById(${farSrc})),
			})
		`) as { diagonal: number; farOrthogonal: number };

		expect(result.diagonal).toBe(OK);
		expect(result.farOrthogonal).toBe(ERR_NOT_IN_RANGE);
	});

	test('HARVEST-008 harvest() returns OK on success', async ({ shard }) => {
		// Contract test: the canonical success return code is exactly OK (0),
		// not some other truthy value. HARVEST-001 uses this indirectly to gate
		// yield assertions; HARVEST-008 isolates the return-code contract.
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 26], energy: 3000, energyCapacity: 3000,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${srcId}))
		`);

		expect(rc).toBe(OK);
		expect(rc).toBe(0);
	});

	test('HARVEST-014 harvest is capped by remaining source energy', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: body(5, WORK, 2, CARRY, MOVE),
		});
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 26], energy: 3, energyCapacity: 3000,
		});

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${srcId}))
		`);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy).toBe(3); // capped at source energy, not 5*2=10

		const source = await shard.expectObject(srcId, 'source');
		expect(source.energy).toBe(0);
	});

	test('HARVEST-005 successful harvest(source) increases store.energy by the harvested amount', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, WORK, CARRY, MOVE],
		});
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 26], energy: 3000, energyCapacity: 3000,
		});

		const storeBefore = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).store.energy
		`) as number;

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${srcId}))
		`);
		expect(rc).toBe(OK);

		const storeAfter = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).store.energy
		`) as number;
		expect(storeAfter).toBe(storeBefore + 2 * HARVEST_POWER);
	});

	test('HARVEST-006 harvest can exceed free carry capacity and drops overflow as a resource', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// 25 WORK = 50 energy/tick, 1 CARRY (50 capacity) with 5 already stored → 45 free.
		// Harvest produces 50, overflow = 5 dropped on the tile.
		// In-tick decay reduces the pile by ceil(5/ENERGY_DECAY) = 1.
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: body(25, WORK, CARRY, MOVE),
			store: { energy: 5 },
		});
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 26], energy: 3000, energyCapacity: 3000,
		});

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${srcId}))
		`);

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy).toBe(CARRY_CAPACITY);

		const source = await shard.expectObject(srcId, 'source');
		expect(source.energy).toBe(3000 - 25 * HARVEST_POWER);

		const drops = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		const pile = drops.find(r => r.pos.x === 25 && r.pos.y === 25);
		expect(pile).toBeDefined();
		expect(pile!.resourceType).toBe(RESOURCE_ENERGY);
		const overflow = 25 * HARVEST_POWER - (CARRY_CAPACITY - 5);
		expect(pile!.amount).toBe(overflow - Math.ceil(overflow / ENERGY_DECAY));
	});

	for (const row of harvestValidationCases) {
		test(`HARVEST-015:${row.label} harvest(source) validation returns the canonical code`, async ({ shard }) => {
			const blockers = new Set(row.blockers);
			const owner = blockers.has('not-owner') ? 'p2' : 'p1';
			const hostileRoom = blockers.has('hostile-room');
			if (blockers.has('hostile-reservation')) {
				// No spec field reserves a room: p2 reserves the neutral W1N1 first.
				await shard.createShard({ players: ['p1', 'p2'], rooms: [{ name: 'W1N1' }] });
				const ctrlPos = await shard.getControllerPos('W1N1');
				await shard.placeCreep('W1N1', {
					pos: [ctrlPos!.x + 1, ctrlPos!.y],
					owner: 'p2',
					body: [CLAIM, CLAIM, CLAIM, CLAIM, CLAIM, MOVE],
					name: 'reserver',
				});
				if (owner === 'p2') {
					await shard.placeCreep('W1N1', { pos: [20, 20], owner: 'p1', body: [MOVE] });
				}
				await shard.tick();
				const reserveRc = await shard.runPlayer('p2', code`
					Game.creeps['reserver'].reserveController(Game.rooms['W1N1'].controller)
				`);
				expect(reserveRc).toBe(OK);
			} else if (owner === 'p2' || hostileRoom) {
				await shard.createShard({
					players: ['p1', 'p2'],
					rooms: [{ name: 'W1N1', rcl: 1, owner: hostileRoom || owner === 'p2' && blockers.has('busy') ? 'p2' : 'p1' }],
				});
				if (hostileRoom || owner === 'p2' && !blockers.has('busy')) {
					await shard.placeCreep('W1N1', {
						pos: [20, 20],
						owner: 'p1',
						body: [MOVE],
					});
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
			let call: PlayerCode;
			if (blockers.has('no-target')) {
				call = code`Game.getObjectById(${creepId}).harvest()`;
			} else if (blockers.has('null-target')) {
				call = code`Game.getObjectById(${creepId}).harvest(null)`;
			} else if (blockers.has('plain-object-target')) {
				call = code`Game.getObjectById(${creepId}).harvest({})`;
			} else {
				const targetId = blockers.has('invalid-target')
					? await shard.placeStructure('W1N1', {
						pos: blockers.has('range') ? [30, 30] : [25, 26],
						structureType: STRUCTURE_CONTAINER,
						store: { energy: 50 },
					})
					: await shard.placeSource('W1N1', {
						pos: blockers.has('range') ? [30, 30] : [25, 26],
						energy: blockers.has('depleted') ? 0 : 3000,
						energyCapacity: 3000,
					});
				call = code`Game.getObjectById(${creepId}).harvest(Game.getObjectById(${targetId}))`;
			}

			const rc = await shard.runPlayer('p1', call);
			expect(rc).toBe(row.expectedRc);
		});
	}
});
