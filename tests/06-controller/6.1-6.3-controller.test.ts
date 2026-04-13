import { describe, test, expect, code,
	OK, ERR_NO_BODYPART, ERR_NOT_IN_RANGE, ERR_INVALID_TARGET, ERR_GCL_NOT_ENOUGH,
	CLAIM, MOVE, WORK,
	CONTROLLER_ATTACK_BLOCKED_UPGRADE, CONTROLLER_CLAIM_DOWNGRADE,
	CONTROLLER_RESERVE, CONTROLLER_RESERVE_MAX,
	limitationGated,
} from '../../src/index.js';

const playerGclControlTest = limitationGated('playerGclControl');

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

	test('CTRL-CLAIM-003 claimController returns ERR_INVALID_TARGET when the controller is reserved by a hostile player', async ({ shard }) => {
		// Engine creeps.js:838-840 gates claim on `target.reservation`, and
		// the controller tick processor (`processor/intents/controllers/tick.js:12`)
		// deletes reservations once `gameTime >= endTime - 1`. Each CLAIM
		// part on the reserver adds CONTROLLER_RESERVE (1 tick) to endTime,
		// so a single-CLAIM reservation decays within one tick of the
		// reserve intent — too short to survive the intermediate tick before
		// p1's claim runs. Give the reserver enough CLAIM parts to keep the
		// reservation alive through reserve → tick → claim.
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
				{ name: 'W3N1' }, // unowned neutral room
			],
		});
		const ctrlPos = await shard.getControllerPos('W3N1');

		// p2 reserves the neutral controller. 5 CLAIM parts → endTime =
		// gameTime + 1 + 5, well above the decay threshold at p1's claim tick.
		const reserverId = await shard.placeCreep('W3N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p2',
			body: [CLAIM, CLAIM, CLAIM, CLAIM, CLAIM, MOVE],
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

	playerGclControlTest('CTRL-CLAIM-005 claimController returns ERR_GCL_NOT_ENOUGH when the GCL room cap is exceeded', async ({ shard }) => {
		// Game.gcl.level is derived from user.gcl with GCL_POW=2.4 / GCL_MULTIPLY=1e6,
		// so any gcl value below 1e6 yields level 1 → cap of 1 owned room. Start
		// p1 with gcl=0, give them W1N1, and have them try to claim a second
		// controller; the engine's claim check rejects with ERR_GCL_NOT_ENOUGH.
		await shard.createShard({
			players: [{ name: 'p1', gcl: 0 }],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1' },
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
			Game.getObjectById(${creepId}).claimController(
				Game.rooms['W2N1'].controller
			)
		`);
		expect(rc).toBe(ERR_GCL_NOT_ENOUGH);
	});

	test('CTRL-CLAIM-006 claimController returns ERR_INVALID_TARGET when the controller is already owned', async ({ shard }) => {
		// p1 attempts to claim its own controller and gets ERR_INVALID_TARGET;
		// the engine's checkClaim rejects owned controllers before the body
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
		// Use the three non-edge tiles adjacent to the canonical controller at
		// (1,1). Three 50-CLAIM reservers can drive the controller near the cap
		// in a few dozen reserve ticks without relying on engine internals.
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1' },
			],
		});
		const ctrlPos = await shard.getControllerPos('W2N1');
		const body = Array.from({ length: 50 }, () => CLAIM);
		const reserverPositions: Array<[number, number]> = [
			[ctrlPos!.x + 1, ctrlPos!.y],
			[ctrlPos!.x, ctrlPos!.y + 1],
			[ctrlPos!.x + 1, ctrlPos!.y + 1],
		];
		const creepIds = await Promise.all(reserverPositions.map(pos =>
			shard.placeCreep('W2N1', {
				pos,
				owner: 'p1',
				body,
			})
		));
		await shard.tick();

		// runPlayer() already advances one processing tick. Three reservers add
		// at most 150 reservation per tick, minus the 1 natural decay, so
		// 34 reserve ticks are enough to saturate from zero.
		for (let i = 0; i < 34; i++) {
			await shard.runPlayer('p1', code`
				const controller = Game.rooms['W2N1'].controller;
				for (const id of ${creepIds}) {
					Game.getObjectById(id).reserveController(controller);
				}
			`);
		}

		const ticksToEnd = await shard.runPlayer('p1', code`
			Game.rooms['W2N1'].controller.reservation.ticksToEnd
		`) as number;
		// Once saturated, the last successful reserve leaves the player-visible
		// value within one 50-tick reserve effect of the cap.
		expect(ticksToEnd).toBeLessThanOrEqual(CONTROLLER_RESERVE_MAX);
		expect(ticksToEnd).toBeGreaterThan(CONTROLLER_RESERVE_MAX - 50);
	}, 30_000);

	test('CTRL-RESERVE-006 reservation ticksToEnd decreases by 1 per tick without a reserver', async ({ shard }) => {
		// Engine controllers/tick.js:10 — reservation is cleared when
		// gameTime >= endTime - 1. The stored endTime is absolute and does not
		// change; the player-visible `ticksToEnd` getter returns endTime - gameTime,
		// so from a player's perspective the value decreases by 1 each tick.
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1' },
			],
		});
		const ctrlPos = await shard.getControllerPos('W2N1');
		// 49 CLAIM parts → single reserve intent adds 49 ticks (CONTROLLER_RESERVE
		// per part). A 1-CLAIM creep's reservation expires within a tick of
		// reserving, which would hide the decay.
		const body: string[] = [];
		for (let i = 0; i < 49; i++) body.push(CLAIM);
		body.push(MOVE);
		const creepId = await shard.placeCreep('W2N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body,
		});
		await shard.tick();

		// Reserve once, then let the controller sit idle while we tick.
		const reserveRc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).reserveController(
				Game.rooms['W2N1'].controller
			)
		`);
		expect(reserveRc).toBe(OK);

		const initial = await shard.runPlayer('p1', code`
			Game.rooms['W2N1'].controller.reservation.ticksToEnd
		`) as number;
		expect(initial).toBeGreaterThan(10);

		// Advance 5 ticks with no further reserving.
		await shard.tick(5);

		const after = await shard.runPlayer('p1', code`
			Game.rooms['W2N1'].controller.reservation.ticksToEnd
		`) as number;
		// runPlayer advances 1 more tick to read, so the visible drop is 5 + 1.
		expect(initial - after).toBe(6);
	});

	test('CTRL-RESERVE-007 attackController reduces a hostile reservation endTime by CONTROLLER_RESERVE per CLAIM part', async ({ shard }) => {
		// Engine processor/intents/creeps/attackController.js:33-40 — when
		// target.reservation is present, endTime -= CLAIM × CONTROLLER_RESERVE.
		// (API-level reserveController rejects a hostile reservation with
		// ERR_INVALID_TARGET at game/creeps.js:976-978, so the reduce path is
		// reached via attackController — see CTRL-RESERVE-007 note in catalog.)
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
				{ name: 'W3N1' }, // unowned, target for reservation
			],
		});
		const ctrlPos = await shard.getControllerPos('W3N1');
		// Long-lived hostile reservation so the attack's reduction is observable
		// before the reservation naturally expires.
		const reserverBody: string[] = [];
		for (let i = 0; i < 49; i++) reserverBody.push(CLAIM);
		reserverBody.push(MOVE);
		const reserverId = await shard.placeCreep('W3N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p2',
			body: reserverBody,
		});
		const attackerId = await shard.placeCreep('W3N1', {
			pos: [ctrlPos!.x - 1, ctrlPos!.y],
			owner: 'p1',
			body: [CLAIM, CLAIM, MOVE],
		});
		await shard.tick();

		// p2 reserves first.
		await shard.runPlayer('p2', code`
			Game.getObjectById(${reserverId}).reserveController(
				Game.rooms['W3N1'].controller
			)
		`);

		const before = await shard.runPlayer('p1', code`
			Game.rooms['W3N1'].controller.reservation.ticksToEnd
		`) as number;
		expect(before).toBeGreaterThan(0);

		// p1's 2-CLAIM creep attacks the hostile-reserved controller.
		const attackRc = await shard.runPlayer('p1', code`
			Game.getObjectById(${attackerId}).attackController(
				Game.rooms['W3N1'].controller
			)
		`);
		expect(attackRc).toBe(OK);
		await shard.tick();

		const after = await shard.runPlayer('p1', code`
			Game.rooms['W3N1'].controller.reservation.ticksToEnd
		`) as number;
		// 2 CLAIM × CONTROLLER_RESERVE + 1 tick of natural decay between observations.
		const drop = before - after;
		const expected = 2 * CONTROLLER_RESERVE;
		expect(drop).toBeGreaterThanOrEqual(expected);
		expect(drop).toBeLessThan(expected + 5);
	});

	// ── 6.3 Attack Controller ─────────────────────────────────

	test('CTRL-ATTACK-001 attackController reduces a hostile controller ticksToDowngrade by CONTROLLER_CLAIM_DOWNGRADE per CLAIM part', async ({ shard }) => {
		// Engine `processor/intents/creeps/attackController.js` decrements
		// `target.downgradeTime` by `CONTROLLER_CLAIM_DOWNGRADE` per active CLAIM
		// part on the attacker. CTRL-ATTACK-005 covers the own-controller variant;
		// this case verifies the canonical hostile path. Reads ticksToDowngrade
		// through p1's visibility on the hostile room.
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

	test('CTRL-ATTACK-006 attackController returns ERR_INVALID_TARGET on an unowned, unreserved controller', async ({ shard }) => {
		// Engine game/creeps.js:902-904 — attackController requires the target
		// to have `owner` or `reservation`. A fresh unowned, unreserved
		// controller returns ERR_INVALID_TARGET at the API layer.
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1' }, // unowned, unreserved
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
		expect(rc).toBe(ERR_INVALID_TARGET);
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
