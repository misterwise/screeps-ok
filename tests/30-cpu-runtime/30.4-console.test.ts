import { describe, test, expect, code, MOVE } from '../../src/index.js';

describe('Console', () => {
	// The log line itself leaves the runtime and is out of scope. The surface is
	// not: bots log from every code path, including error handlers, with whatever
	// value is at hand. Engine game/console.js stringifies each argument with its
	// own toString (falling back to JSON only for toString-less values), so a
	// circular object or a live game object never throws.
	test('CONSOLE-001 console.log accepts any arguments, including circular and game objects, and returns undefined', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', { pos: [25, 25], owner: 'p1', body: [MOVE], name: 'logged' });
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			(function () {
				const circular = { a: 1 };
				circular.self = circular;
				return {
					type: typeof console.log,
					none: console.log() === undefined,
					string: console.log('hello') === undefined,
					mixed: console.log(1, 'two', undefined, null, true, { k: 1 }, [1, 2]) === undefined,
					circular: console.log(circular) === undefined,
					gameObject: console.log(Game.creeps['logged'], Game.rooms['W1N1']) === undefined,
				};
			})()
		`);

		expect(result).toEqual({
			type: 'function',
			none: true, string: true, mixed: true, circular: true, gameObject: true,
		});
	});
});
