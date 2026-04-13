import { describe, test, expect, code,
	MOVE, FIND_CREEPS,
	limitationGated,
} from '../../src/index.js';

const portalTest = limitationGated('portalPlacement');

describe('Portal mechanics', () => {
	portalTest('PORTAL-001 creep on a same-shard portal tile appears at the destination next tick', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p1' },
			],
		});
		// Place a portal at [25,25] leading to W2N1 [10,10].
		await shard.placeObject('W1N1', 'portal', {
			pos: [25, 25],
			destination: { room: 'W2N1', x: 10, y: 10 },
		});
		// Place the creep ON the portal tile.
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE],
			name: 'PortalCreep',
		});
		await shard.tick();

		// After one tick, the creep should be teleported to W2N1.
		// The portal processor checks if a creep is standing on a portal tile
		// and sets interRoom. The global processor then moves the creep.
		await shard.tick();

		const creeps = await shard.findInRoom('W2N1', FIND_CREEPS);
		const teleported = creeps.find(c => c.name === 'PortalCreep');
		expect(teleported).toBeDefined();
		expect(teleported!.pos.x).toBe(10);
		expect(teleported!.pos.y).toBe(10);
	});

	portalTest('PORTAL-002 same-shard portal exposes destination as a RoomPosition', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1' },
			],
		});
		const portalId = await shard.placeObject('W1N1', 'portal', {
			pos: [25, 25],
			destination: { room: 'W2N1', x: 30, y: 30 },
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const p = Game.getObjectById(${portalId});
			p ? ({
				hasDestination: !!p.destination,
				room: p.destination?.roomName,
				x: p.destination?.x,
				y: p.destination?.y,
			}) : null
		`) as any;
		expect(result).not.toBeNull();
		expect(result.hasDestination).toBe(true);
		expect(result.room).toBe('W2N1');
		expect(result.x).toBe(30);
		expect(result.y).toBe(30);
	});

	portalTest('PORTAL-004 permanent portal has undefined ticksToDecay', async ({ shard }) => {
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

		const decay = await shard.runPlayer('p1', code`
			const p = Game.getObjectById(${portalId});
			p ? p.ticksToDecay : -99
		`);
		// Permanent portal (decayTime: null) should have undefined ticksToDecay.
		expect(decay).toBeNull();
	});

	portalTest('PORTAL-005 creep landing on a portal tile is transported next tick without a move intent', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p1' },
			],
		});
		await shard.placeObject('W1N1', 'portal', {
			pos: [25, 25],
			destination: { room: 'W2N1', x: 10, y: 10 },
		});
		// Creep starts adjacent. Step ONTO the portal tile this tick.
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1', body: [MOVE],
			name: 'PortalStepper',
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).move(TOP)
		`);
		expect(rc).toBe(0);

		// After the step tick, the creep sits on the portal with NO pending move intent.
		// The next tick advances without any player code, proving passive transport.
		await shard.tick();

		const creeps = await shard.findInRoom('W2N1', FIND_CREEPS);
		const teleported = creeps.find(c => c.name === 'PortalStepper');
		expect(teleported).toBeDefined();
		expect(teleported!.pos.x).toBe(10);
		expect(teleported!.pos.y).toBe(10);
	});

	portalTest('PORTAL-003 cross-shard portal exposes destination as { shard, room }', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
			],
		});
		const portalId = await shard.placeObject('W1N1', 'portal', {
			pos: [25, 25],
			destination: { shard: 'shard1', room: 'W5N5' },
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const p = Game.getObjectById(${portalId});
			p ? ({
				hasDest: !!p.destination,
				shard: p.destination?.shard,
				room: p.destination?.room,
			}) : null
		`) as { hasDest: boolean; shard: string; room: string } | null;
		expect(result).not.toBeNull();
		expect(result!.hasDest).toBe(true);
		expect(result!.shard).toBe('shard1');
		expect(result!.room).toBe('W5N5');
	});
});
