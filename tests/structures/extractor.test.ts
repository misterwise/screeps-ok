import { describe, test, expect, code, OK, ERR_NOT_FOUND, ERR_NOT_OWNER, ERR_RCL_NOT_ENOUGH, ERR_TIRED, WORK, CARRY, MOVE, STRUCTURE_EXTRACTOR, EXTRACTOR_COOLDOWN, HARVEST_MINERAL_POWER } from '../../src/index.js';
import { knownParityGap } from '../support/parity-gaps.js';

describe('StructureExtractor', () => {
	test('EXTRACTOR-001 harvest(mineral) returns OK and reduces mineralAmount', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 6, owner: 'p1' }],
		});
		const mineralId = await shard.placeMineral('W1N1', {
			pos: [25, 25], mineralType: 'H', mineralAmount: 50000,
		});
		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_EXTRACTOR, owner: 'p1',
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${mineralId}))
		`);
		expect(rc).toBe(OK);

		const mineral = await shard.expectObject(mineralId, 'mineral');
		expect(mineral.mineralAmount).toBe(50000 - HARVEST_MINERAL_POWER);
	});

	knownParityGap('extractor-cooldown-off-by-one')('EXTRACTOR-001 harvest(mineral) sets extractor cooldown to EXTRACTOR_COOLDOWN', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 6, owner: 'p1' }],
		});
		const mineralId = await shard.placeMineral('W1N1', {
			pos: [25, 25], mineralType: 'H', mineralAmount: 50000,
		});
		const extractorId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_EXTRACTOR, owner: 'p1',
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${mineralId}))
		`);

		const extractor = await shard.expectStructure(extractorId, STRUCTURE_EXTRACTOR);
		expect(extractor.cooldown).toBe(EXTRACTOR_COOLDOWN);
	});

	test('EXTRACTOR-002 harvest(mineral) returns ERR_NOT_FOUND when no extractor is present', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 6, owner: 'p1' }],
		});
		const mineralId = await shard.placeMineral('W1N1', {
			pos: [25, 25], mineralType: 'H', mineralAmount: 50000,
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${mineralId}))
		`);
		expect(rc).toBe(ERR_NOT_FOUND);
	});

	test('EXTRACTOR-003 harvest(mineral) returns ERR_NOT_OWNER when extractor is not owned by the player', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 6, owner: 'p1' },
				{ name: 'W2N1', rcl: 6, owner: 'p2' },
			],
		});
		const mineralId = await shard.placeMineral('W1N1', {
			pos: [25, 25], mineralType: 'H', mineralAmount: 50000,
		});
		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_EXTRACTOR, owner: 'p2',
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${mineralId}))
		`);
		expect(rc).toBe(ERR_NOT_OWNER);
	});

	test('EXTRACTOR-004 harvest(mineral) returns ERR_RCL_NOT_ENOUGH when extractor is inactive', async ({ shard }) => {
		// RCL 5 allows 0 extractors per CONTROLLER_STRUCTURES; RCL 6 allows 1
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 5, owner: 'p1' }],
		});
		const mineralId = await shard.placeMineral('W1N1', {
			pos: [25, 25], mineralType: 'H', mineralAmount: 50000,
		});
		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_EXTRACTOR, owner: 'p1',
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${mineralId}))
		`);
		expect(rc).toBe(ERR_RCL_NOT_ENOUGH);
	});

	test('EXTRACTOR-005 harvest(mineral) returns ERR_TIRED while extractor is on cooldown', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 6, owner: 'p1' }],
		});
		const mineralId = await shard.placeMineral('W1N1', {
			pos: [25, 25], mineralType: 'H', mineralAmount: 50000,
		});
		await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_EXTRACTOR, owner: 'p1',
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [WORK, CARRY, MOVE],
		});
		await shard.tick();

		// First harvest to put extractor on cooldown
		const first = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${mineralId}))
		`);
		expect(first).toBe(OK);
		await shard.tick();

		// Extractor cooldown is EXTRACTOR_COOLDOWN (5); after one tick decrement it's 4
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).harvest(Game.getObjectById(${mineralId}))
		`);
		expect(rc).toBe(ERR_TIRED);
	});
});
