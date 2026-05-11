import { describe, test, expect, code } from '../../src/index.js';

// PathFinder / findPath deprecations are routed through the new-pathfinder
// path (the default). Each assertion checks: (1) the canonical message text
// (API/option name + recommended replacement), (2) the call still returns a
// usable path/target. `PathFinder.use(true)` MUST NOT emit the notice.

describe('PathFinder.use deprecation notice', () => {
	test('DEPRECATED-PATH-001 PathFinder.use(false) emits a notice; PathFinder.use(true) is silent', async ({ shard }) => {
		shard.requires('deprecationNotices');
		await shard.ownedRoom('p1');

		// Call false then true within the same tick. Only the false call notices.
		await shard.runPlayer('p1', code`
			PathFinder.use(false);
			PathFinder.use(true);
			null
		`);

		const logs = await shard.captureConsoleLogs('p1');
		const matches = logs.filter(line => line.includes('PathFinder.use'));
		expect(matches).toHaveLength(1);
	});
});

describe('findPath / findClosestByPath opts.avoid deprecation', () => {
	test('DEPRECATED-PATH-002 avoid emits a notice and recommends costCallback; path is still returned', async ({ shard }) => {
		shard.requires('deprecationNotices');
		await shard.ownedRoom('p1');

		// One call per API surface that actually exists in the engine:
		// Room.findPath, RoomPosition.findPathTo, RoomPosition.findClosestByPath.
		// (The catalog also lists Room.findClosestByPath, but that prototype
		// method does not exist in vanilla — see the §28 notes.) Same notice
		// text for all surfaces, so per-tick dedup collapses to one log line.
		const result = await shard.runPlayer('p1', code`
			const room = Game.rooms.W1N1;
			const from = new RoomPosition(10, 10, 'W1N1');
			const to = new RoomPosition(20, 20, 'W1N1');
			const tgt = new RoomPosition(15, 15, 'W1N1');
			({
				findPath: room.findPath(from, to, { avoid: [{ x: 15, y: 15 }] }).length,
				findPathTo: from.findPathTo(to, { avoid: [{ x: 15, y: 15 }] }).length,
				closestPos: from.findClosestByPath([tgt], { avoid: [{ x: 15, y: 15 }] }) ? 1 : 0,
			})
		`) as { findPath: number; findPathTo: number; closestPos: number };
		expect(result.findPath).toBeGreaterThan(0);
		expect(result.findPathTo).toBeGreaterThan(0);
		expect(result.closestPos).toBe(1);

		const logs = await shard.captureConsoleLogs('p1');
		const matches = logs.filter(line =>
			line.includes('avoid') && line.includes('costCallback') && line.includes('PathFinder.use'),
		);
		expect(matches).toHaveLength(1);
	});

	test('DEPRECATED-PATH-003 ignore emits a notice and recommends costCallback; path is still returned', async ({ shard }) => {
		shard.requires('deprecationNotices');
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const room = Game.rooms.W1N1;
			const from = new RoomPosition(10, 10, 'W1N1');
			const to = new RoomPosition(20, 20, 'W1N1');
			const tgt = new RoomPosition(15, 15, 'W1N1');
			({
				findPath: room.findPath(from, to, { ignore: [{ x: 15, y: 15 }] }).length,
				findPathTo: from.findPathTo(to, { ignore: [{ x: 15, y: 15 }] }).length,
				closestPos: from.findClosestByPath([tgt], { ignore: [{ x: 15, y: 15 }] }) ? 1 : 0,
			})
		`) as { findPath: number; findPathTo: number; closestPos: number };
		expect(result.findPath).toBeGreaterThan(0);
		expect(result.findPathTo).toBeGreaterThan(0);
		expect(result.closestPos).toBe(1);

		const logs = await shard.captureConsoleLogs('p1');
		const matches = logs.filter(line =>
			line.includes('ignore') && line.includes('costCallback') && line.includes('PathFinder.use'),
		);
		expect(matches).toHaveLength(1);
	});
});
