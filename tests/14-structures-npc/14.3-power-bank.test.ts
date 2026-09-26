import { describe, test, expect, code,
	OK, ATTACK, MOVE, TOUGH,
	ATTACK_POWER, BODYPART_HITS,
	STRUCTURE_POWER_BANK, RESOURCE_POWER, FIND_DROPPED_RESOURCES,
	POWER_BANK_HIT_BACK, POWER_BANK_HITS,
} from '../../src/index.js';

describe('Power bank', () => {
	// ---- POWER-BANK-001: hit-back deals POWER_BANK_HIT_BACK * damage to the attacker ----
	test('POWER-BANK-001 attacking a power bank reflects POWER_BANK_HIT_BACK of the damage back to the attacker', async ({ shard }) => {
		shard.requires('powerBank');
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});

		const pbId = await shard.placeObject('W1N1', 'powerBank', {
			pos: [25, 25],
			power: 1000,
			hits: POWER_BANK_HITS,
			ticksToDecay: 50000,
		});

		// Attacker: 1 ATTACK + 4 TOUGH + 1 MOVE = 6 parts = 300 HP.
		// One attack deals ATTACK_POWER (30). Hit-back = 30 * 0.5 = 15.
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2',
			body: [ATTACK, TOUGH, TOUGH, TOUGH, TOUGH, MOVE],
		});

		const initialHp = 6 * BODYPART_HITS; // 300

		const rc = await shard.runPlayer('p2', code`
			const pb = Game.getObjectById(${pbId});
			Game.getObjectById(${attackerId}).attack(pb)
		`);
		expect(rc).toBe(OK);

		await shard.tick();

		const attacker = await shard.expectObject(attackerId, 'creep');
		const expectedReflect = ATTACK_POWER * POWER_BANK_HIT_BACK;
		expect(attacker.hits).toBe(initialHp - expectedReflect);
	});

	// ---- POWER-BANK-002: ticksToDecay counts down to removal ----
	test('POWER-BANK-002 ticksToDecay decrements each tick toward power bank removal', async ({ shard }) => {
		shard.requires('powerBank');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});

		const pbId = await shard.placeObject('W1N1', 'powerBank', {
			pos: [25, 25],
			power: 500,
			hits: POWER_BANK_HITS,
			ticksToDecay: 3,
		});
		await shard.tick();

		// The bank is removed during the tick that reads 1.
		const readings: (number | null)[] = [];
		for (let i = 0; i < 3; i++) {
			readings.push(await shard.runPlayer('p1', code`
				Game.getObjectById(${pbId})?.ticksToDecay ?? null
			`) as number | null);
		}
		expect(readings).toEqual([2, 1, null]);
	});

	// ---- POWER-BANK-004: destroyed power bank drops stored power on the same tile ----
	test('POWER-BANK-004 destroyed power bank drops its stored power as a resource on the tile', async ({ shard }) => {
		shard.requires('powerBank');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1' }],
		});

		const storedPower = 500;
		// hits=1 so a single ATTACK kills it (and the hit-back survives the attacker).
		const pbId = await shard.placeObject('W1N1', 'powerBank', {
			pos: [25, 25],
			power: storedPower,
			hits: 1,
			ticksToDecay: 50000,
		});
		const attackerId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [ATTACK, TOUGH, TOUGH, TOUGH, TOUGH, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).attack(Game.getObjectById(${pbId}))
		`);
		expect(rc).toBe(OK);
		// Bank dies this tick → becomes a ruin with store.power.
		// Power-bank ruin decayTime = gameTime + RUIN_DECAY_STRUCTURES.powerBank (10).
		// ruins/tick.js spills the store as a dropped resource on the first tick
		// that satisfies gameTime >= decayTime - 1 (i.e. 9 ticks later).
		// Dropped resources decay by ceil(amount / ENERGY_DECAY) each subsequent tick,
		// so we read the pile on the spill tick itself — before any decay applies.
		await shard.tick(9);

		const pb = await shard.getObject(pbId);
		expect(pb).toBeNull();

		const drops = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		const pile = drops.find(d =>
			d.resourceType === RESOURCE_POWER && d.pos.x === 25 && d.pos.y === 25,
		);
		expect(pile).toBeDefined();
		expect(pile!.amount).toBe(storedPower);
	});
});
