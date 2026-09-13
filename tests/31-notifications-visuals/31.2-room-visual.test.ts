import { describe, test, expect, code } from '../../src/index.js';

// RoomVisual is rendering-only, so its effect is out of scope; what player code
// can observe is the runtime surface: the class, the shared per-room buffer,
// chainable drawing calls, getSize accounting, export/import round-trips, and
// the per-tick size limit. Bots gate their debug overlays on getSize and chain
// the calls, so an engine that stubs any of it breaks them silently or loudly.
describe('RoomVisual runtime surface', () => {
	test('VISUAL-ROOM-001:roomName room.visual is a RoomVisual for that room and the constructor works for any room name', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			(function () {
				const own = Game.rooms['W1N1'].visual;
				const far = new RoomVisual('W9N9');
				return {
					ownIsVisual: own instanceof RoomVisual,
					ownRoomName: own.roomName,
					farIsVisual: far instanceof RoomVisual,
					farRoomName: far.roomName,
					farDraws: typeof far.text,
				};
			})()
		`) as { ownIsVisual: boolean; ownRoomName: string; farIsVisual: boolean; farRoomName: string; farDraws: string };

		expect(result.ownIsVisual).toBe(true);
		expect(result.ownRoomName).toBe('W1N1');
		expect(result.farIsVisual).toBe(true);
		expect(result.farRoomName).toBe('W9N9');
		expect(result.farDraws).toBe('function');
	});

	test('VISUAL-ROOM-001:sharedBuffer instances for the same room share one buffer', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			(function () {
				const a = Game.rooms['W1N1'].visual;
				const b = new RoomVisual('W1N1');
				const before = b.getSize();
				a.text('hi', 10, 10);
				return { before: before, after: b.getSize() };
			})()
		`) as { before: number; after: number };

		expect(result.before).toBe(0);
		expect(result.after).toBeGreaterThan(0);
	});

	test('VISUAL-ROOM-002:draw drawing calls accept x,y and position forms and return the visual', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			(function () {
				const v = new RoomVisual('W1N1');
				const p1 = new RoomPosition(3, 4, 'W1N1');
				const p2 = new RoomPosition(5, 6, 'W1N1');
				return {
					chains: {
						lineXY: v.line(1, 1, 2, 2) === v,
						linePos: v.line(p1, p2) === v,
						circleXY: v.circle(1, 1) === v,
						circlePos: v.circle(p1) === v,
						rectXY: v.rect(1, 1, 2, 2) === v,
						rectPos: v.rect(p1, 2, 2) === v,
						polyTuples: v.poly([[1, 1], [2, 2]]) === v,
						polyPos: v.poly([p1, p2]) === v,
						textXY: v.text('a', 1, 1) === v,
						textPos: v.text('a', p1) === v,
						import: v.import('') === v,
					},
					size: typeof v.getSize(),
					exported: typeof v.export(),
				};
			})()
		`) as { chains: Record<string, boolean>; size: string; exported: string };

		expect(result.chains).toEqual({
			lineXY: true, linePos: true, circleXY: true, circlePos: true, rectXY: true, rectPos: true,
			polyTuples: true, polyPos: true, textXY: true, textPos: true, import: true,
		});
		expect(result.size).toBe('number');
		expect(result.exported).toBe('string');
	});

	test('VISUAL-ROOM-002:clear clear() returns the visual', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			(function () {
				const v = new RoomVisual('W1N1');
				v.text('a', 1, 1);
				return v.clear() === v;
			})()
		`);

		expect(result).toBe(true);
	});
});

