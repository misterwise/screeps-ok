import { describe, test, expect, code,
	OK, MOVE, WORK, CARRY, FIND_CREEPS, BODYPART_HITS,
} from '../../src/index.js';

describe('Room transitions', () => {
	test('ROOM-TRANSITION-001 creep moving to an exit tile appears in the adjacent room', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p1' },
			],
		});
		await shard.tick();

		const exitInfo = await shard.runPlayer('p1', code`
			const exits = Game.rooms['W1N1'].find(FIND_EXIT_LEFT);
			exits.length > 0 ? ({ x: exits[0].x, y: exits[0].y }) : null
		`) as { x: number; y: number } | null;
		expect(exitInfo).not.toBeNull();

		// Place creep adjacent to the exit tile.
		const creepId = await shard.placeCreep('W1N1', {
			pos: [exitInfo!.x + 1, exitInfo!.y], owner: 'p1', body: [MOVE],
			name: 'Traveler',
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).move(LEFT)
		`);
		expect(rc).toBe(OK);

		// runPlayer advances one tick, which processes the move intent
		// and the inter-room transition atomically. No extra tick — a
		// creep left on an exit tile auto-transitions again next tick,
		// which would bounce it back to W1N1.
		// Creep should be in W2N1 at x=49.
		const creeps = await shard.findInRoom('W2N1', FIND_CREEPS);
		const traveler = creeps.find(c => c.name === 'Traveler');
		expect(traveler).toBeDefined();
		expect(traveler!.pos.x).toBe(49);
		expect(traveler!.pos.y).toBe(exitInfo!.y);
		expect(traveler!.pos.roomName).toBe('W2N1');
	});

	test('ROOM-TRANSITION-002 creep retains identity across room transition', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p1' },
			],
		});
		await shard.tick();

		const exitInfo = await shard.runPlayer('p1', code`
			const exits = Game.rooms['W1N1'].find(FIND_EXIT_LEFT);
			exits.length > 0 ? ({ x: exits[0].x, y: exits[0].y }) : null
		`) as { x: number; y: number } | null;
		expect(exitInfo).not.toBeNull();

		const creepId = await shard.placeCreep('W1N1', {
			pos: [exitInfo!.x + 1, exitInfo!.y], owner: 'p1',
			body: [MOVE],
			name: 'Persistent',
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).move(LEFT)
		`);

		// The creep should still be accessible by its original ID.
		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.name).toBe('Persistent');
		expect(creep.pos.roomName).toBe('W2N1');
	});

	test('ROOM-TRANSITION-005 body, hits, and store preserved across room transition', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p1' },
			],
		});
		await shard.tick();

		const exitInfo = await shard.runPlayer('p1', code`
			const exits = Game.rooms['W1N1'].find(FIND_EXIT_LEFT);
			exits.length > 0 ? ({ x: exits[0].x, y: exits[0].y }) : null
		`) as { x: number; y: number } | null;
		expect(exitInfo).not.toBeNull();

		const creepId = await shard.placeCreep('W1N1', {
			pos: [exitInfo!.x + 1, exitInfo!.y], owner: 'p1',
			body: [WORK, CARRY, MOVE],
			store: { energy: 25 },
			name: 'Packed',
		});
		await shard.tick();

		// Snapshot state before transition.
		const before = await shard.expectObject(creepId, 'creep');

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).move(LEFT)
		`);
		expect(rc).toBe(OK);

		// runPlayer processes the move + transition atomically; no extra tick.
		const after = await shard.expectObject(creepId, 'creep');
		expect(after.pos.roomName).toBe('W2N1');

		// Body parts preserved.
		expect(after.body.map(p => ({ type: p.type, hits: p.hits }))).toEqual(
			before.body.map(p => ({ type: p.type, hits: p.hits })),
		);

		// Hits preserved.
		expect(after.hits).toBe(before.hits);
		expect(after.hitsMax).toBe(before.hitsMax);

		// Store preserved.
		expect(after.store.energy).toBe(before.store.energy);
	});

	test('ROOM-TRANSITION-003 fatigue resets to 0 when moving onto an exit tile', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p1' },
			],
		});
		await shard.tick();

		const exitInfo = await shard.runPlayer('p1', code`
			const exits = Game.rooms['W1N1'].find(FIND_EXIT_LEFT);
			exits.length > 0 ? ({ x: exits[0].x, y: exits[0].y }) : null
		`) as { x: number; y: number } | null;
		expect(exitInfo).not.toBeNull();

		// 4 WORK + 1 MOVE: a plain move generates 8 fatigue and the MOVE part
		// reduces by 2, leaving residual 6 after the move. The exit-tile reset
		// rule overrides that and forces fatigue to 0.
		const creepId = await shard.placeCreep('W1N1', {
			pos: [exitInfo!.x + 1, exitInfo!.y], owner: 'p1',
			body: [WORK, WORK, WORK, WORK, MOVE],
		});
		await shard.tick();

		// Single move directly from inside the room onto the exit tile.
		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).move(LEFT)
		`);

		// Without the reset, fatigue would be 6; with the reset it must be 0.
		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.fatigue).toBe(0);
	});

	test('ROOM-TRANSITION-006 creep placed on a room corner tile does not auto-transition', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p1' },
				{ name: 'W0N1', rcl: 1, owner: 'p1' },
				{ name: 'W1N2', rcl: 1, owner: 'p1' },
				{ name: 'W1N0', rcl: 1, owner: 'p1' },
				{ name: 'W2N2', rcl: 1, owner: 'p1' },
				{ name: 'W2N0', rcl: 1, owner: 'p1' },
				{ name: 'W0N2', rcl: 1, owner: 'p1' },
				{ name: 'W0N0', rcl: 1, owner: 'p1' },
			],
		});
		const corners = [
			{ name: 'CornerTopLeft', x: 0, y: 0 },
			{ name: 'CornerBottomLeft', x: 0, y: 49 },
			{ name: 'CornerTopRight', x: 49, y: 0 },
			{ name: 'CornerBottomRight', x: 49, y: 49 },
		];
		const ids: Array<{ id: string; x: number; y: number }> = [];
		for (const corner of corners) {
			const id = await shard.placeCreep('W1N1', {
				pos: [corner.x, corner.y], owner: 'p1', body: [MOVE], name: corner.name,
			});
			ids.push({ id, x: corner.x, y: corner.y });
		}

		await shard.tick();

		for (const { id, x, y } of ids) {
			const creep = await shard.expectObject(id, 'creep');
			expect(creep.pos.roomName).toBe('W1N1');
			expect(creep.pos.x).toBe(x);
			expect(creep.pos.y).toBe(y);
		}
	});

});
