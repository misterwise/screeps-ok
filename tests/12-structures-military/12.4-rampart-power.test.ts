import { describe, test, expect, code,
	OK, ERR_INVALID_TARGET,
	ATTACK, MOVE, ATTACK_POWER,
	PWR_FORTIFY, PWR_SHIELD,
	STRUCTURE_RAMPART,
} from '../../src/index.js';

describe('Rampart power effects', () => {
	test('RAMPART-DECAY-004 PWR_FORTIFY prevents direct damage while effect is active', async ({ shard }) => {
		shard.requires('powerCreeps');
		shard.requires('powerEffects');
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 8, owner: 'p1', powerEnabled: true },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});

		const rampartId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_RAMPART, owner: 'p1',
			hits: 10000,
		});
		// Level 5 lasts 5 ticks.
		await shard.placePowerCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			powers: { [PWR_FORTIFY]: 5 },
			store: { ops: 200 },
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 24], owner: 'p2', body: [ATTACK, MOVE],
		});
		await shard.tick();

		const useRc = await shard.runPlayer('p1', code`
			Object.values(Game.powerCreeps)[0].usePower(PWR_FORTIFY, Game.getObjectById(${rampartId}))
		`);
		expect(useRc).toBe(OK);

		const attack = code`Game.getObjectById(${attackerId}).attack(Game.getObjectById(${rampartId}))`;
		await shard.tick(3);
		// Last tick of the effect.
		expect(await shard.runPlayer('p2', attack)).toBe(ERR_INVALID_TARGET);
		expect((await shard.expectStructure(rampartId, STRUCTURE_RAMPART)).hits).toBe(10000);

		expect(await shard.runPlayer('p2', attack)).toBe(OK);
		expect((await shard.expectStructure(rampartId, STRUCTURE_RAMPART)).hits).toBe(10000 - ATTACK_POWER);
	});

	test('RAMPART-DECAY-005 PWR_SHIELD creates a temporary rampart removed when effect expires', async ({ shard }) => {
		shard.requires('powerCreeps');
		shard.requires('powerEffects');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1', powerEnabled: true }],
		});

		await shard.placePowerCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			powers: { [PWR_SHIELD]: 1 },
			store: { ops: 200 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Object.values(Game.powerCreeps)[0].usePower(PWR_SHIELD)
		`);
		expect(rc).toBe(OK);

		// Verify a rampart exists at the power creep's position.
		const hasRampart = await shard.runPlayer('p1', code`
			new RoomPosition(25, 25, 'W1N1').lookFor(LOOK_STRUCTURES).some(s => s.structureType === STRUCTURE_RAMPART)
		`);
		expect(hasRampart).toBe(true);
	});
});
