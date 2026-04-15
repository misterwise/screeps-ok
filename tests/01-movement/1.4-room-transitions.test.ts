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

		// Find an actual non-corner exit on the left edge (leads to W2N1).
		// Corner exits (y=0, y=49) trigger divergent branch-ordering in the
		// engine's exit-crossing logic (see ROOM-TRANSITION-006); avoid them
		// here so this test isolates the standard single-axis transition.
		const exitInfo = await shard.runPlayer('p1', code`
			const exits = Game.rooms['W1N1'].find(FIND_EXIT_LEFT)
				.filter(e => e.y > 5 && e.y < 44);
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

		// Non-corner exit; see ROOM-TRANSITION-006 for corner semantics.
		const exitInfo = await shard.runPlayer('p1', code`
			const exits = Game.rooms['W1N1'].find(FIND_EXIT_LEFT)
				.filter(e => e.y > 5 && e.y < 44);
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
			const exits = Game.rooms['W1N1'].find(FIND_EXIT_LEFT)
				.filter(e => e.y > 5 && e.y < 44);
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

		// Pick a left-edge exit that is NOT in a corner — corner exits make the
		// inner tile (exitX+1, exitY=0) already at-edge (because y=0), and the
		// fatigue-reset rule requires the source tile to NOT be at edge.
		const exitInfo = await shard.runPlayer('p1', code`
			const exits = Game.rooms['W1N1'].find(FIND_EXIT_LEFT)
				.filter(e => e.y > 5 && e.y < 44);
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

	test('ROOM-TRANSITION-006 corner (49,0) transitions NORTH via the y=0 branch first', async ({ shard }) => {
		// Canonical vanilla branch order (from `@screeps/engine/src/processor/
		// intents/creeps/tick.js:58-73`): `x=0 → y=0 → x=49 → y=49`. So a
		// creep at (49, 0) matches `y=0` before `x=49` and goes NORTH to
		// (49, 49) of the adjacent upper room.
		//
		// xxscreeps orders `x=0 → x=49 → y=0 → y=49` (see
		// `xxscreeps/src/mods/creep/processor.ts:311-319`) and instead goes
		// EAST to (0, 0) of the adjacent eastern room. Tracked as parity gap
		// `corner-exit-branch-order` in `adapters/xxscreeps/parity.json`.
		//
		// The shard includes both potential destinations so whichever branch
		// fires has an accessible target and actually crosses; any creep
		// that is still in W1N1 after the tick has been aborted rather than
		// transitioned, which isn't what we're testing.
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W1N2' },  // Vanilla's destination (NORTH).
				{ name: 'W0N1' },  // xxscreeps' destination (EAST).
			],
		});
		await shard.tick();

		// Place creep directly at (49, 0) — the corner itself. The creep's
		// idle exit-crossing processor fires on the very next tick; no
		// player intent is needed because simply being on a border tile
		// triggers the cross-room logic.
		const creepId = await shard.placeCreep('W1N1', {
			pos: [49, 0], owner: 'p1', body: [MOVE],
			name: 'Cornered',
		});
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.pos.roomName).toBe('W1N2');
		expect(creep.pos.x).toBe(49);
		expect(creep.pos.y).toBe(49);
	});

});
