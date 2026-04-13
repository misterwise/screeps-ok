import { describe, test, expect, code, body, OK, ERR_NOT_IN_RANGE, ERR_NO_BODYPART, ERR_NOT_ENOUGH_RESOURCES,
	WORK, CARRY, MOVE, STRUCTURE_ROAD, BUILD_POWER } from '../../src/index.js';

describe('creep.build()', () => {
	test('BUILD-001 increases site progress by BUILD_POWER per WORK part', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});

		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25],
			owner: 'p1',
			body: [WORK, CARRY, MOVE],
			store: { energy: 50 },
		});

		const siteId = await shard.placeSite('W1N1', {
			pos: [25, 26],
			owner: 'p1',
			structureType: STRUCTURE_ROAD,
		});

		const returnCode = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			const site = Game.getObjectById(${siteId});
			creep.build(site)
		`);
		expect(returnCode).toBe(OK);

		await shard.tick();

		const site = await shard.expectObject(siteId, 'site');
		expect(site.progress).toBe(BUILD_POWER);
	});

	test('BUILD-002 spends 1 energy per build progress point', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});

		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25],
			owner: 'p1',
			body: [WORK, CARRY, MOVE],
			store: { energy: 50 },
		});

		const siteId = await shard.placeSite('W1N1', {
			pos: [25, 26],
			owner: 'p1',
			structureType: STRUCTURE_ROAD,
		});

		const returnCode = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			const site = Game.getObjectById(${siteId});
			creep.build(site)
		`);
		expect(returnCode).toBe(OK);

		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.energy).toBe(50 - BUILD_POWER);
	});

	test('BUILD-003 returns ERR_NOT_IN_RANGE when too far', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});

		const creepId = await shard.placeCreep('W1N1', {
			pos: [10, 10],
			owner: 'p1',
			body: [WORK, CARRY, MOVE],
			store: { energy: 50 },
		});

		const siteId = await shard.placeSite('W1N1', {
			pos: [20, 20],
			owner: 'p1',
			structureType: STRUCTURE_ROAD,
		});

		const returnCode = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			const site = Game.getObjectById(${siteId});
			creep.build(site)
		`);
		expect(returnCode).toBe(ERR_NOT_IN_RANGE);
	});

	test('BUILD-006 build() returns OK on success', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
			store: { energy: 50 },
		});
		const siteId = await shard.placeSite('W1N1', {
			pos: [25, 26], owner: 'p1', structureType: STRUCTURE_ROAD,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).build(Game.getObjectById(${siteId}))
		`);
		expect(rc).toBe(OK);
	});

	test('BUILD-005 build() returns OK at Chebyshev range 3 and ERR_NOT_IN_RANGE at range 4', async ({ shard }) => {
		// Engine creeps.js + processor build.js: range check is
		// `Math.abs(dx) > 3 || Math.abs(dy) > 3` (Chebyshev). A diagonal site
		// at (28,28) is range 3 → OK; (29,29) is range 4 → ERR_NOT_IN_RANGE.
		await shard.ownedRoom('p1');
		const nearCreep = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
			store: { energy: 50 },
		});
		const farCreep = await shard.placeCreep('W1N1', {
			pos: [10, 10], owner: 'p1',
			body: [WORK, CARRY, MOVE],
			store: { energy: 50 },
		});
		const nearSite = await shard.placeSite('W1N1', {
			pos: [28, 28], owner: 'p1', structureType: STRUCTURE_ROAD,
		});
		const farSite = await shard.placeSite('W1N1', {
			pos: [14, 14], owner: 'p1', structureType: STRUCTURE_ROAD,
		});

		const result = await shard.runPlayer('p1', code`({
			rangeThree: Game.getObjectById(${nearCreep}).build(Game.getObjectById(${nearSite})),
			rangeFour: Game.getObjectById(${farCreep}).build(Game.getObjectById(${farSite})),
		})`) as { rangeThree: number; rangeFour: number };
		expect(result.rangeThree).toBe(OK);
		expect(result.rangeFour).toBe(ERR_NOT_IN_RANGE);
	});

	test('BUILD-007 returns ERR_NO_BODYPART when the creep has no WORK parts', async ({ shard }) => {
		// Engine creeps.js:735 — `_hasActiveBodypart(body, WORK)` precedes the
		// energy check, so a CARRY+MOVE creep with energy still gets ERR_NO_BODYPART.
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [CARRY, MOVE],
			store: { energy: 50 },
		});
		const siteId = await shard.placeSite('W1N1', {
			pos: [25, 26], owner: 'p1', structureType: STRUCTURE_ROAD,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).build(Game.getObjectById(${siteId}))
		`);
		expect(rc).toBe(ERR_NO_BODYPART);
	});

	test('BUILD-008 returns ERR_NOT_ENOUGH_RESOURCES when the creep has no energy', async ({ shard }) => {
		// Engine creeps.js:738 — energy check happens after the body part check.
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
			// no store: empty CARRY → no energy
		});
		const siteId = await shard.placeSite('W1N1', {
			pos: [25, 26], owner: 'p1', structureType: STRUCTURE_ROAD,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).build(Game.getObjectById(${siteId}))
		`);
		expect(rc).toBe(ERR_NOT_ENOUGH_RESOURCES);
	});

	test('BUILD-010 partial build uses only available energy when below full build amount', async ({ shard }) => {
		// Engine build.js:69 — buildEffect = min(buildPower, buildRemaining, energy).
		// 5 WORK = 25 full build, but only 3 energy stored → progress advances 3,
		// energy spent 3.
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: body(5, WORK, CARRY, MOVE),
			store: { energy: 3 },
		});
		const siteId = await shard.placeSite('W1N1', {
			pos: [25, 26], owner: 'p1', structureType: STRUCTURE_ROAD,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).build(Game.getObjectById(${siteId}))
		`);
		expect(rc).toBe(OK);

		const site = await shard.expectObject(siteId, 'site');
		const creep = await shard.expectObject(creepId, 'creep');
		expect(site.progress).toBe(3);
		expect(creep.store.energy ?? 0).toBe(0);
		// Sanity: full build amount is 5 × BUILD_POWER, but progress is capped at energy.
		expect(site.progress).toBeLessThan(5 * BUILD_POWER);
	});

	test('BUILD-009 a creep can build another player\'s construction site', async ({ shard }) => {
		// Engine build.js never checks site ownership. p1's creep can advance
		// progress on a site placed by p2. (Catalog uses "allied" loosely —
		// vanilla has no alliance system; the rule is "any visible site".)
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 2, owner: 'p1' },
				{ name: 'W2N1', rcl: 2, owner: 'p2' },
			],
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, CARRY, MOVE],
			store: { energy: 50 },
		});
		const siteId = await shard.placeSite('W1N1', {
			pos: [25, 26], owner: 'p2', structureType: STRUCTURE_ROAD,
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).build(Game.getObjectById(${siteId}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const site = await shard.expectObject(siteId, 'site');
		expect(site.progress).toBe(BUILD_POWER);
	});
});
