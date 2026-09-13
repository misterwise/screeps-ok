import { describe, test, expect, code, MOVE, CARRY, WORK, TOP } from '../../src/index.js';

// Game-object methods must live on the CLASS PROTOTYPE, not as own properties of
// each object. This is undocumented but load-bearing: essentially every serious bot
// wraps natives, e.g.
//     const orig = Creep.prototype.transfer;
//     Creep.prototype.transfer = function (...) { const r = orig.call(this, ...); ... };
// If the engine puts `transfer` on the instance, the own property shadows the
// prototype: the bot's wrapper never runs, `orig` is captured as `undefined`, and
// NOTHING throws — the bookkeeping the wrapper existed for simply never happens.
// Previously uncovered: every conformance test calls methods directly, which works
// either way.
describe('PROTO-METHODS-001: engine methods live on the class prototype', () => {
	test('a creep exposes no own method properties and inherits them from Creep.prototype', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', { pos: [25, 25], owner: 'p1', body: [MOVE, CARRY, WORK] });
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			(function () {
				const c = Game.getObjectById(${id});
				const ownMethods = Object.getOwnPropertyNames(c)
					.filter(function (k) { return typeof c[k] === 'function'; })
					.filter(function (k) { return k.charAt(0) !== '_' && k !== 'toJSON'; });
				return {
					ownMethods: ownMethods,
					protoMove: typeof Creep.prototype.move,
					protoTransfer: typeof Creep.prototype.transfer,
					inherited: c.move === Creep.prototype.move,
				};
			})()
		`) as { ownMethods: string[]; protoMove: string; protoTransfer: string; inherited: boolean };

		expect(result.ownMethods).toEqual([]);
		expect(result.protoMove).toBe('function');
		expect(result.protoTransfer).toBe('function');
		expect(result.inherited).toBe(true);
	});

	test('PROTO-METHODS-002 a prototype override wraps the native and is the method that runs', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', { pos: [25, 25], owner: 'p1', body: [MOVE, CARRY] });
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			(function () {
				const native = Creep.prototype.move;
				if (typeof native !== 'function') return { captured: false };
				globalThis.__wrapCalls = 0;
				Creep.prototype.move = function (dir) {
					globalThis.__wrapCalls++;
					return native.call(this, dir);
				};
				const rc = Game.getObjectById(${id}).move(${TOP});
				return { captured: true, calls: globalThis.__wrapCalls, rc: rc };
			})()
		`) as { captured: boolean; calls: number; rc: number };

		// The bot could capture the native at all (not undefined) …
		expect(result.captured).toBe(true);
		// … its wrapper actually ran …
		expect(result.calls).toBe(1);
		// … and the native still produced the normal return code.
		expect(result.rc).toBe(0);
	});
});
