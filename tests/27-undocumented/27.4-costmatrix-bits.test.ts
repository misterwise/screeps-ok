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

		// A value per cell that differs from its transpose's, so a row/column swap shows.
		const result = await shard.runPlayer('p1', code`
			const cm = new PathFinder.CostMatrix();
			const value = (x, y) => (x * 7 + y * 13) % 256;
			for (let x = 0; x < 50; x++) for (let y = 0; y < 50; y++) cm.set(x, y, value(x, y));
			let mismatches = 0;
			for (let x = 0; x < 50; x++) {
				for (let y = 0; y < 50; y++) {
					if (cm._bits[x * 50 + y] !== cm.get(x, y) || cm.get(x, y) !== value(x, y)) mismatches++;
				}
			}
			mismatches
		`);
		expect(result).toBe(0);
	});

	test('UNDOC-COSTMATRIX-003 writes via _bits are observable through get() and affect PathFinder.search', async ({ shard }) => {
		await shard.ownedRoom('p1');

		// Every tile but the diagonal walled off, once through _bits and once through set().
		const result = await shard.runPlayer('p1', code`
			const walled = write => {
				const cm = new PathFinder.CostMatrix();
				for (let x = 0; x < 50; x++) for (let y = 0; y < 50; y++) if (x !== y) write(cm, x, y, 255);
				return cm;
			};
			const viaBits = walled((cm, x, y, v) => { cm._bits[x * 50 + y] = v; });
			const viaSet = walled((cm, x, y, v) => cm.set(x, y, v));
			const from = new RoomPosition(5, 5, 'W1N1');
			const search = cm => {
				const found = PathFinder.search(from, { pos: new RoomPosition(45, 45, 'W1N1'), range: 0 }, { roomCallback: () => cm, maxOps: 2000 });
				return { cost: found.cost, incomplete: found.incomplete, path: found.path.map(p => [p.x, p.y]) };
			};
			({ get: viaBits.get(10, 20), bits: search(viaBits), set: search(viaSet) })
		`) as { get: number; bits: { cost: number; incomplete: boolean; path: number[][] }; set: unknown };

		const diagonal = Array.from({ length: 40 }, (_, i) => [6 + i, 6 + i]);
		expect(result.get).toBe(255);
		expect(result.bits).toEqual({ cost: 40, incomplete: false, path: diagonal });
		expect(result.set).toEqual(result.bits);
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
