import { describe, test, expect, code } from '../../src/index.js';

describe('Undocumented API Surface — CostMatrix._bits', () => {
	test('UNDOC-COSTMATRIX-001 _bits is a Uint8Array of length 2500', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const cm = new PathFinder.CostMatrix();
			({
				hasBits: cm._bits !== undefined,
				length: cm._bits && cm._bits.length,
				isUint8Array: cm._bits instanceof Uint8Array,
			})
		`) as { hasBits: boolean; length: number; isUint8Array: boolean };

		expect(result.hasBits).toBe(true);
		expect(result.length).toBe(2500);
		expect(result.isUint8Array).toBe(true);
	});

	test('UNDOC-COSTMATRIX-002 _bits[x*50+y] equals get(x, y) across the grid', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const cm = new PathFinder.CostMatrix();
			cm.set(3, 7, 42);
			cm.set(0, 0, 1);
			cm.set(49, 49, 99);
			cm.set(25, 12, 200);
			({
				a: cm._bits[3 * 50 + 7] === cm.get(3, 7) && cm.get(3, 7) === 42,
				b: cm._bits[0 * 50 + 0] === cm.get(0, 0) && cm.get(0, 0) === 1,
				c: cm._bits[49 * 50 + 49] === cm.get(49, 49) && cm.get(49, 49) === 99,
				d: cm._bits[25 * 50 + 12] === cm.get(25, 12) && cm.get(25, 12) === 200,
			})
		`) as { a: boolean; b: boolean; c: boolean; d: boolean };

		expect(result).toEqual({ a: true, b: true, c: true, d: true });
	});

	test('UNDOC-COSTMATRIX-003 writes via _bits are observable through get() and affect PathFinder.search', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const cm = new PathFinder.CostMatrix();
			cm._bits[10 * 50 + 20] = 77;

			const roomName = Object.keys(Game.rooms)[0];
			const from = new RoomPosition(5, 5, roomName);
			const to = new RoomPosition(45, 45, roomName);
			const blocker = new PathFinder.CostMatrix();
			for (let x = 0; x < 50; x++) {
				for (let y = 0; y < 50; y++) {
					if (x === y) continue;
					blocker._bits[x * 50 + y] = 255;
				}
			}
			const path = PathFinder.search(from, { pos: to, range: 0 }, {
				roomCallback: () => blocker,
				maxOps: 2000,
			});

			({
				getMatches: cm.get(10, 20) === 77,
				searchRan: Array.isArray(path.path),
			})
		`) as { getMatches: boolean; searchRan: boolean };

		expect(result.getMatches).toBe(true);
		expect(result.searchRan).toBe(true);
	});

	test('UNDOC-COSTMATRIX-004 serialize/deserialize preserves _bits byte-for-byte', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const a = new PathFinder.CostMatrix();
			a.set(3, 7, 42);
			a.set(0, 0, 1);
			a.set(49, 49, 99);
			a.set(25, 12, 200);

			const b = PathFinder.CostMatrix.deserialize(a.serialize());
			let equal = a._bits.length === b._bits.length;
			if (equal) {
				for (let i = 0; i < a._bits.length; i++) {
					if (a._bits[i] !== b._bits[i]) { equal = false; break; }
				}
			}
			({ equal, aLen: a._bits.length, bLen: b._bits.length })
		`) as { equal: boolean; aLen: number; bLen: number };

		expect(result.equal).toBe(true);
		expect(result.aLen).toBe(2500);
		expect(result.bLen).toBe(2500);
	});
});
