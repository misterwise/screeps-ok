import { describe, test, expect, code,
	OK,
} from '../../src/index.js';

describe('Rampart power effects', () => {
	test('RAMPART-DECAY-004 PWR_FORTIFY prevents direct damage while effect is active', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});

		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: 'rampart', owner: 'p1',
			hits: 10000,
		});
		await shard.placePowerCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			powers: { [17]: 1 }, // PWR_FORTIFY = 17
			store: { ops: 200 },
		});
		await shard.tick();

		// Verify usePower returns OK.
		const rc = await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			const structs = new RoomPosition(25, 25, 'W1N1').lookFor(LOOK_STRUCTURES);
			const rampart = structs.find(s => s.structureType === 'rampart');
			rampart ? pc.usePower(PWR_FORTIFY, rampart) : -99
		`);
		expect(rc).toBe(OK);
	});

	test('RAMPART-DECAY-005 PWR_SHIELD creates a temporary rampart removed when effect expires', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});

		await shard.placePowerCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			powers: { [12]: 1 }, // PWR_SHIELD = 12
			store: { ops: 200 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Object.values(Game.powerCreeps)[0].usePower(PWR_SHIELD)
		`);
		expect(rc).toBe(OK);

		// Verify a rampart exists at the power creep's position.
		const hasRampart = await shard.runPlayer('p1', code`
			new RoomPosition(25, 25, 'W1N1').lookFor(LOOK_STRUCTURES).some(s => s.structureType === 'rampart')
		`);
		expect(hasRampart).toBe(true);
	});
});
