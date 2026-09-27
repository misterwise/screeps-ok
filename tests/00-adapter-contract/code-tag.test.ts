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
		// `npm run check` typechecks tests/, so the expect-error fails it if a raw string becomes assignable.
		const tagged: PlayerCode = code`1 + 1`;
		// @ts-expect-error a raw string is not PlayerCode
		const raw: PlayerCode = `1 + 1`;
		expect([tagged, raw]).toEqual(['1 + 1', '1 + 1']);
	});
});
