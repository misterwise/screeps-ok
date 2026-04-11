import { describe, test, expect, code, MOVE } from '../../src/index.js';
import type { PlayerCode } from '../../src/code.js';

describe('adapter contract: code tag', () => {
	test('interpolates string values safely', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const val = "hello'world";
		const result = await shard.runPlayer('p1', code`${val}`);
		expect(result).toBe("hello'world");
	});

	test('interpolates number values', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const n = 42;
		const result = await shard.runPlayer('p1', code`${n} * 2`);
		expect(result).toBe(84);
	});

	test('interpolates object IDs for getObjectById', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', {
			pos: [25, 25],
			owner: 'p1',
			body: [MOVE],
			name: 'CodeTagTest',
		});
		const result = await shard.runPlayer('p1', code`
			Game.getObjectById(${id})?.name
		`);
		expect(result).toBe('CodeTagTest');
	});

	test('branded PlayerCode type prevents raw strings at compile time', () => {
		// This is a compile-time check — raw strings should not be assignable to PlayerCode
		const tagged: PlayerCode = code`1 + 1`;
		expect(typeof tagged).toBe('string');

		// The following would be a type error if uncommented:
		// const raw: PlayerCode = `1 + 1`;  // Type 'string' is not assignable to type 'PlayerCode'
	});
});
