import { describe, test, expect, code,
	MOVE,
	FIND_MY_CREEPS, FIND_SOURCES,
	LOOK_CREEPS, LOOK_STRUCTURES,
} from '../../src/index.js';

describe('RoomPosition basics', () => {
	test('ROOMPOS-001 RoomPosition exposes x, y, and roomName, bounded to 0..49', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const pos = new RoomPosition(10, 20, 'W1N1');
			const thrown = attempt => { try { attempt(); return false; } catch (e) { return e instanceof Error; } };
			const edge = new RoomPosition(0, 49, 'W1N1');
			edge.x = 49;
			edge.y = 0;
			({
				pos: { x: pos.x, y: pos.y, roomName: pos.roomName },
				edge: { x: edge.x, y: edge.y },
				thrown: [
					thrown(() => new RoomPosition(-1, 20, 'W1N1')),
					thrown(() => new RoomPosition(10, 50, 'W1N1')),
					thrown(() => { pos.x = 50; }),
					thrown(() => { pos.y = -1; }),
				],
			})
		`);

		expect(result).toEqual({
			pos: { x: 10, y: 20, roomName: 'W1N1' },
			edge: { x: 49, y: 0 },
			thrown: [true, true, true, true],
		});
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

describe('RoomPosition look APIs', () => {
	test('ROOMPOS-LOOK-002 RoomPosition.lookFor(type) returns only that type\'s entries, [] when there are none', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE], name: 'LookTest',
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const pos = new RoomPosition(25, 25, 'W1N1');
			({ creeps: pos.lookFor(LOOK_CREEPS).map(c => c.name), structures: pos.lookFor(LOOK_STRUCTURES) })
		`);

		expect(result).toEqual({ creeps: ['LookTest'], structures: [] });
	});
});
