import { describe, test, expect, code,
	MOVE,
	FIND_MY_CREEPS, FIND_SOURCES,
	LOOK_CREEPS, LOOK_STRUCTURES,
} from '../../src/index.js';

describe('RoomPosition basics', () => {
	test('ROOMPOS-001 RoomPosition exposes x, y, and roomName', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const pos = new RoomPosition(10, 20, 'W1N1');
			({ x: pos.x, y: pos.y, roomName: pos.roomName })
		`) as { x: number; y: number; roomName: string };

		expect(result).toEqual({ x: 10, y: 20, roomName: 'W1N1' });
	});
});

describe('RoomPosition find helpers', () => {
	test('ROOMPOS-FIND-001 findClosestByPath() returns a target already on the same tile before considering other targets', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeSource('W1N1', { pos: [25, 25] });
		await shard.placeSource('W1N1', { pos: [30, 30] });
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const source = new RoomPosition(25, 25, 'W1N1').findClosestByPath(FIND_SOURCES);
			source ? ({ x: source.pos.x, y: source.pos.y }) : null
		`) as { x: number; y: number } | null;

		expect(result).toEqual({ x: 25, y: 25 });
	});

	test('ROOMPOS-FIND-004 findInRange() returns all matching objects within the given range', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE], name: 'NearA',
		});
		await shard.placeCreep('W1N1', {
			pos: [27, 25], owner: 'p1', body: [MOVE], name: 'NearB',
		});
		await shard.placeCreep('W1N1', {
			pos: [40, 40], owner: 'p1', body: [MOVE], name: 'Far',
		});
		await shard.tick();

		const names = await shard.runPlayer('p1', code`
			new RoomPosition(25, 25, 'W1N1')
				.findInRange(FIND_MY_CREEPS, 2)
				.map(c => c.name)
				.sort()
		`) as string[];

		expect(names).toEqual(['NearA', 'NearB']);
	});
});

describe('Room look APIs', () => {
	test('ROOMPOS-LOOK-002 lookForAt(type, x, y) returns only entries of the requested LOOK_* type at that position', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE], name: 'LookTest',
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			({
				creeps: Game.rooms['W1N1'].lookForAt(LOOK_CREEPS, 25, 25).map(c => c.name),
				structures: Game.rooms['W1N1'].lookForAt(LOOK_STRUCTURES, 25, 25).length,
			})
		`) as { creeps: string[]; structures: number };

		expect(result.creeps).toEqual(['LookTest']);
		expect(result.structures).toBe(0);
	});
});
