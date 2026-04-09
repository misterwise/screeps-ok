import { describe, test, expect, code,
	OK, ERR_NOT_IN_RANGE, ERR_INVALID_ARGS, ERR_RCL_NOT_ENOUGH, ERR_NOT_OWNER,
	STRUCTURE_OBSERVER,
	OBSERVER_RANGE,
	PWR_OPERATE_OBSERVER,
} from '../../src/index.js';
import { requireCapability } from '../support/policy.js';
import { knownParityGap } from '../support/parity-gaps.js';

describe('StructureObserver', () => {
	knownParityGap('observer-room-always-visible')('OBSERVER-001 observeRoom returns OK and makes the target room visible on the next tick', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'observer');
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

	test('OBSERVER-002 observeRoom returns ERR_NOT_IN_RANGE for a room beyond OBSERVER_RANGE', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'observer');
		await shard.ownedRoom('p1', 'W1N1', 8);
		const obsId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_OBSERVER, owner: 'p1',
		});
		await shard.tick();

		// W1N1 to W12N1 is 11 rooms apart (> OBSERVER_RANGE of 10).
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${obsId}).observeRoom('W12N1')
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});

	test('OBSERVER-004 observeRoom returns ERR_INVALID_ARGS for an invalid room name', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'observer');
		await shard.ownedRoom('p1', 'W1N1', 8);
		const obsId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_OBSERVER, owner: 'p1',
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${obsId}).observeRoom('not_a_room')
		`);
		expect(rc).toBe(ERR_INVALID_ARGS);
	});

	test('OBSERVER-005 observeRoom returns ERR_RCL_NOT_ENOUGH when observer is inactive', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'observer');
		// Observer requires RCL 8. Place one at RCL 7 — it should be inactive.
		await shard.ownedRoom('p1', 'W1N1', 7);
		const obsId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_OBSERVER, owner: 'p1',
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${obsId}).observeRoom('W2N1')
		`);
		expect(rc).toBe(ERR_RCL_NOT_ENOUGH);
	});

	knownParityGap('observer-not-owner-precedence')('OBSERVER-006 observeRoom returns ERR_NOT_OWNER when observer is not owned by the player', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'observer');
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 8, owner: 'p1' },
				{ name: 'W2N1', rcl: 8, owner: 'p2' },
			],
		});
		// Observer owned by p2 in p1's room.
		const obsId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_OBSERVER, owner: 'p2',
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${obsId}).observeRoom('W2N1')
		`);
		expect(rc).toBe(ERR_NOT_OWNER);
	});

	test('OBSERVER-003 observeRoom with PWR_OPERATE_OBSERVER ignores OBSERVER_RANGE limit', async ({ shard, skip }) => {
		requireCapability(shard, skip, 'powerCreeps');
		requireCapability(shard, skip, 'observer');
		// W1N1 to W12N1 is 11 rooms apart — beyond OBSERVER_RANGE (10).
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 8, owner: 'p1' },
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
});
