import { describe, test, expect, code, OK, ERR_INVALID_TARGET, ERR_NOT_OWNER, ERR_INVALID_ARGS, ERR_TIRED, ERR_RCL_NOT_ENOUGH, ERR_NOT_ENOUGH_ENERGY, ERR_FULL, ERR_NOT_IN_RANGE, STRUCTURE_LINK, STRUCTURE_STORAGE, LINK_LOSS_RATIO, LINK_COOLDOWN, LINK_CAPACITY } from '../../src/index.js';
import { knownParityGap } from '../support/parity-gaps.js';

describe('StructureLink', () => {
	test('LINK-001 transferEnergy returns OK, decreases source energy by amount, increases target energy by amount minus loss', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 5, owner: 'p1' }],
		});
		const link1 = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LINK, owner: 'p1',
			store: { energy: 400 },
		});
		const link2 = await shard.placeStructure('W1N1', {
			pos: [25, 35], structureType: STRUCTURE_LINK, owner: 'p1',
			store: { energy: 0 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${link1}).transferEnergy(Game.getObjectById(${link2}), 100)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const src = await shard.expectStructure(link1, STRUCTURE_LINK);
		expect(src.store.energy).toBe(300);
		const dst = await shard.expectStructure(link2, STRUCTURE_LINK);
		expect(dst.store.energy).toBe(100 - Math.ceil(100 * LINK_LOSS_RATIO));
	});

	test('LINK-002 transferEnergy sets source cooldown to LINK_COOLDOWN * Chebyshev distance', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 5, owner: 'p1' }],
		});
		const link1 = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LINK, owner: 'p1',
			store: { energy: 400 },
		});
		const link2 = await shard.placeStructure('W1N1', {
			pos: [25, 35], structureType: STRUCTURE_LINK, owner: 'p1',
			store: { energy: 0 },
		});

		await shard.runPlayer('p1', code`
			Game.getObjectById(${link1}).transferEnergy(Game.getObjectById(${link2}), 100)
		`);
		await shard.tick();

		// distance = max(abs(25-25), abs(25-35)) = 10
		// cooldown = LINK_COOLDOWN * 10
		// The link should be on cooldown for 9 subsequent ticks and usable on the 10th
		const expectedCooldown = LINK_COOLDOWN * 10;
		for (let tick = 1; tick < expectedCooldown; tick += 1) {
			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${link1}).transferEnergy(Game.getObjectById(${link2}), 100)
			`);
			expect(rc).toBe(ERR_TIRED);
			await shard.tick();
		}

		const ready = await shard.runPlayer('p1', code`
			Game.getObjectById(${link1}).transferEnergy(Game.getObjectById(${link2}), 100)
		`);
		expect(ready).toBe(OK);
	});

	test('LINK-003 transfer loss rounds up: sending 1 energy delivers 0', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 5, owner: 'p1' }],
		});
		const link1 = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LINK, owner: 'p1',
			store: { energy: 100 },
		});
		const link2 = await shard.placeStructure('W1N1', {
			pos: [26, 25], structureType: STRUCTURE_LINK, owner: 'p1',
			store: { energy: 0 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${link1}).transferEnergy(Game.getObjectById(${link2}), 1)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const dst = await shard.expectStructure(link2, STRUCTURE_LINK);
		// ceil(1 * 0.03) = 1, so 1 - 1 = 0; stores omit zero-valued keys
		expect(dst.store.energy ?? 0).toBe(0);
	});

	knownParityGap('link-self-transfer')('LINK-004 transferEnergy returns ERR_INVALID_TARGET when target is the source link itself', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 5, owner: 'p1' }],
		});
		const link1 = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LINK, owner: 'p1',
			store: { energy: 100 },
		});

		const rc = await shard.runPlayer('p1', code`
			const link = Game.getObjectById(${link1});
			link.transferEnergy(link, 50)
		`);
		expect(rc).toBe(ERR_INVALID_TARGET);
	});

	test('LINK-005 transferEnergy returns ERR_INVALID_TARGET when target is not a StructureLink', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 5, owner: 'p1' }],
		});
		const link1 = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LINK, owner: 'p1',
			store: { energy: 100 },
		});
		const storage = await shard.placeStructure('W1N1', {
			pos: [26, 25], structureType: STRUCTURE_STORAGE, owner: 'p1',
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${link1}).transferEnergy(Game.getObjectById(${storage}), 50)
		`);
		expect(rc).toBe(ERR_INVALID_TARGET);
	});

	knownParityGap('link-cross-owner')('LINK-006 transferEnergy returns ERR_NOT_OWNER when target link belongs to a different player', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 5, owner: 'p1' },
				{ name: 'W2N1', rcl: 5, owner: 'p2' },
			],
		});
		const link1 = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LINK, owner: 'p1',
			store: { energy: 100 },
		});
		const link2 = await shard.placeStructure('W1N1', {
			pos: [26, 25], structureType: STRUCTURE_LINK, owner: 'p2',
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${link1}).transferEnergy(Game.getObjectById(${link2}), 50)
		`);
		expect(rc).toBe(ERR_NOT_OWNER);
	});

	test('LINK-007 transferEnergy returns ERR_INVALID_ARGS for a negative amount', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 5, owner: 'p1' }],
		});
		const link1 = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LINK, owner: 'p1',
			store: { energy: 100 },
		});
		const link2 = await shard.placeStructure('W1N1', {
			pos: [26, 25], structureType: STRUCTURE_LINK, owner: 'p1',
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${link1}).transferEnergy(Game.getObjectById(${link2}), -10)
		`);
		expect(rc).toBe(ERR_INVALID_ARGS);
	});

	test('LINK-008 transferEnergy returns ERR_TIRED while source link has cooldown > 0', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 5, owner: 'p1' }],
		});
		// Distance 10 → cooldown = LINK_COOLDOWN * 10 = 10 ticks
		const link1 = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LINK, owner: 'p1',
			store: { energy: 400 },
		});
		const link2 = await shard.placeStructure('W1N1', {
			pos: [25, 35], structureType: STRUCTURE_LINK, owner: 'p1',
			store: { energy: 0 },
		});

		// Transfer to put source on cooldown
		const first = await shard.runPlayer('p1', code`
			Game.getObjectById(${link1}).transferEnergy(Game.getObjectById(${link2}), 50)
		`);
		expect(first).toBe(OK);
		await shard.tick();

		// Cooldown should still be active (10 - 1 = 9 remaining)
		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${link1}).transferEnergy(Game.getObjectById(${link2}), 50)
		`);
		expect(rc).toBe(ERR_TIRED);
	});

	test('LINK-009 transferEnergy returns ERR_RCL_NOT_ENOUGH when source link is inactive', async ({ shard }) => {
		// RCL 4 allows 0 links per CONTROLLER_STRUCTURES; RCL 5 allows 2
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 4, owner: 'p1' }],
		});
		const link1 = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LINK, owner: 'p1',
			store: { energy: 100 },
		});
		const link2 = await shard.placeStructure('W1N1', {
			pos: [26, 25], structureType: STRUCTURE_LINK, owner: 'p1',
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${link1}).transferEnergy(Game.getObjectById(${link2}), 50)
		`);
		expect(rc).toBe(ERR_RCL_NOT_ENOUGH);
	});

	test('LINK-010 transferEnergy returns ERR_NOT_ENOUGH_ENERGY when source lacks the requested amount', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 5, owner: 'p1' }],
		});
		const link1 = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LINK, owner: 'p1',
			store: { energy: 10 },
		});
		const link2 = await shard.placeStructure('W1N1', {
			pos: [26, 25], structureType: STRUCTURE_LINK, owner: 'p1',
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${link1}).transferEnergy(Game.getObjectById(${link2}), 100)
		`);
		expect(rc).toBe(ERR_NOT_ENOUGH_ENERGY);
	});

	test('LINK-011 transferEnergy returns ERR_FULL when target lacks free capacity for the amount', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 5, owner: 'p1' }],
		});
		const link1 = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LINK, owner: 'p1',
			store: { energy: 100 },
		});
		const link2 = await shard.placeStructure('W1N1', {
			pos: [26, 25], structureType: STRUCTURE_LINK, owner: 'p1',
			store: { energy: LINK_CAPACITY },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${link1}).transferEnergy(Game.getObjectById(${link2}), 100)
		`);
		expect(rc).toBe(ERR_FULL);
	});

	test('LINK-012 transferEnergy returns ERR_NOT_IN_RANGE when target is in a different room', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 5, owner: 'p1' },
				{ name: 'W2N1', rcl: 5, owner: 'p1' },
			],
		});
		const link1 = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LINK, owner: 'p1',
			store: { energy: 100 },
		});
		const link2 = await shard.placeStructure('W2N1', {
			pos: [25, 25], structureType: STRUCTURE_LINK, owner: 'p1',
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${link1}).transferEnergy(Game.getObjectById(${link2}), 50)
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});
});