describe('Visual size accounting and limits', () => {
	test('VISUAL-SIZE-001 getSize starts at 0, grows per drawing, resets on clear, and is per room and per map', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			(function () {
				const r1 = new RoomVisual('W1N1');
				const r2 = new RoomVisual('W2N1');
				const m = Game.map.visual;
				const start = [r1.getSize(), r2.getSize(), m.getSize()];
				r1.text('hello', 1, 1);
				const afterText = [r1.getSize(), r2.getSize(), m.getSize()];
				r1.circle(2, 2);
				const afterCircle = r1.getSize();
				m.text('x', new RoomPosition(1, 1, 'W1N1'));
				const afterMap = [r1.getSize(), m.getSize()];
				r1.clear();
				const afterClear = [r1.getSize(), m.getSize()];
				return { start, afterText, afterCircle, afterMap, afterClear };
			})()
		`) as { start: number[]; afterText: number[]; afterCircle: number; afterMap: number[]; afterClear: number[] };

		expect(result.start).toEqual([0, 0, 0]);
		expect(result.afterText[0]).toBeGreaterThan(0);
		expect(result.afterText[1]).toBe(0);
		expect(result.afterText[2]).toBe(0);
		expect(result.afterCircle).toBeGreaterThan(result.afterText[0]);
		expect(result.afterMap[0]).toBe(result.afterCircle);
		expect(result.afterMap[1]).toBeGreaterThan(0);
		expect(result.afterClear[0]).toBe(0);
		expect(result.afterClear[1]).toBe(result.afterMap[1]);
	});

	test('VISUAL-SIZE-002 import(export()) restores the same getSize in the same visual and in another room', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			(function () {
				const v = new RoomVisual('W1N1');
				v.text('hello', 1, 1).circle(2, 2, { radius: 0.5 }).line(1, 1, 5, 5);
				const size = v.getSize();
				const exported = v.export();
				v.clear();
				const cleared = v.getSize();
				v.import(exported);
				const other = new RoomVisual('W2N1');
				other.import(exported);
				return {
					size: size,
					exportedType: typeof exported,
					cleared: cleared,
					restored: v.getSize(),
					otherRestored: other.getSize(),
				};
			})()
		`) as { size: number; exportedType: string; cleared: number; restored: number; otherRestored: number };

		expect(result.size).toBeGreaterThan(0);
		expect(result.exportedType).toBe('string');
		expect(result.cleared).toBe(0);
		expect(result.restored).toBe(result.size);
		expect(result.otherRestored).toBe(result.size);
	});

	// Each text entry below is about 1 KB, so the last accepted drawing leaves
	// less than one entry of headroom under the limit.
	test('VISUAL-SIZE-003 a room visual rejects the drawing that would exceed 500 KB and recovers after clear', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			(function () {
				const v = new RoomVisual('W1N1');
				const t = 'x'.repeat(1000);
				let threw = false;
				let calls = 0;
				try { for (; calls < 2000; calls++) v.text(t, 1, 1); } catch (e) { threw = true; }
				const size = v.getSize();
				v.clear();
				const afterClear = v.getSize();
				v.text('ok', 1, 1);
				return { threw, calls, size, afterClear, recovered: v.getSize() };
			})()
		`) as { threw: boolean; calls: number; size: number; afterClear: number; recovered: number };

		expect(result.threw).toBe(true);
		expect(result.calls).toBeLessThan(2000);
		expect(result.size).toBeLessThanOrEqual(500 * 1024);
		expect(result.size).toBeGreaterThan(500 * 1024 - 2048);
		expect(result.afterClear).toBe(0);
		expect(result.recovered).toBeGreaterThan(0);
	});

	test('VISUAL-SIZE-004 the map visual rejects the drawing that would exceed 1000 KB and recovers after clear', async ({ shard }) => {
		await shard.ownedRoom('p1');

		const result = await shard.runPlayer('p1', code`
			(function () {
				const v = Game.map.visual;
				const pos = new RoomPosition(1, 1, 'W1N1');
				const t = 'x'.repeat(1000);
				let threw = false;
				let calls = 0;
				try { for (; calls < 4000; calls++) v.text(t, pos); } catch (e) { threw = true; }
				const size = v.getSize();
				v.clear();
				const afterClear = v.getSize();
				v.text('ok', pos);
				return { threw, calls, size, afterClear, recovered: v.getSize() };
			})()
		`) as { threw: boolean; calls: number; size: number; afterClear: number; recovered: number };

		expect(result.threw).toBe(true);
		expect(result.calls).toBeLessThan(4000);
		expect(result.size).toBeLessThanOrEqual(1000 * 1024);
		expect(result.size).toBeGreaterThan(1000 * 1024 - 2048);
		expect(result.afterClear).toBe(0);
		expect(result.recovered).toBeGreaterThan(0);
	});
});
