import { describe, test, expect, code,
	OK, MOVE, FIND_CREEPS,
	STRUCTURE_SPAWN,
	CONTROLLER_DOWNGRADE,
	STRUCTURE_PORTAL,
} from '../../src/index.js';

describe('adapter contract: hard family prerequisites', () => {
	describe('controller ticksToDowngrade', () => {
		test('RoomSpec.ticksToDowngrade sets the controller downgrade timer', async ({ shard }) => {
			// A room created with ticksToDowngrade should expose that value
			// on the controller snapshot, allowing downgrade tests to run in
			// a small number of ticks instead of thousands.
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1', ticksToDowngrade: 10 }],
			});
			await shard.tick();

			const result = await shard.runPlayer('p1', code`
				Game.rooms['W1N1'].controller.ticksToDowngrade
			`) as number;
			// Seeded 10 at creation; one tick has elapsed.
			expect(result).toBe(9);
		});

		test('controller downgrades when ticksToDowngrade reaches 0', async ({ shard }) => {
			await shard.createShard({
				players: ['p1'],
				rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1', ticksToDowngrade: 3 }],
			});
			await shard.tick();

			// Advance ticks to trigger downgrade.
			await shard.tick(5);

			const level = await shard.runPlayer('p1', code`
				Game.rooms['W1N1'].controller.level
			`) as number;
			// Should have downgraded from 2 to 1.
			expect(level).toBe(1);
		});
	});

	describe('portal placement', () => {
		test('placeObject creates a same-shard portal retrievable by player code', async ({ shard }) => {
			shard.requires('portals');
			await shard.createShard({
				players: ['p1'],
				rooms: [
					{ name: 'W1N1', rcl: 1, owner: 'p1' },
					{ name: 'W2N1' },
				],
			});
			const portalId = await shard.placeObject('W1N1', 'portal', {
				pos: [25, 25],
				destination: { room: 'W2N1', x: 25, y: 25 },
			});
			await shard.tick();

			const result = await shard.runPlayer('p1', code`
				const p = Game.getObjectById(${portalId});
				({
					type: p.structureType,
					destRoom: p.destination.roomName,
					destX: p.destination.x,
					destY: p.destination.y,
				})
			`);
			expect(result).toEqual({ type: STRUCTURE_PORTAL, destRoom: 'W2N1', destX: 25, destY: 25 });
		});
	});

	describe('inter-room creep transition', () => {
		test('creep moving to exit tile appears in the adjacent room', async ({ shard }) => {
			// W1N1 left exit (x=0) leads to W2N1.
			await shard.createShard({
				players: ['p1'],
				rooms: [
					{ name: 'W1N1', rcl: 1, owner: 'p1' },
					{ name: 'W2N1', rcl: 1, owner: 'p1' },
				],
			});
			await shard.tick();

			// Only the room's corners are walled, so (0, 25) is a left exit tile.
			const creepId = await shard.placeCreep('W1N1', {
				pos: [1, 25], owner: 'p1', body: [MOVE],
				name: 'Traveler',
			});
			await shard.tick();

			// Move LEFT to the exit tile.
			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${creepId}).move(LEFT)
			`);
			expect(rc).toBe(OK);

			// runPlayer advances one tick, which processes the move intent
			// and the inter-room transition atomically. No extra tick — a
			// creep left on an exit tile auto-transitions again next tick,
			// so checking after another tick would see it back in W1N1.
			// The creep should now be in W2N1 at x=49.
			const creeps = await shard.findInRoom('W2N1', FIND_CREEPS);
			const traveler = creeps.find(c => c.name === 'Traveler');
			expect(traveler?.pos).toEqual({ x: 49, y: 25, roomName: 'W2N1' });
		});
	});
});
