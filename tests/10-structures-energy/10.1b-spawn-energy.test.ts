import { describe, test, expect, code,
	STRUCTURE_SPAWN, STRUCTURE_EXTENSION,
	SPAWN_ENERGY_CAPACITY, EXTENSION_ENERGY_CAPACITY,
} from '../../src/index.js';
import type { ShardFixture } from '../../src/fixture.js';

// Engine processor/intents/spawns/tick.js:44-47: a spawn gains 1 energy per
// tick while both the spawn and the room's spawn+extension total are below
// SPAWN_ENERGY_CAPACITY. The room total is what makes a fresh room recover
// from zero and what stops the trickle once extensions are full.
async function spawnEnergySeries(shard: ShardFixture, spawnId: string, samples: number) {
	const readings: number[] = [];
	for (let i = 0; i < samples; i++) {
		readings.push(await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).store.energy
		`) as number);
	}
	return readings;
}

describe('StructureSpawn energy regeneration', () => {
	test('SPAWN-REGEN-001 a spawn below capacity in a room below SPAWN_ENERGY_CAPACITY gains exactly 1 energy per tick until full', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: SPAWN_ENERGY_CAPACITY - 10 },
		});
		await shard.tick();

		const readings = await spawnEnergySeries(shard, spawnId, 14);
		expect(readings[0]).toBeLessThan(SPAWN_ENERGY_CAPACITY);
		const expected = readings.map((_, i) => Math.min(readings[0] + i, SPAWN_ENERGY_CAPACITY));
		expect(readings).toEqual(expected);
		expect(readings[readings.length - 1]).toBe(SPAWN_ENERGY_CAPACITY);
	});

	test('SPAWN-REGEN-002 the gate is the room total: a spawn below capacity does not regenerate once spawns and extensions hold SPAWN_ENERGY_CAPACITY', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 2);
		const spawnEnergy = 100;
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: spawnEnergy },
		});
		// Four extensions carry the rest of the room to exactly the threshold.
		const perExtension = EXTENSION_ENERGY_CAPACITY[2];
		const extensions = (SPAWN_ENERGY_CAPACITY - spawnEnergy) / perExtension;
		for (let i = 0; i < extensions; i++) {
			await shard.placeStructure('W1N1', {
				pos: [27 + i, 25], structureType: STRUCTURE_EXTENSION, owner: 'p1',
				store: { energy: perExtension },
			});
		}
		await shard.tick();

		const roomEnergy = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].energyAvailable
		`);
		expect(roomEnergy).toBe(SPAWN_ENERGY_CAPACITY);

		const readings = await spawnEnergySeries(shard, spawnId, 4);
		expect(readings).toEqual([spawnEnergy, spawnEnergy, spawnEnergy, spawnEnergy]);
	});
});
