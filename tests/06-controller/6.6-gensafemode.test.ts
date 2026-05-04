import { describe, test, expect, code,
	OK, ERR_NOT_IN_RANGE, ERR_NOT_ENOUGH_RESOURCES,
	MOVE, CARRY,
	RESOURCE_GHODIUM,
	SAFE_MODE_COST,
} from '../../src/index.js';
import { ctrlGensafeValidationCases } from '../../src/matrices/ctrl-gensafe-validation.js';
import { spawnBusyCreep } from '../intent-validation-helpers.js';

describe('creep.generateSafeMode()', () => {
	test('CTRL-GENSAFE-001 generateSafeMode consumes SAFE_MODE_COST ghodium from the creep store', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const ctrlPos = await shard.getControllerPos('W1N1');

		const creepId = await shard.placeCreep('W1N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: [CARRY, CARRY, CARRY, CARRY, CARRY,
				CARRY, CARRY, CARRY, CARRY, CARRY,
				CARRY, CARRY, CARRY, CARRY, CARRY,
				CARRY, CARRY, CARRY, CARRY, CARRY, MOVE],
			store: { G: SAFE_MODE_COST },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).generateSafeMode(
				Game.rooms['W1N1'].controller
			)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const creep = await shard.expectObject(creepId, 'creep');
		expect(creep.store.G ?? 0).toBe(0);
	});

	test('CTRL-GENSAFE-002 generateSafeMode returns ERR_NOT_IN_RANGE when not adjacent to the controller', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const ctrlPos = await shard.getControllerPos('W1N1');

		const creepId = await shard.placeCreep('W1N1', {
			pos: [ctrlPos!.x + 2, ctrlPos!.y],
			owner: 'p1',
			body: [CARRY, CARRY, CARRY, CARRY, CARRY,
				CARRY, CARRY, CARRY, CARRY, CARRY,
				CARRY, CARRY, CARRY, CARRY, CARRY,
				CARRY, CARRY, CARRY, CARRY, CARRY, MOVE],
			store: { [RESOURCE_GHODIUM]: SAFE_MODE_COST },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).generateSafeMode(
				Game.rooms['W1N1'].controller
			)
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});

	test('CTRL-GENSAFE-003 generateSafeMode increments the controller\'s safeModeAvailable', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1', safeModeAvailable: 0 }],
		});
		const ctrlPos = await shard.getControllerPos('W1N1');

		const creepId = await shard.placeCreep('W1N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: [CARRY, CARRY, CARRY, CARRY, CARRY,
				CARRY, CARRY, CARRY, CARRY, CARRY,
				CARRY, CARRY, CARRY, CARRY, CARRY,
				CARRY, CARRY, CARRY, CARRY, CARRY, MOVE],
			store: { [RESOURCE_GHODIUM]: SAFE_MODE_COST },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).generateSafeMode(
				Game.rooms['W1N1'].controller
			)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const available = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.safeModeAvailable
		`) as number;
		expect(available).toBe(1);
	});

	test('CTRL-GENSAFE-004 generateSafeMode returns ERR_NOT_ENOUGH_RESOURCES when the creep lacks ghodium', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const ctrlPos = await shard.getControllerPos('W1N1');

		const creepId = await shard.placeCreep('W1N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: [CARRY, MOVE],
			// no ghodium
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).generateSafeMode(
				Game.rooms['W1N1'].controller
			)
		`);
		expect(rc).toBe(ERR_NOT_ENOUGH_RESOURCES);
	});

	for (const row of ctrlGensafeValidationCases) {
		test(`CTRL-GENSAFE-005:${row.label} generateSafeMode() validation returns the canonical code`, async ({ shard }) => {
			const blockers = new Set(row.blockers);
			const owner = blockers.has('not-owner') ? 'p2' : 'p1';
			if (owner === 'p2') {
				await shard.createShard({
					players: ['p1', 'p2'],
					rooms: [{ name: 'W1N1', rcl: 1, owner: 'p2' }],
				});
				if (!blockers.has('busy')) {
					await shard.placeCreep('W1N1', { pos: [20, 20], owner: 'p1', body: [MOVE] });
				}
			} else {
				await shard.ownedRoom('p1');
			}
			const ctrlPos = await shard.getControllerPos('W1N1');
			const richBody = [...Array.from({ length: 20 }, () => CARRY), MOVE];
			const creepId = blockers.has('busy')
				? await spawnBusyCreep(shard, {
					owner,
					observerOwner: owner === 'p2' ? 'p1' : undefined,
					body: [MOVE, MOVE, MOVE],
				})
				: await shard.placeCreep('W1N1', {
					pos: blockers.has('range') ? [25, 25] : [ctrlPos!.x + 1, ctrlPos!.y],
					owner,
					body: blockers.has('not-enough') ? [CARRY, MOVE] : richBody,
					store: blockers.has('not-enough') ? {} : { [RESOURCE_GHODIUM]: SAFE_MODE_COST },
				});
			const sourceId = blockers.has('invalid-target')
				? await shard.placeSource('W1N1', { pos: [ctrlPos!.x + 1, ctrlPos!.y + 1] })
				: null;

			const rc = blockers.has('invalid-target')
				? await shard.runPlayer('p1', code`
					Game.getObjectById(${creepId}).generateSafeMode(Game.getObjectById(${sourceId}))
				`)
				: await shard.runPlayer('p1', code`
					Game.getObjectById(${creepId}).generateSafeMode(Game.rooms['W1N1'].controller)
				`);
			expect(rc).toBe(row.expectedRc);
		});
	}
});
