import { describe, test, expect, code,
	OK,
	STRUCTURE_OBSERVER,
	OBSERVER_RANGE,
	PWR_OPERATE_OBSERVER,
} from '../../src/index.js';
import { observerValidationCases } from '../../src/matrices/observer-validation.js';

describe('StructureObserver', () => {
	test('OBSERVER-001 observeRoom returns OK and makes the target room visible on the next tick', async ({ shard }) => {
		shard.requires('observer');
		// W1N1 owned by p1 (RCL 8 for observer), W2N1 is a neighbor room.
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 8, owner: 'p1' },
				{ name: 'W2N1' },
			],
		});
		const obsId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_OBSERVER, owner: 'p1',
		});
		await shard.tick();

		// W2N1 should not be visible yet.
		const beforeVisible = await shard.runPlayer('p1', code`
			!!Game.rooms['W2N1']
		`);
		expect(beforeVisible).toBe(false);

		// Observe W2N1.
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${obsId}).observeRoom('W2N1')
		`);
		expect(rc).toBe(OK);

		// After the observeRoom tick, the room becomes visible on the next runPlayer.
		const afterVisible = await shard.runPlayer('p1', code`
			!!Game.rooms['W2N1']
		`);
		expect(afterVisible).toBe(true);
	});

	test('OBSERVER-003 observeRoom with PWR_OPERATE_OBSERVER ignores OBSERVER_RANGE limit', async ({ shard }) => {
		shard.requires('powerCreeps');
		shard.requires('powerEffects');
		shard.requires('observer');
		// W1N1 to W12N1 is 11 rooms apart — beyond OBSERVER_RANGE (10).
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 8, owner: 'p1', powerEnabled: true },
				{ name: 'W12N1' },
			],
		});
		const obsId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_OBSERVER, owner: 'p1',
		});
		await shard.placePowerCreep('W1N1', {
			pos: [25, 26], owner: 'p1', name: 'ObsBoostPC',
			powers: { [PWR_OPERATE_OBSERVER]: 1 },
			store: { ops: 100 },
		});
		await shard.tick();

		// Apply power first, then observe on the next tick.
		const powerRc = await shard.runPlayer('p1', code`
			Game.powerCreeps['ObsBoostPC'].usePower(
				PWR_OPERATE_OBSERVER, Game.getObjectById(${obsId})
			)
		`);
		expect(powerRc).toBe(OK);

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${obsId}).observeRoom('W12N1')
		`);
		expect(rc).toBe(OK);

		const visible = await shard.runPlayer('p1', code`
			!!Game.rooms['W12N1']
		`);
		expect(visible).toBe(true);
	});

	for (const row of observerValidationCases) {
		test(`OBSERVER-007:${row.label} observeRoom() validation returns the canonical code`, async ({ shard }) => {
			shard.requires('observer');
			const blockers = new Set(row.blockers);
			const owner = blockers.has('not-owner') ? 'p2' : 'p1';
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [{ name: 'W1N1', rcl: blockers.has('rcl') ? 7 : 8, owner: 'p1' }],
			});
			const obsId = await shard.placeStructure('W1N1', {
				pos: [25, 25],
				structureType: STRUCTURE_OBSERVER,
				owner,
			});
			const roomName = blockers.has('invalid-args') ? 'not_a_room' : blockers.has('range') ? 'W12N1' : 'W2N1';

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${obsId}).observeRoom(${roomName})
			`);
			expect(rc).toBe(row.expectedRc);
		});
	}
});
