import { describe, test, expect, code,
	OK, ERR_NOT_IN_RANGE, ERR_NOT_ENOUGH_RESOURCES, ERR_TIRED,
	WORK, CARRY, MOVE, body,
	STRUCTURE_EXTRACTOR, HARVEST_MINERAL_POWER, EXTRACTOR_COOLDOWN,
} from '../../src/index.js';
import { knownParityGap } from '../support/parity-gaps.js';

describe('creep.harvest(mineral)', () => {
	test('HARVEST-MINERAL-001 harvest on a mineral with an extractor returns OK and deposits HARVEST_MINERAL_POWER per WORK part', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 6);
		await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_EXTRACTOR, owner: 'p1',
		});
		const mineralId = await shard.placeMineral('W1N1', {
			pos: [25, 26], mineralType: 'H', mineralAmount: 50000,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: body(2, WORK, CARRY, MOVE),
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${mineralId}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		// 2 WORK parts * HARVEST_MINERAL_POWER = 2
		expect(creep.store.H).toBe(2 * HARVEST_MINERAL_POWER);
	});

	test('HARVEST-MINERAL-002 harvest reduces mineral amount by the harvested quantity', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 6);
		await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_EXTRACTOR, owner: 'p1',
		});
		const mineralId = await shard.placeMineral('W1N1', {
			pos: [25, 26], mineralType: 'H', mineralAmount: 50000,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${mineralId}))
		`);
		await shard.tick();

		const mineral = await shard.expectObject(mineralId, 'mineral');
		expect(mineral.mineralAmount).toBe(50000 - HARVEST_MINERAL_POWER);
	});

	knownParityGap('extractor-cooldown-off-by-one')('HARVEST-MINERAL-003 extractor enters cooldown after harvest', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 6);
		const extractorId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_EXTRACTOR, owner: 'p1',
		});
		const mineralId = await shard.placeMineral('W1N1', {
			pos: [25, 26], mineralType: 'H', mineralAmount: 50000,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${mineralId}))
		`);
		await shard.tick();

		// Cooldown is set to EXTRACTOR_COOLDOWN on harvest, then decremented
		// by 1 during the tick that processes the intent.
		const extractor = await shard.expectStructure(extractorId, STRUCTURE_EXTRACTOR);
		expect(extractor.cooldown).toBe(EXTRACTOR_COOLDOWN - 1);
	});

	test('HARVEST-MINERAL-004 harvest returns ERR_NOT_ENOUGH_RESOURCES on depleted mineral', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 6);
		await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_EXTRACTOR, owner: 'p1',
		});
		const mineralId = await shard.placeMineral('W1N1', {
			pos: [25, 26], mineralType: 'H', mineralAmount: 0,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${mineralId}))
		`);
		expect(rc).toBe(ERR_NOT_ENOUGH_RESOURCES);
	});
});
