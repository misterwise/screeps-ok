import { describe, test, expect, code,
	OK, MOVE, FIND_CREEPS, PWR_GENERATE_OPS,
} from '../../src/index.js';
import type { ShardFixture } from '../../src/fixture.js';

describe('Portal mechanics', () => {
	async function portalRooms(shard: ShardFixture) {
		shard.requires('portals');
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p1' },
			],
		});
		return shard.placeObject('W1N1', 'portal', {
			pos: [25, 25],
			destination: { room: 'W2N1', x: 10, y: 10 },
		});
	}

	test('PORTAL-001:placed a creep placed on a same-shard portal tile appears at the destination next tick', async ({ shard }) => {
		await portalRooms(shard);
		await shard.placeCreep('W1N1', { pos: [25, 25], owner: 'p1', body: [MOVE], name: 'PortalCreep' });

		await shard.tick();
		const creep = (await shard.findInRoom('W2N1', FIND_CREEPS)).find(c => c.name === 'PortalCreep');
		expect(creep?.pos).toEqual({ x: 10, y: 10, roomName: 'W2N1' });
	});

	test('PORTAL-001:moved a creep stepping onto a portal tile is at the destination the next tick without a further move intent', async ({ shard }) => {
		await portalRooms(shard);
		const creepId = await shard.placeCreep('W1N1', { pos: [25, 26], owner: 'p1', body: [MOVE], name: 'PortalStepper' });

		// The step lands on the portal and the same tick's portal pass carries it on.
		const rc = await shard.runPlayer('p1', code`Game.getObjectById(${creepId}).move(TOP)`);
		expect(rc).toBe(OK);
		const creep = (await shard.findInRoom('W2N1', FIND_CREEPS)).find(c => c.name === 'PortalStepper');
		expect(creep?.pos).toEqual({ x: 10, y: 10, roomName: 'W2N1' });
	});

	test('PORTAL-001:powerCreep a power creep on a same-shard portal tile appears at the destination next tick', async ({ shard }) => {
		shard.requires('powerCreeps');
		await portalRooms(shard);
		await shard.placePowerCreep('W1N1', { pos: [25, 25], owner: 'p1', name: 'PortalOperator', powers: { [PWR_GENERATE_OPS]: 1 } });

		await shard.tick();
		// Power creeps have no snapshot; the read shows the tick before it runs.
		const pos = await shard.runPlayer('p1', code`
			const pos = Game.powerCreeps.PortalOperator.pos;
			({ x: pos.x, y: pos.y, roomName: pos.roomName })
		`);
		expect(pos).toEqual({ x: 10, y: 10, roomName: 'W2N1' });
	});

	test('PORTAL-002 same-shard portal exposes destination as a RoomPosition', async ({ shard }) => {
		const portalId = await portalRooms(shard);

		const result = await shard.runPlayer('p1', code`
			const d = Game.getObjectById(${portalId}).destination;
			// A RoomPosition method proves an instance, not a lookalike object.
			[d instanceof RoomPosition, d.roomName, d.x, d.y, d.isEqualTo(new RoomPosition(10, 10, 'W2N1'))]
		`);
		expect(result).toEqual([true, 'W2N1', 10, 10, true]);
	});

	test('PORTAL-004:temporary a temporary portal exposes ticksToDecay', async ({ shard }) => {
		shard.requires('portals');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }, { name: 'W2N1' }],
		});
		const ticksToDecay = 100;
		const portalId = await shard.placeObject('W1N1', 'portal', {
			pos: [25, 25],
			destination: { room: 'W2N1', x: 25, y: 25 },
			ticksToDecay,
		});

		expect(await shard.runPlayer('p1', code`Game.getObjectById(${portalId}).ticksToDecay`)).toBe(ticksToDecay);
	});

	test('PORTAL-004:permanent a permanent portal has undefined ticksToDecay', async ({ shard }) => {
		shard.requires('portals');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }, { name: 'W2N1' }],
		});
		const portalId = await shard.placeObject('W1N1', 'portal', {
			pos: [25, 25],
			destination: { room: 'W2N1', x: 25, y: 25 },
		});

		// runPlayer reads the getter's undefined as null.
		expect(await shard.runPlayer('p1', code`Game.getObjectById(${portalId}).ticksToDecay`)).toBeNull();
	});

	test('PORTAL-006 temporary portal counts down ticksToDecay and is removed at decay', async ({ shard }) => {
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
			ticksToDecay: 3,
		});
		// An idle creep keeps the room active so the decay processor wakes
		// up — a portal-only room is otherwise eligible to sleep past
		// wakeAt(decayTime).
		await shard.placeCreep('W1N1', {
			pos: [10, 10], owner: 'p1', body: [MOVE], name: 'PortalWatcher',
		});
		await shard.tick();

		// The portal is removed only once the tick passes decayTime, so it is
		// still standing while ticksToDecay reads 0 and then -1.
		const readings: (number | null)[] = [];
		for (let i = 0; i < 5; i++) {
			readings.push(await shard.runPlayer('p1', code`
				const p = Game.getObjectById(${portalId});
				p ? p.ticksToDecay : null
			`) as number | null);
		}
		expect(readings).toEqual([2, 1, 0, -1, null]);
	});

	test('PORTAL-003 cross-shard portal exposes destination as { shard, room }', async ({ shard }) => {
		shard.requires('portals');
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
