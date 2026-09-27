import { describe, test, expect, code, OK, ERR_TIRED, STRUCTURE_LINK, STRUCTURE_STORAGE, STRUCTURE_RAMPART, LINK_LOSS_RATIO, LINK_COOLDOWN, LINK_CAPACITY, STORAGE_CAPACITY, } from '../../src/index.js';
import { linkValidationCases } from '../../src/matrices/link-validation.js';
import { staleReceiverCases } from '../../src/matrices/stale-receiver.js';
import { staleArgumentCases } from '../../src/matrices/stale-argument.js';
import { expectStaleArgumentRejected } from '../intent-validation-helpers.js';

const staleLinkTransferCase = staleReceiverCases.find(row => row.key === 'linkTransferEnergy')!;
const staleArgLinkTransferCase = staleArgumentCases.find(row => row.key === 'linkTransferEnergy')!;

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
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${link1}).transferEnergy(Game.getObjectById(${link2}), 100)
		`);
		await shard.tick();

		// distance = max(abs(25-25), abs(25-35)) = 10
		// After runPlayer (1 tick: intent processed, cooldown set and decremented)
		// + tick() (1 more tick: cooldown decremented again), observed cooldown is
		// LINK_COOLDOWN * distance - 2.
		const distance = 10;
		const expectedCooldown = LINK_COOLDOWN * distance - 2;
		const link = await shard.expectStructure(link1, STRUCTURE_LINK);
		expect(link.cooldown).toBe(expectedCooldown);

		// Wait for cooldown to almost expire, then verify ERR_TIRED
		await shard.tick(expectedCooldown - 2);
		const stillTired = await shard.runPlayer('p1', code`
			Game.getObjectById(${link1}).transferEnergy(Game.getObjectById(${link2}), 100)
		`);
		expect(stillTired).toBe(ERR_TIRED);

		// One more tick to fully expire, then transfer should succeed
		await shard.tick();
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

	test('LINK-013 transferEnergy with no amount transfers all stored energy', async ({ shard }) => {
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
			Game.getObjectById(${link1}).transferEnergy(Game.getObjectById(${link2}))
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const src = await shard.expectStructure(link1, STRUCTURE_LINK);
		const dst = await shard.expectStructure(link2, STRUCTURE_LINK);
		// Full 400 transferred; target receives 400 minus LINK_LOSS_RATIO loss (rounded up).
		expect(src.store.energy ?? 0).toBe(0);
		expect(dst.store.energy).toBe(400 - Math.ceil(400 * LINK_LOSS_RATIO));
	});

	test(`${staleLinkTransferCase.catalogId}:${staleLinkTransferCase.label} stale cached StructureLink.transferEnergy() throws a runtime error`, async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 5, owner: 'p1' }],
		});
		const sourceId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LINK, owner: 'p1',
			store: { energy: 400 },
		});
		const targetId = await shard.placeStructure('W1N1', {
			pos: [26, 25], structureType: STRUCTURE_LINK, owner: 'p1',
			store: { energy: 0 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const link = Game.getObjectById(${sourceId});
			globalThis.__screepsOkStaleLink = link;
			link.destroy()
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const err = await shard.expectRunPlayerError('p1', code`
			globalThis.__screepsOkStaleLink.transferEnergy(Game.getObjectById(${targetId}), 50)
		`, 'runtime');
		expect(err.errorKind).toBe('runtime');
	});

	for (const row of linkValidationCases) {
		test(`LINK-014:${row.label} transferEnergy() validation returns the canonical code`, async ({ shard }) => {
			const blockers = shard.validationBlockers(row);
			const sourceOwner = blockers.has('source-not-owner') ? 'p2' : 'p1';
			const targetOwner = blockers.has('target-not-owner') ? 'p2' : 'p1';
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [
					{ name: 'W1N1', rcl: blockers.has('rcl') ? 4 : 5, owner: 'p1' },
					{ name: 'W2N1', rcl: 5, owner: 'p1' },
				],
			});
			const sourceId = await shard.placeStructure('W1N1', {
				pos: [25, 25],
				structureType: STRUCTURE_LINK,
				owner: sourceOwner,
				store: blockers.has('not-enough') ? { energy: 0 }
					// Less than the amount sent below.
					: blockers.has('not-enough-amount') ? { energy: 10 }
					: { energy: 100 },
				...(blockers.has('cooldown') ? { cooldown: 10 } : {}),
			});
			if (blockers.has('source-not-owner')) {
				await shard.placeStructure('W1N1', {
					pos: [25, 25],
					structureType: STRUCTURE_RAMPART,
					owner: 'p1',
				});
			}
			const targetRoom = blockers.has('range') ? 'W2N1' : 'W1N1';
			const targetId = blockers.has('self-target') ? sourceId
				: blockers.has('invalid-target')
				? await shard.placeStructure(targetRoom, {
					pos: [26, 25],
					structureType: STRUCTURE_STORAGE,
					owner: targetOwner,
					...(blockers.has('full') ? { store: { energy: STORAGE_CAPACITY } } : {}),
				})
				: await shard.placeStructure(targetRoom, {
					pos: [26, 25],
					structureType: STRUCTURE_LINK,
					owner: targetOwner,
					store: blockers.has('full') ? { energy: LINK_CAPACITY } : { energy: 0 },
				});
			const amount = blockers.has('invalid-args') ? -1 : 50;

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${sourceId}).transferEnergy(Game.getObjectById(${targetId}), ${amount})
			`);
			expect(rc).toBe(row.expectedRc);
		});
	}

	test(`${staleArgLinkTransferCase.catalogId}:${staleArgLinkTransferCase.label} StructureLink.transferEnergy() rejects a stale cached Link target`, async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 5, owner: 'p1' }],
		});
		const sourceId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LINK, owner: 'p1',
			store: { energy: 400 },
		});
		const targetId = await shard.placeStructure('W1N1', {
			pos: [26, 25], structureType: STRUCTURE_LINK, owner: 'p1',
			store: { energy: 0 },
		});
		await shard.tick();

		const rc1 = await shard.runPlayer('p1', code`
			globalThis.__screepsOkStaleArgLink = Game.getObjectById(${targetId});
			globalThis.__screepsOkStaleArgLink.destroy()
		`);
		expect(rc1).toBe(OK);
		expect(await shard.getObject(targetId)).toBeNull();

		await expectStaleArgumentRejected(shard, 'p1', staleArgLinkTransferCase, code`
			Game.getObjectById(${sourceId}).transferEnergy(globalThis.__screepsOkStaleArgLink, 50)
		`);
		const source = await shard.expectStructure(sourceId, STRUCTURE_LINK);
		expect(source.store.energy).toBe(400);
	});
});
