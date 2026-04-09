import { describe, test, expect, code,
	OK, MOVE, FIND_CREEPS,
} from '../../src/index.js';
import { hasDocumentedAdapterLimitation } from '../support/limitations.js';

const transitionTest = hasDocumentedAdapterLimitation('interRoomTransition') ? test.skip : test;

describe('Room transitions', () => {
	transitionTest('ROOM-TRANSITION-001 creep moving to an exit tile appears in the adjacent room', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p1' },
			],
		});
		await shard.tick();

		// Find an actual exit tile on the left edge (leads to W2N1).
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
		await shard.tick();

		// Creep should be in W2N1 at x=49.
		const creeps = await shard.findInRoom('W2N1', FIND_CREEPS);
		const traveler = creeps.find(c => c.name === 'Traveler');
		expect(traveler).toBeDefined();
		expect(traveler!.pos.x).toBe(49);
		expect(traveler!.pos.y).toBe(exitInfo!.y);
		expect(traveler!.pos.roomName).toBe('W2N1');
	});

	transitionTest('ROOM-TRANSITION-002 creep retains identity across room transition', async ({ shard }) => {
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
		await shard.tick();

		// The creep should still be accessible by its original ID.
		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.name).toBe('Persistent');
		expect(creep.pos.roomName).toBe('W2N1');
	});
});
