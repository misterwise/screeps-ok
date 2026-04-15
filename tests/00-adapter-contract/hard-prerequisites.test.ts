import { describe, test, expect, code, limitationGated,
	OK, MOVE, FIND_CREEPS,
	STRUCTURE_SPAWN,
	CONTROLLER_DOWNGRADE,
} from '../../src/index.js';

const downgradeTest = limitationGated('controllerDowngrade');
const transitionTest = limitationGated('interRoomTransition');

describe('adapter contract: hard family prerequisites', () => {
	describe('controller ticksToDowngrade', () => {
		downgradeTest('RoomSpec.ticksToDowngrade sets the controller downgrade timer', async ({ shard }) => {
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
			// Should be close to 10 (may be off by 1 from the tick).
			expect(result).toBeLessThanOrEqual(10);
			expect(result).toBeGreaterThan(0);
		});

		downgradeTest('controller downgrades when ticksToDowngrade reaches 0', async ({ shard }) => {
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
				p ? ({
					type: p.structureType,
					destRoom: p.destination.roomName ?? p.destination.room,
					destX: p.destination.x,
					destY: p.destination.y,
				}) : null
			`) as any;
			expect(result).not.toBeNull();
			expect(result.type).toBe('portal');
			expect(result.destRoom).toBe('W2N1');
		});
	});

	describe('inter-room creep transition', () => {
		transitionTest('creep moving to exit tile appears in the adjacent room', async ({ shard }) => {
			// W1N1 left exit (x=0) leads to W2N1.
			await shard.createShard({
				players: ['p1'],
				rooms: [
					{ name: 'W1N1', rcl: 1, owner: 'p1' },
					{ name: 'W2N1', rcl: 1, owner: 'p1' },
				],
			});
			await shard.tick();

			// Find an actual exit tile on the left edge using the game API.
			const exitInfo = await shard.runPlayer('p1', code`
				const exits = Game.rooms['W1N1'].find(FIND_EXIT_LEFT);
				exits.length > 0 ? ({ x: exits[0].x, y: exits[0].y }) : null
			`) as { x: number; y: number } | null;

			if (!exitInfo) {
				// No left exit — skip gracefully.
				return;
			}

			// Place creep adjacent to the exit tile.
			const creepId = await shard.placeCreep('W1N1', {
				pos: [exitInfo.x + 1, exitInfo.y], owner: 'p1', body: [MOVE],
				name: 'Traveler',
			});
			await shard.tick();

			// Move LEFT to the exit tile.
			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${creepId}).move(LEFT)
			`);
			expect(rc).toBe(OK);

			// Extra tick for global processor to handle inter-room transition.
			await shard.tick();

			// The creep should now be in W2N1 at x=49.
			const creeps = await shard.findInRoom('W2N1', FIND_CREEPS);
			const traveler = creeps.find(c => c.name === 'Traveler');
			expect(traveler).toBeDefined();
			expect(traveler!.pos.x).toBe(49);
		});
	});
});
