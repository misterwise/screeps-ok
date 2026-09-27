import { describe, test, expect, code,
	SOURCE_ENERGY_CAPACITY, SOURCE_ENERGY_NEUTRAL_CAPACITY, ENERGY_REGEN_TIME, HARVEST_POWER,
	OK, CLAIM, MOVE, WORK, CARRY, FIND_STRUCTURES, body,
} from '../../src/index.js';
import { sourceRegenCases } from '../../src/matrices/source-regen.js';

describe('source regeneration', () => {
	test('SOURCE-REGEN-002 depleted source regenerates to full capacity after ENERGY_REGEN_TIME ticks', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 25],
			energy: 0,
			energyCapacity: SOURCE_ENERGY_CAPACITY,
			ticksToRegeneration: ENERGY_REGEN_TIME,
		});

		// Depleted a tick before the timer runs out, full on the tick it does.
		await shard.tick(ENERGY_REGEN_TIME - 1);
		expect((await shard.expectObject(srcId, 'source')).energy).toBe(0);
		await shard.tick();
		expect((await shard.expectObject(srcId, 'source')).energy).toBe(SOURCE_ENERGY_CAPACITY);
	}, 120000);

	// Each state is reached the way a player reaches it, with the capacity read before and after.
	for (const { label, roomState, expectedCapacity } of sourceRegenCases) {
		test(`SOURCE-REGEN-001:${label} a source in a ${label} room takes capacity ${expectedCapacity}`, async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }, { name: 'W2N1', ...roomState === 'keeper' && { controller: false } }],
			});
			const srcId = await shard.placeSource('W2N1', { pos: [25, 25] });
			// Five CLAIM parts reserve for five ticks (CONTROLLER_RESERVE each); one claims.
			const creepId = await shard.placeCreep('W2N1', {
				pos: [2, 2], owner: 'p1', body: roomState === 'keeper' ? [MOVE] : body(5, CLAIM, MOVE),
			});
			await shard.tick();
			const capacity = async () => (await shard.expectObject(srcId, 'source')).energyCapacity;
			if (roomState === 'keeper') {
				// After a tick the capacity is the engine's: vanilla's source tick sets it
				// from the room every tick (sources/tick.js:57-58), and xxscreeps places a
				// source at its room-status hook's value.
				expect(await capacity()).toBe(expectedCapacity);
				return;
			}
			expect(await capacity()).toBe(SOURCE_ENERGY_NEUTRAL_CAPACITY);

			const verb = roomState === 'owned' ? 'claimController' : 'reserveController';
			expect(await shard.runPlayer('p1', code`
				Game.getObjectById(${creepId})[${verb}](Game.rooms.W2N1.controller)
			`)).toBe(OK);
			await shard.tick();
			if (roomState === 'neutral') {
				expect(await capacity()).toBe(SOURCE_ENERGY_CAPACITY);
				// The reservation lapses with no creep renewing it.
				await shard.tick(10);
				expect((await shard.expectStructure((await shard.findInRoom('W2N1', FIND_STRUCTURES))[0].id, 'controller')).reservation).toBeNull();
			}
			expect(await capacity()).toBe(expectedCapacity);
		});
	}

	test('SOURCE-REGEN-003 a source drained below full capacity exposes ticksToRegeneration', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 25],
			energy: SOURCE_ENERGY_CAPACITY,
			energyCapacity: SOURCE_ENERGY_CAPACITY,
		});
		const harvesterId = await shard.placeCreep('W1N1', { pos: [25, 26], owner: 'p1', body: [WORK, CARRY, MOVE] });
		expect((await shard.expectObject(srcId, 'source')).ticksToRegeneration).toBeNull();

		// The harvest's tick starts the timer (sources/tick.js:12-15).
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${harvesterId}).harvest(Game.getObjectById(${srcId}))
		`);
		expect(rc).toBe(OK);
		const src = await shard.expectObject(srcId, 'source');
		expect([src.energy, src.ticksToRegeneration]).toEqual([SOURCE_ENERGY_CAPACITY - HARVEST_POWER, ENERGY_REGEN_TIME - 1]);
	});

	test('SOURCE-REGEN-004 ticksToRegeneration decreases by 1 each tick', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 25],
			energy: 0,
			energyCapacity: SOURCE_ENERGY_CAPACITY,
			ticksToRegeneration: ENERGY_REGEN_TIME,
		});
		await shard.tick();

		const before = await shard.expectObject(srcId, 'source');
		const ttrBefore = before.ticksToRegeneration;
		expect(ttrBefore).toBeGreaterThan(0);

		await shard.tick(3);

		const after = await shard.expectObject(srcId, 'source');
		expect(after.ticksToRegeneration).toBe(ttrBefore! - 3);
	});

	test('SOURCE-REGEN-005 a source at full capacity has no active regeneration timer', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 25],
			energy: SOURCE_ENERGY_CAPACITY,
			energyCapacity: SOURCE_ENERGY_CAPACITY,
		});
		await shard.tick();

		const isUndefined = await shard.runPlayer('p1', code`
			const src = Game.getObjectById(${srcId});
			src.ticksToRegeneration === undefined
		`);
		expect(isUndefined).toBe(true);
	});

	test('SOURCE-REGEN-006 after a room is claimed, the next regeneration refills its source to the new capacity', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1' },
			],
		});
		// A drained neutral source, a few ticks from regenerating.
		const ticksToRegeneration = 5;
		const srcId = await shard.placeSource('W2N1', {
			pos: [10, 10],
			energy: 0,
			energyCapacity: SOURCE_ENERGY_NEUTRAL_CAPACITY,
			ticksToRegeneration,
		});
		const ctrlPos = (await shard.getControllerPos('W2N1'))!;
		const claimerId = await shard.placeCreep('W2N1', {
			pos: [ctrlPos.x + 1, ctrlPos.y], owner: 'p1',
			body: [CLAIM, MOVE],
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${claimerId}).claimController(Game.rooms['W2N1'].controller)
		`);
		expect(rc).toBe(OK);
		await shard.tick(ticksToRegeneration - 1);
		expect((await shard.expectObject(srcId, 'source')).energy).toBe(SOURCE_ENERGY_CAPACITY);
	});
});
