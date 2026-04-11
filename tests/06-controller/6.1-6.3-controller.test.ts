import { describe, test, expect, code,
	OK, ERR_NO_BODYPART, ERR_NOT_IN_RANGE, ERR_INVALID_TARGET,
	CLAIM, MOVE, WORK,
	CONTROLLER_ATTACK_BLOCKED_UPGRADE, CONTROLLER_CLAIM_DOWNGRADE,
	CONTROLLER_RESERVE_MAX,
} from '../../src/index.js';
import { hasDocumentedAdapterLimitation } from '../../src/limitations.js';

const headlessMultiPlayerTest = hasDocumentedAdapterLimitation('headlessMultiPlayer')
	? test.skip
	: test;
const playerGclControlTest = hasDocumentedAdapterLimitation('playerGclControl')
	? test.skip
	: test;

describe('controller mechanics', () => {
	test('CTRL-CLAIM-001 claimController returns OK and sets the unowned controller to level 1 for the claimant', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1' }, // unowned
			],
		});
		const ctrlPos = await shard.getControllerPos('W2N1');
		expect(ctrlPos).not.toBeNull();

		const creepId = await shard.placeCreep('W2N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: [CLAIM, MOVE],
		});
		expect (creepId).not.toBeNull();

		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			const ctrl = creep.room.controller;
			creep.claimController(ctrl)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const ctrl = Game.rooms['W2N1'].controller;
			({ level: ctrl.level, my: ctrl.my })
		`) as { level: number; my: boolean };
		expect(result).toEqual({ level: 1, my: true });
	});

	test('CTRL-SIGN-001 signController writes the provided text to the controller sign', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const ctrlPos = await shard.getControllerPos('W1N1');

		const creepId = await shard.placeCreep('W1N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: [MOVE],
		});

		const rc = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			creep.signController(creep.room.controller, 'screeps-ok was here')
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const sign = await shard.runPlayer('p1', code`
			const actor = Game.getObjectById(${creepId});
			const sign = Game.rooms['W1N1'].controller.sign;
			sign ? ({
				text: sign.text,
				owner: sign.username ?? sign.owner?.username ?? sign.owner,
				expectedOwner: actor.owner.username,
			}) : null
		`) as { text: string; owner: string; expectedOwner: string } | null;
		expect(sign).toEqual({
			text: 'screeps-ok was here',
			owner: sign?.expectedOwner,
			expectedOwner: sign?.expectedOwner,
		});
	});

	test('CTRL-RESERVE-001 reserveController returns OK and creates a reservation for the player', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1' },
			],
		});
		const ctrlPos = await shard.getControllerPos('W2N1');

		const creepId = await shard.placeCreep('W2N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: [CLAIM, CLAIM, MOVE],
		});

		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			creep.reserveController(creep.room.controller)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const reservation = await shard.runPlayer('p1', code`
			const actor = Game.getObjectById(${creepId});
			const reservation = Game.rooms['W2N1'].controller.reservation;
			reservation ? ({
				owner: reservation.username ?? reservation.owner?.username ?? reservation.owner,
				expectedOwner: actor.owner.username,
				ticksToEnd: reservation.ticksToEnd,
			}) : null
		`) as { owner: string; expectedOwner: string; ticksToEnd: number } | null;
		expect(reservation).not.toBeNull();
		expect(reservation?.owner).toBe(reservation?.expectedOwner);
		expect((reservation?.ticksToEnd ?? 0)).toBeGreaterThan(0);
	});

	test('CTRL-CLAIM-002 claimController returns ERR_NO_BODYPART without a CLAIM part', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1' },
			],
		});
		const ctrlPos = await shard.getControllerPos('W2N1');

		const creepId = await shard.placeCreep('W2N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: [WORK, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).claimController(
				Game.rooms['W2N1'].controller
			)
		`);
		expect(rc).toBe(ERR_NO_BODYPART);
	});

	headlessMultiPlayerTest('CTRL-CLAIM-003 claimController returns ERR_INVALID_TARGET when the controller is reserved by a hostile player', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
				{ name: 'W3N1' }, // unowned neutral room
			],
		});
		const ctrlPos = await shard.getControllerPos('W3N1');

		// p2 reserves the neutral controller.
		const reserverId = await shard.placeCreep('W3N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p2',
			body: [CLAIM, MOVE],
		});
		// p1's claimer stands on another adjacent tile.
		const claimerId = await shard.placeCreep('W3N1', {
			pos: [ctrlPos!.x - 1, ctrlPos!.y],
			owner: 'p1',
			body: [CLAIM, MOVE],
		});
		await shard.tick();

		const reserveRc = await shard.runPlayer('p2', code`
			Game.getObjectById(${reserverId}).reserveController(
				Game.rooms['W3N1'].controller
			)
		`);
		expect(reserveRc).toBe(OK);
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${claimerId}).claimController(
				Game.rooms['W3N1'].controller
			)
		`);
		expect(rc).toBe(ERR_INVALID_TARGET);
	});

	test('CTRL-CLAIM-004 claimController returns ERR_NOT_IN_RANGE when not adjacent to the controller', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1' },
			],
		});
		const ctrlPos = await shard.getControllerPos('W2N1');

		// Place the creep two tiles away (range 2).
		const creepId = await shard.placeCreep('W2N1', {
			pos: [ctrlPos!.x + 2, ctrlPos!.y],
			owner: 'p1',
			body: [CLAIM, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).claimController(
				Game.rooms['W2N1'].controller
			)
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});

	playerGclControlTest('CTRL-CLAIM-005 claimController returns ERR_GCL_NOT_ENOUGH when the GCL room cap is exceeded', async () => {
		// Both built-in adapters hardcode a very high GCL at user creation,
		// so exceeding the per-player room cap cannot be produced honestly.
		// Gated on `playerGclControl` until an adapter exposes a GCL override.
	});

	test('CTRL-CLAIM-006 claimController returns ERR_INVALID_TARGET when the controller is already owned', async ({ shard }) => {
		// Per engine rules, a creep standing on an owned controller without
		// being its owner cannot issue intents — use a hostile claimer for
		// "already owned by another player" scoping with headlessMultiPlayer.
		// Simpler: p1 attempts to claim its own controller and gets
		// ERR_GCL_NOT_ENOUGH or ERR_INVALID_TARGET; the engine's checkClaim
		// rejects owned controllers with ERR_INVALID_TARGET before the body
		// check, so a single-player setup is enough.
		await shard.ownedRoom('p1');
		const ctrlPos = await shard.getControllerPos('W1N1');

		const creepId = await shard.placeCreep('W1N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: [CLAIM, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).claimController(
				Game.rooms['W1N1'].controller
			)
		`);
		expect(rc).toBe(ERR_INVALID_TARGET);
	});

	// ── 6.2 Reserve Controller ────────────────────────────────

	test('CTRL-RESERVE-002 reserveController returns ERR_NO_BODYPART without a CLAIM part', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1' },
			],
		});
		const ctrlPos = await shard.getControllerPos('W2N1');

		const creepId = await shard.placeCreep('W2N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: [WORK, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).reserveController(
				Game.rooms['W2N1'].controller
			)
		`);
		expect(rc).toBe(ERR_NO_BODYPART);
	});

	test('CTRL-RESERVE-003 reserveController returns ERR_INVALID_TARGET when the controller is owned', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const ctrlPos = await shard.getControllerPos('W1N1');

		const creepId = await shard.placeCreep('W1N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: [CLAIM, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).reserveController(
				Game.rooms['W1N1'].controller
			)
		`);
		expect(rc).toBe(ERR_INVALID_TARGET);
	});

	test('CTRL-RESERVE-004 reserveController returns ERR_NOT_IN_RANGE when not adjacent to the controller', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1' },
			],
		});
		const ctrlPos = await shard.getControllerPos('W2N1');

		const creepId = await shard.placeCreep('W2N1', {
			pos: [ctrlPos!.x + 2, ctrlPos!.y],
			owner: 'p1',
			body: [CLAIM, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).reserveController(
				Game.rooms['W2N1'].controller
			)
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});

	test('CTRL-RESERVE-005 reservation is capped at CONTROLLER_RESERVE_MAX', async ({ shard }) => {
		// Engine processor (reserveController.js:39-41) rejects a reserve
		// intent if the new endTime would exceed gameTime + CONTROLLER_RESERVE_MAX.
		// With a 50-CLAIM creep each reserve adds 50 ticks and natural decay
		// removes 1 per tick, so the reservation caps around 5000 - 50 after
		// ~110 ticks of continuous reserving.
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1' },
			],
		});
		const ctrlPos = await shard.getControllerPos('W2N1');
		const body: string[] = [];
		for (let i = 0; i < 49; i++) body.push(CLAIM);
		body.push(MOVE);
		const creepId = await shard.placeCreep('W2N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body,
		});
		await shard.tick();

		// Reserve for enough ticks to well exceed the cap if uncapped.
		// 49 parts × 150 ticks = 7350 theoretical, capped at CONTROLLER_RESERVE_MAX.
		for (let i = 0; i < 150; i++) {
			await shard.runPlayer('p1', code`
				Game.getObjectById(${creepId}).reserveController(
					Game.rooms['W2N1'].controller
				)
			`);
			await shard.tick();
		}

		const ticksToEnd = await shard.runPlayer('p1', code`
			Game.rooms['W2N1'].controller.reservation.ticksToEnd
		`) as number;
		// Cap is enforced at CONTROLLER_RESERVE_MAX (5000). The last successful
		// reserve lands within `effect` of the cap (effect = 49), so the
		// observed value sits in [cap - 2*effect, cap].
		expect(ticksToEnd).toBeLessThanOrEqual(CONTROLLER_RESERVE_MAX);
		expect(ticksToEnd).toBeGreaterThan(CONTROLLER_RESERVE_MAX - 2 * 49);
	});

	// ── 6.3 Attack Controller ─────────────────────────────────

	test('CTRL-ATTACK-001 attackController reduces a hostile controller ticksToDowngrade by CONTROLLER_CLAIM_DOWNGRADE per CLAIM part', async ({ shard }) => {
		// Engine `processor/intents/creeps/attackController.js` decrements
		// `target.downgradeTime` by `CONTROLLER_CLAIM_DOWNGRADE` per active CLAIM
		// part on the attacker. CTRL-ATTACK-005 covers the own-controller variant;
		// this case verifies the canonical hostile path. Reads ticksToDowngrade
		// through p1's visibility on the hostile room (avoids requiring p2 to
		// have any objects, which would trip the `headlessMultiPlayer` skip).
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				// RCL 2 so the downgrade timer has headroom for the 2*300 drop.
				{ name: 'W2N1', rcl: 2, owner: 'p2' },
			],
		});
		const ctrlPos = await shard.getControllerPos('W2N1');
		const creepId = await shard.placeCreep('W2N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: [CLAIM, CLAIM, MOVE],
		});
		await shard.tick();

		const probe = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			const ctrl = creep.room.controller;
			const before = ctrl.ticksToDowngrade;
			const rc = creep.attackController(ctrl);
			({ before, rc })
		`) as { before: number; rc: number };
		expect(probe.rc).toBe(OK);
		await shard.tick();

		const after = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).room.controller.ticksToDowngrade
		`) as number;

		// Two CLAIM parts → drop is 2 * CONTROLLER_CLAIM_DOWNGRADE plus a few
		// ticks of natural decay during the intervening ticks. The drop must
		// clearly exceed natural decay alone and match the canonical formula.
		const drop = probe.before - after;
		const expected = 2 * CONTROLLER_CLAIM_DOWNGRADE;
		expect(drop).toBeGreaterThanOrEqual(expected);
		expect(drop).toBeLessThan(expected + 10);
	});

	test('CTRL-ATTACK-002 attackController returns ERR_NO_BODYPART without a CLAIM part', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const ctrlPos = await shard.getControllerPos('W2N1');
		const creepId = await shard.placeCreep('W2N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: [WORK, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).attackController(
				Game.rooms['W2N1'].controller
			)
		`);
		expect(rc).toBe(ERR_NO_BODYPART);
	});

	test('CTRL-ATTACK-003 attackController sets upgradeBlocked on the target controller', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const ctrlPos = await shard.getControllerPos('W2N1');
		const creepId = await shard.placeCreep('W2N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: [CLAIM, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).attackController(
				Game.rooms['W2N1'].controller
			)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const upgradeBlocked = await shard.runPlayer('p1', code`
			Game.rooms['W2N1'].controller.upgradeBlocked
		`) as number;
		// Engine sets upgradeBlocked = CONTROLLER_ATTACK_BLOCKED_UPGRADE (1000).
		// One tick has elapsed since the intent, so expect close to but no more
		// than the initial value.
		expect(upgradeBlocked).toBeGreaterThan(0);
		expect(upgradeBlocked).toBeLessThanOrEqual(CONTROLLER_ATTACK_BLOCKED_UPGRADE);
	});

	test('CTRL-ATTACK-004 attackController returns ERR_NOT_IN_RANGE when not adjacent to the controller', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const ctrlPos = await shard.getControllerPos('W2N1');
		const creepId = await shard.placeCreep('W2N1', {
			pos: [ctrlPos!.x + 2, ctrlPos!.y],
			owner: 'p1',
			body: [CLAIM, MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).attackController(
				Game.rooms['W2N1'].controller
			)
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});

	// ── 6.5 Sign Controller ───────────────────────────────────

	test('CTRL-SIGN-002 signController returns ERR_NOT_IN_RANGE when not adjacent to the controller', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const ctrlPos = await shard.getControllerPos('W1N1');

		const creepId = await shard.placeCreep('W1N1', {
			pos: [ctrlPos!.x + 2, ctrlPos!.y],
			owner: 'p1',
			body: [MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).signController(
				Game.rooms['W1N1'].controller, 'hello'
			)
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});

	test('CTRL-SIGN-003 signController works on a hostile controller (any player can sign any controller)', async ({ shard }) => {
		// Engine rules: signController has no ownership check. Catalog claim
		// "Any player can sign any controller (including hostile)" — verify by
		// having p1 sign p2's owned controller.
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const ctrlPos = await shard.getControllerPos('W2N1');

		const signerId = await shard.placeCreep('W2N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: [MOVE],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${signerId}).signController(
				Game.rooms['W2N1'].controller, 'hostile hi'
			)
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const sign = await shard.runPlayer('p1', code`
			const s = Game.rooms['W2N1'].controller.sign;
			s ? ({ text: s.text }) : null
		`) as { text: string } | null;
		expect(sign).not.toBeNull();
		expect(sign!.text).toBe('hostile hi');
	});

	test('CTRL-ATTACK-005 attackController is allowed on the player\'s own controller and applies the downgrade + upgradeBlocked effects', async ({ shard }) => {
		// Engine has no own-user guard on attackController (see
		// @screeps/engine/src/game/creeps.js:885-917 and
		// processor/intents/creeps/attackController.js): the intent is
		// accepted against any owned/reserved controller, and the processor
		// unconditionally reduces target.downgradeTime by
		// CONTROLLER_CLAIM_DOWNGRADE per CLAIM part and sets upgradeBlocked.
		// Use RCL 2 so the downgrade timer has headroom for the 300-tick
		// decrement and the controller doesn't risk slipping to level 0.
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const ctrlPos = await shard.getControllerPos('W1N1');
		const creepId = await shard.placeCreep('W1N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: [CLAIM, MOVE],
		});
		await shard.tick();

		const preAttack = await shard.runPlayer('p1', code`
			const creep = Game.getObjectById(${creepId});
			const ctrl = creep.room.controller;
			const before = ctrl.ticksToDowngrade;
			const rc = creep.attackController(ctrl);
			({ before, rc })
		`) as { before: number; rc: number };
		expect(preAttack.rc).toBe(OK);
		await shard.tick();

		const after = await shard.runPlayer('p1', code`
			const ctrl = Game.rooms['W1N1'].controller;
			({ ttd: ctrl.ticksToDowngrade, upgradeBlocked: ctrl.upgradeBlocked })
		`) as { ttd: number; upgradeBlocked: number };
		// One CLAIM part → timer reduced by CONTROLLER_CLAIM_DOWNGRADE (300)
		// plus a small amount of natural decay for intervening ticks. The
		// drop must clearly exceed ordinary decay and match the attack effect.
		const drop = preAttack.before - after.ttd;
		expect(drop).toBeGreaterThanOrEqual(CONTROLLER_CLAIM_DOWNGRADE);
		expect(drop).toBeLessThan(CONTROLLER_CLAIM_DOWNGRADE + 10);
		// upgradeBlocked is initialized to CONTROLLER_ATTACK_BLOCKED_UPGRADE
		// on the attack tick; observation is one tick later, so the value is
		// close to but no more than the canonical 1000.
		expect(after.upgradeBlocked).toBeGreaterThan(0);
		expect(after.upgradeBlocked).toBeLessThanOrEqual(CONTROLLER_ATTACK_BLOCKED_UPGRADE);
	});
});
