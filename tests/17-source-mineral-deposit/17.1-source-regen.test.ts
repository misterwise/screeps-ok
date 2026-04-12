import { describe, test, expect, code,
	SOURCE_ENERGY_CAPACITY, SOURCE_ENERGY_NEUTRAL_CAPACITY,
	OK, CLAIM, MOVE,
} from '../../src/index.js';

describe('source regeneration', () => {
	test('SOURCE-REGEN-002 depleted source regenerates to full capacity after ENERGY_REGEN_TIME ticks', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 25],
			energy: 0,
			energyCapacity: 3000,
			ticksToRegeneration: 300,
		});

		// After 299 ticks, source should still be depleted
		await shard.tick(299);
		const before = await shard.expectObject(srcId, 'source');
		expect(before.energy).toBe(0);

		// On tick 300, source should regenerate
		await shard.tick(1);
		const after = await shard.expectObject(srcId, 'source');
		expect(after.energy).toBe(3000);
	}, 120000);

	test('SOURCE-REGEN-001 source energyCapacity in an owned room equals SOURCE_ENERGY_CAPACITY', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 25],
		});

		const src = await shard.expectObject(srcId, 'source');
		expect(src.energyCapacity).toBe(SOURCE_ENERGY_CAPACITY);
	});

	test('SOURCE-REGEN-003 a source below full capacity exposes ticksToRegeneration', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 25],
			energy: 0,
			energyCapacity: 3000,
			ticksToRegeneration: 300,
		});

		const src = await shard.expectObject(srcId, 'source');
		expect(src.energy).toBe(0);
		expect(src.ticksToRegeneration).toBeGreaterThan(0);
	});

	test('SOURCE-REGEN-004 ticksToRegeneration decreases by 1 each tick', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 25],
			energy: 0,
			energyCapacity: 3000,
			ticksToRegeneration: 300,
		});
		await shard.tick();

		const before = await shard.expectObject(srcId, 'source');
		const ttrBefore = before.ticksToRegeneration;
		expect(ttrBefore).toBeGreaterThan(0);

		await shard.tick(3);

		const after = await shard.expectObject(srcId, 'source');
		expect(after.ticksToRegeneration).toBe(ttrBefore - 3);
	});

	test('SOURCE-REGEN-005 a source at full capacity has no active regeneration timer', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const srcId = await shard.placeSource('W1N1', {
			pos: [25, 25],
			energy: 3000,
			energyCapacity: 3000,
		});
		await shard.tick();

		const isUndefined = await shard.runPlayer('p1', code`
			const src = Game.getObjectById(${srcId});
			src.ticksToRegeneration === undefined
		`);
		expect(isUndefined).toBe(true);
	});

	test('SOURCE-REGEN-006 source capacity updates to owned-room value after claiming the controller', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1' },
			],
		});
		// Place a source in the unowned room with neutral capacity.
		const srcId = await shard.placeSource('W2N1', {
			pos: [10, 10],
			energy: 0,
			energyCapacity: SOURCE_ENERGY_NEUTRAL_CAPACITY,
			ticksToRegeneration: 3,
		});

		// Place a CLAIM creep adjacent to the controller.
		const ctrlPos = await shard.getControllerPos('W2N1');
		const claimerId = await shard.placeCreep('W2N1', {
			pos: [ctrlPos.x + 1, ctrlPos.y], owner: 'p1',
			body: [CLAIM, MOVE],
		});
		await shard.tick();

		// Verify neutral capacity before claiming.
		const beforeCap = await shard.runPlayer('p1', code`
			Game.getObjectById(${srcId}).energyCapacity
		`) as number;
		expect(beforeCap).toBe(SOURCE_ENERGY_NEUTRAL_CAPACITY);

		// Claim the controller.
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${claimerId}).claimController(
				Game.rooms['W2N1'].controller
			)
		`);
		expect(rc).toBe(OK);

		// Source tick processor updates energyCapacity when the controller gains an owner.
		// tick(2): claim resolves + source processor checks controller state.
		await shard.tick(2);

		const afterCap = await shard.runPlayer('p1', code`
			Game.getObjectById(${srcId}).energyCapacity
		`) as number;
		expect(afterCap).toBe(SOURCE_ENERGY_CAPACITY);
	});
});
