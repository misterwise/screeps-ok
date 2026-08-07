import { describe, test, expect, code, OK, ERR_FULL } from '../../src/index.js';

// Game.notify(message, groupInterval) queues an email notification. Its EFFECT is
// never observable from player code, which is exactly why it is easy to omit — and
// why omitting it is dangerous: bots call it from their own error/alert paths, so
// the missing function throws from INSIDE the bot's exception handler and takes
// down the caller. The return code is observable: upstream pushes a global `notify`
// intent capped at 20 per tick, returning OK, then ERR_FULL once the cap is hit.
// Previously uncovered.
describe('GAME-NOTIFY-001: Game.notify exists and returns OK', () => {
	test('accepts a message, an optional groupInterval, and no arguments at all', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			[
				typeof Game.notify,
				Game.notify('hello'),
				Game.notify('hello', 5),
				Game.notify(),
			]
		`);
		expect(result).toEqual(['function', OK, OK, OK]);
	});

	test('GAME-NOTIFY-002 the per-tick intent cap returns ERR_FULL and resets next tick', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const first = await shard.runPlayer('p1', code`
			(function () {
				const codes = [];
				for (let i = 0; i < 25; i++) codes.push(Game.notify('n' + i));
				return { at19: codes[19], at20: codes[20], at24: codes[24] };
			})()
		`) as { at19: number; at20: number; at24: number };

		expect(first.at19).toBe(OK);
		expect(first.at20).toBe(ERR_FULL);
		expect(first.at24).toBe(ERR_FULL);

		await shard.tick();

		// The budget is per TICK, not per context — a persistent counter that is
		// never reset would leave the bot permanently unable to notify.
		const next = await shard.runPlayer('p1', code`Game.notify('fresh tick')`);
		expect(next).toBe(OK);
	});
});

// Game.map.visual mirrors RoomVisual: server-side drawing is a no-op, but bots
// chain the calls and gate on getSize(), so the object must expose the whole
// chainable surface rather than being an empty placeholder.
describe('GAME-MAPVISUAL-001: Game.map.visual is a chainable MapVisual', () => {
	test('every documented method exists, returns the visual, and getSize is numeric', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			(function () {
				const v = Game.map.visual;
				const p1 = new RoomPosition(1, 1, 'W1N1');
				const p2 = new RoomPosition(2, 2, 'W1N1');
				return {
					types: ['line', 'circle', 'rect', 'poly', 'text', 'clear', 'getSize', 'export', 'import']
						.map(function (m) { return typeof v[m]; }),
					chains: v.text('a', p1) === v && v.line(p1, p2) === v && v.circle(p1) === v
						&& v.rect(p1, 2, 2) === v && v.poly([p1, p2]) === v && v.clear() === v
						&& v.import('') === v,
					size: typeof v.getSize(),
					exported: typeof v.export(),
				};
			})()
		`) as { types: string[]; chains: boolean; size: string; exported: string };

		expect(result.types).toEqual(Array(9).fill('function'));
		expect(result.chains).toBe(true);
		expect(result.size).toBe('number');
		expect(result.exported).toBe('string');
	});
});
