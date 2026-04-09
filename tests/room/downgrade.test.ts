import { describe, test, expect, code,
	CONTROLLER_DOWNGRADE,
} from '../../src/index.js';
import { hasDocumentedAdapterLimitation } from '../support/limitations.js';

const downgradeTest = hasDocumentedAdapterLimitation('controllerDowngrade') ? test.skip : test;

describe('Controller downgrade', () => {
	downgradeTest('CTRL-DOWNGRADE-001 controller loses a level when ticksToDowngrade reaches 0', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1', ticksToDowngrade: 3 }],
		});
		await shard.tick();

		// Verify starting level.
		const before = await shard.runPlayer('p1', code`
			({ level: Game.rooms['W1N1'].controller.level,
			   ttd: Game.rooms['W1N1'].controller.ticksToDowngrade })
		`) as { level: number; ttd: number };
		expect(before.level).toBe(2);
		expect(before.ttd).toBeLessThanOrEqual(3);

		// Advance past the downgrade timer.
		await shard.tick(before.ttd + 1);

		const after = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.level
		`) as number;
		expect(after).toBe(1);
	});

	downgradeTest('CTRL-DOWNGRADE-002 RCL 1 controller becomes unowned at level 0', async ({ shard }) => {
		// Use two rooms so p1 stays active after losing W1N1.
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1', ticksToDowngrade: 3 },
				{ name: 'W2N1', rcl: 1, owner: 'p1' },
			],
		});
		// Place a creep in W1N1 for visibility after losing ownership.
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: ['move'],
		});
		await shard.tick();

		const ttd = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.ticksToDowngrade
		`) as number;

		// Advance past the downgrade timer.
		await shard.tick(ttd + 1);

		const result = await shard.runPlayer('p1', code`
			const ctrl = Game.rooms['W1N1']?.controller;
			ctrl ? ({ level: ctrl.level, my: ctrl.my }) : null
		`) as { level: number; my: boolean } | null;
		expect(result).not.toBeNull();
		expect(result!.level).toBe(0);
		expect(result!.my).toBe(false);
	});

	downgradeTest('CTRL-DOWNGRADE-003 upgradeController resets the downgrade timer', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1', ticksToDowngrade: 50 }],
		});
		await shard.tick();

		const ttdBefore = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.ticksToDowngrade
		`) as number;

		// Advance a few ticks so the timer decreases.
		await shard.tick(5);

		const ttdMid = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.ticksToDowngrade
		`) as number;
		expect(ttdMid).toBeLessThan(ttdBefore);

		// Upgrade the controller to reset the timer.
		const ctrlPos = await shard.getControllerPos('W1N1');
		expect(ctrlPos).not.toBeNull();
		const workerId = await shard.placeCreep('W1N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y], owner: 'p1',
			body: ['work', 'carry', 'move'],
			store: { energy: 50 },
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${workerId}).upgradeController(
				Game.rooms['W1N1'].controller
			)
		`);

		const ttdAfter = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].controller.ticksToDowngrade
		`) as number;
		// Upgrading should have increased the timer.
		expect(ttdAfter).toBeGreaterThan(ttdMid);
	});
});
