import { describe, test, expect, code } from '../../src/index.js';

describe('Undocumented API Surface — RoomPosition.__packedPos', () => {
	test('UNDOC-PACKEDPOS-001 every RoomPosition has a non-negative integer __packedPos', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const a = new RoomPosition(0, 0, 'W1N1');
			const b = new RoomPosition(25, 37, 'W1N1');
			const c = new RoomPosition(49, 49, 'E5S5');
			({
				aPacked: a.__packedPos,
				bPacked: b.__packedPos,
				cPacked: c.__packedPos,
			})
		`) as { aPacked: unknown; bPacked: unknown; cPacked: unknown };

		for (const [name, v] of Object.entries(result)) {
			expect(typeof v, `${name} type`).toBe('number');
			expect(Number.isInteger(v as number), `${name} isInteger`).toBe(true);
		}
	});

	test('UNDOC-PACKEDPOS-002 same (x, y, roomName) produce equal __packedPos values', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const a = new RoomPosition(25, 37, 'W1N1');
			const b = new RoomPosition(25, 37, 'W1N1');
			const differentXY = new RoomPosition(24, 37, 'W1N1');
			const differentRoom = new RoomPosition(25, 37, 'W2N1');
			({
				sameXYRoom: a.__packedPos === b.__packedPos,
				differentXY: a.__packedPos !== differentXY.__packedPos,
				differentRoom: a.__packedPos !== differentRoom.__packedPos,
			})
		`) as { sameXYRoom: boolean; differentXY: boolean; differentRoom: boolean };

		expect(result.sameXYRoom).toBe(true);
		expect(result.differentXY).toBe(true);
		expect(result.differentRoom).toBe(true);
	});

	test('UNDOC-PACKEDPOS-003 writing __packedPos updates x, y, and roomName getters', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const source = new RoomPosition(13, 41, 'E5S5');
			const target = new RoomPosition(0, 0, 'W1N1');
			target.__packedPos = source.__packedPos;
			({
				x: target.x,
				y: target.y,
				roomName: target.roomName,
				packedEqual: target.__packedPos === source.__packedPos,
			})
		`) as { x: number; y: number; roomName: string; packedEqual: boolean };

		expect(result.x).toBe(13);
		expect(result.y).toBe(41);
		expect(result.roomName).toBe('E5S5');
		expect(result.packedEqual).toBe(true);
	});

	test('UNDOC-PACKEDPOS-004 positions in the same room share the upper 16 bits of __packedPos', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			const a = new RoomPosition(0, 0, 'W1N1');
			const b = new RoomPosition(49, 49, 'W1N1');
			const c = new RoomPosition(25, 25, 'W1N1');
			const different = new RoomPosition(25, 25, 'W2N1');
			const aUpper = a.__packedPos >>> 16;
			const bUpper = b.__packedPos >>> 16;
			const cUpper = c.__packedPos >>> 16;
			const differentUpper = different.__packedPos >>> 16;
			({
				sameRoomSharesUpper: aUpper === bUpper && bUpper === cUpper,
				differentRoomDiffersUpper: aUpper !== differentUpper,
			})
		`) as { sameRoomSharesUpper: boolean; differentRoomDiffersUpper: boolean };

		expect(result.sameRoomSharesUpper).toBe(true);
		expect(result.differentRoomDiffersUpper).toBe(true);
	});
});
