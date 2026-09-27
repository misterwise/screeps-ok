import { describe, test, expect, code,
	OK, ERR_INVALID_TARGET,
	CLAIM, MOVE,
	STRUCTURE_CONTAINER,
	CONTROLLER_ATTACK_BLOCKED_UPGRADE, CONTROLLER_CLAIM_DOWNGRADE,
	CONTROLLER_RESERVE, CONTROLLER_RESERVE_MAX, SAFE_MODE_DURATION, GCL_NOVICE,
} from '../../src/index.js';
import type { ShardFixture } from '../../src/fixture.js';
import { ctrlAttackValidationCases } from '../../src/matrices/ctrl-attack-validation.js';
import { ctrlClaimValidationCases } from '../../src/matrices/ctrl-claim-validation.js';
import { ctrlReserveValidationCases } from '../../src/matrices/ctrl-reserve-validation.js';
import { ctrlSignValidationCases } from '../../src/matrices/ctrl-sign-validation.js';
import { reserveRoom, spawnBusyCreep } from '../intent-validation-helpers.js';

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

		const sign = await shard.runPlayer('p1', code`
			const sign = Game.rooms['W1N1'].controller.sign;
			({ text: sign.text, username: sign.username, player: Game.getObjectById(${creepId}).owner.username })
		`) as { text: string; username: string; player: string };
		expect(sign).toEqual({ text: 'screeps-ok was here', username: sign.player, player: sign.player });
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

		// The next tick; the exact length is CTRL-RESERVE-011's.
		const reservation = await shard.runPlayer('p1', code`
			const reservation = Game.rooms['W2N1'].controller.reservation;
			({ username: reservation.username, player: Game.getObjectById(${creepId}).owner.username, ticksToEnd: reservation.ticksToEnd })
		`) as { username: string; player: string; ticksToEnd: number };
		expect(reservation.username).toBe(reservation.player);
		expect(reservation.ticksToEnd).toBeGreaterThan(0);
	});

	test('CTRL-CLAIM-007 controller.my returns undefined on a never-owned controller', async ({ shard }) => {
		// Engine: @screeps/engine/src/game/structures.js:139 OwnedStructure.my
		//   (o) => _.isUndefined(o.user) ? undefined : o.user == runtimeData.user._id
		// A never-owned controller has `user` undefined → my === undefined.
		// The previously-owned sentinel (`user === null` after unclaim or
		// downgrade-to-zero → my === false) is asserted by CTRL-UNCLAIM-001 and
		// CTRL-DOWNGRADE-002.
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' }, // keep p1 active
				{ name: 'W2N1' }, // never owned
			],
		});
		const ctrlPos = await shard.getControllerPos('W2N1');
		// Place a creep so p1 has visibility into the never-owned room.
		await shard.placeCreep('W2N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: [MOVE],
		});
		await shard.tick();

		// Evaluate the strict-undefined check inside the player runtime so the
		// sentinel survives the runPlayer boundary (JSON drops bare `undefined`).
		const isUndefined = await shard.runPlayer('p1', code`
			Game.rooms['W2N1'].controller.my === undefined
		`) as boolean;
		expect(isUndefined).toBe(true);
	});

	for (const row of ctrlClaimValidationCases) {
		test(`CTRL-CLAIM-008:${row.label} claimController() validation returns the canonical code`, async ({ shard }) => {
			const blockers = shard.validationBlockers(row);
			const owner = blockers.has('not-owner') ? 'p2' : 'p1';
			const roomOwner = owner === 'p2' && blockers.has('busy') ? 'p2' : 'p1';
			const reserved = blockers.has('hostile-reservation');
			// W2N1's controller is neutral, or reserved; W1N1's is owned, the
			// invalid-controller-state form and all a spawning creep can reach.
			const targetRoom = blockers.has('invalid-controller-state') || blockers.has('busy') && !reserved ? 'W1N1' : 'W2N1';
			// Novice: the claimer's room is a novice area and p1 already owns GCL_NOVICE rooms.
			const novice = blockers.has('novice');
			if (novice) shard.requires('roomStatus');
			const claimerRoom = blockers.has('busy') ? 'W1N1' : targetRoom;
			const status = (room: string) => novice && room === claimerRoom ? { status: 'novice' as const } : {};
			await shard.createShard({
				players: blockers.has('gcl-not-enough') ? [{ name: 'p1', gcl: { level: 1 } }, 'p2'] : ['p1', 'p2'],
				rooms: [
					// RCL 3 affords the extensions a spawning CLAIM part needs.
					{ name: 'W1N1', rcl: blockers.has('busy') ? 3 : 1, owner: roomOwner, ...status('W1N1') },
					{ name: 'W2N1', ...status('W2N1') },
					...Array.from({ length: novice ? GCL_NOVICE - 1 : 0 }, (_, i) => ({ name: `W${3 + i}N1`, rcl: 1, owner: 'p1' })),
				],
			});
			if (reserved) await reserveRoom(shard, 'p2', 'W2N1');
			if (targetRoom === 'W2N1' && (blockers.has('busy') || owner === 'p2')) {
				await shard.placeCreep('W2N1', { pos: [20, 20], owner: 'p1', body: [MOVE] });
			}
			const ctrlPos = await shard.getControllerPos(targetRoom);
			const creepId = blockers.has('busy')
				? await spawnBusyCreep(shard, {
					owner,
					observerOwner: owner === 'p2' ? 'p1' : undefined,
					pos: blockers.has('range') || reserved ? [25, 25] : [ctrlPos!.x + 1, ctrlPos!.y],
					body: blockers.has('no-bodypart') ? [MOVE] : [CLAIM, MOVE],
				})
				: await shard.placeCreep(targetRoom, {
					pos: blockers.has('range') ? [25, 25] : [ctrlPos!.x + 1, ctrlPos!.y],
					owner,
					body: blockers.has('no-bodypart') ? [MOVE] : [CLAIM, MOVE],
				});
			// Beside the claimer: a source is no structure, a container no controller.
			const targetId = blockers.has('invalid-target')
				? await shard.placeSource(targetRoom, { pos: [ctrlPos!.x + 1, ctrlPos!.y + 1] })
				: blockers.has('not-controller')
					? await shard.placeStructure(targetRoom, { pos: [ctrlPos!.x + 1, ctrlPos!.y + 1], structureType: STRUCTURE_CONTAINER })
					: null;

			const rc = await shard.runPlayer('p1', code`
				const target = ${targetId} === null ? Game.rooms[${targetRoom}].controller : Game.getObjectById(${targetId});
				Game.getObjectById(${creepId}).claimController(target)
			`);
			expect(rc).toBe(row.expectedRc);
		});
	}

	// ── 6.2 Reserve Controller ────────────────────────────────

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
			pos: [ctrlPos!.x, ctrlPos!.y + 1],
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
		// 2 CLAIM × CONTROLLER_RESERVE plus 3 ticks of natural decay between observations.
		expect(before - after).toBe(2 * CONTROLLER_RESERVE + 3);
	});

	// CTRL-RESERVE-009 setup: a reservation seeded well clear of both 0 and
	// CONTROLLER_RESERVE_MAX, so neither expiry nor the cap can mask the
	// per-tick renewal arithmetic, plus one renewer of the requested size.
	// The controller's three non-edge neighbours hold both creeps.
	async function seedReservation(shard: ShardFixture, renewerClaimParts: number) {
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1' },
			],
		});
		const ctrlPos = await shard.getControllerPos('W2N1');
		const seederId = await shard.placeCreep('W2N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: Array.from({ length: 40 }, () => CLAIM),
		});
		const renewerBody: string[] = [];
		for (let i = 0; i < renewerClaimParts; i++) renewerBody.push(CLAIM);
		renewerBody.push(MOVE);
		const renewerId = await shard.placeCreep('W2N1', {
			pos: [ctrlPos!.x, ctrlPos!.y + 1],
			owner: 'p1',
			body: renewerBody,
		});
		await shard.tick();

		// runPlayer advances one processing tick, so this leaves a reservation of
		// 40 × CONTROLLER_RESERVE already on the controller.
		const seedRc = await shard.runPlayer('p1', code`
			Game.getObjectById(${seederId}).reserveController(
				Game.rooms['W2N1'].controller
			)
		`);
		expect(seedRc).toBe(OK);
		return renewerId;
	}

	// Each runPlayer call reads ticksToEnd for the current tick and then processes
	// that tick's reserve intent, so reading `i` reflects exactly `i` renewals.
	async function renewalSeries(shard: ShardFixture, renewerId: string, samples: number) {
		const readings: number[] = [];
		for (let i = 0; i < samples; i++) {
			readings.push(await shard.runPlayer('p1', code`
				const controller = Game.rooms['W2N1'].controller;
				Game.getObjectById(${renewerId}).reserveController(controller);
				controller.reservation.ticksToEnd
			`) as number);
		}
		return readings;
	}

	test('CTRL-RESERVE-009 renewing a reservation with one CLAIM part holds ticksToEnd unchanged', async ({ shard }) => {
		// Engine processor/intents/creeps/reserveController.js:35-49 renews with
		// `reservation.endTime += effect`. One CLAIM part credits CONTROLLER_RESERVE
		// (1) and the timer spends 1 that same tick, so the reservation stands still.
		const renewerId = await seedReservation(shard, 1);
		const readings = await renewalSeries(shard, renewerId, 4);
		expect(readings[0]).toBeGreaterThan(10);
		const steady = Array.from({ length: readings.length }, () => readings[0]);
		expect(readings).toEqual(steady);
	});

	test('CTRL-RESERVE-009 renewing a reservation with two CLAIM parts adds one tick per tick', async ({ shard }) => {
		// Two CLAIM parts credit 2 × CONTROLLER_RESERVE against 1 tick of decay, so
		// ticksToEnd rises by exactly 1 per renewing tick.
		const renewerId = await seedReservation(shard, 2);
		const readings = await renewalSeries(shard, renewerId, 4);
		expect(readings[0]).toBeGreaterThan(10);
		const gainPerTick = 2 * CONTROLLER_RESERVE - 1;
		const rising = Array.from({ length: readings.length },
			(_, i) => readings[0] + i * gainPerTick);
		expect(readings).toEqual(rising);
	});

	test('CTRL-RESERVE-010 a renewal that would overshoot CONTROLLER_RESERVE_MAX is dropped, not clamped', async ({ shard }) => {
		// Engine reserveController.js:39-41 returns before touching endTime when
		// `endTime + effect > gameTime + CONTROLLER_RESERVE_MAX`, so at the ceiling
		// a two-CLAIM renewer is refused every other tick and the timer decays.
		// Player-visible: readings never reach MAX and fall at least once.
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1' },
			],
		});
		const ctrlPos = await shard.getControllerPos('W2N1');
		const bigBody = Array.from({ length: 50 }, () => CLAIM);
		const saturatorIds = await Promise.all([
			[ctrlPos!.x + 1, ctrlPos!.y] as [number, number],
			[ctrlPos!.x, ctrlPos!.y + 1] as [number, number],
		].map(pos => shard.placeCreep('W2N1', { pos, owner: 'p1', body: bigBody })));
		const renewerId = await shard.placeCreep('W2N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y + 1],
			owner: 'p1',
			body: [CLAIM, CLAIM, MOVE],
		});
		await shard.tick();

		// Two 50-CLAIM reservers add up to 100 per tick against 1 decay, so 52
		// reserve ticks saturate the reservation from zero.
		for (let i = 0; i < 52; i++) {
			await shard.runPlayer('p1', code`
				const controller = Game.rooms['W2N1'].controller;
				for (const id of ${saturatorIds}) {
					Game.getObjectById(id).reserveController(controller);
				}
			`);
		}

		// Only the two-CLAIM renewer keeps reserving; read before each renewal,
		// with the reserve events the previous tick logged.
		const readings: number[] = [];
		const events: number[] = [];
		for (let i = 0; i < 6; i++) {
			const probe = await shard.runPlayer('p1', code`
				const room = Game.rooms['W2N1'];
				const ticksToEnd = room.controller.reservation.ticksToEnd;
				const logged = room.getEventLog().filter(e => e.event === EVENT_RESERVE_CONTROLLER).length;
				const rc = Game.getObjectById(${renewerId}).reserveController(room.controller);
				({ ticksToEnd, logged, rc })
			`) as { ticksToEnd: number; logged: number; rc: number };
			expect(probe.rc).toBe(OK);
			readings.push(probe.ticksToEnd);
			events.push(probe.logged);
		}
		// Saturated at MAX - 1: each overshooting renewal is refused, logs nothing and
		// the timer decays, so the next one fits, logs its event and restores it.
		const peak = CONTROLLER_RESERVE_MAX - 1;
		expect(readings).toEqual([peak, peak - 1, peak, peak - 1, peak, peak - 1]);
		expect(events.slice(1)).toEqual([0, 1, 0, 1, 0]);
	}, 60_000);

	test('CTRL-RESERVE-011 a fresh reservation reads exactly its CLAIM credit as ticksToEnd', async ({ shard }) => {
		// Engine reserveController.js:31-45 starts a fresh reservation at
		// `gameTime + 1` and then adds `effect`, and ticksToEnd reads
		// `endTime - gameTime`, so the tick after reserving shows the credit.
		// Three CLAIM parts keep the reading clear of the one-tick expiry edge.
		await shard.createShard({
			players: ['p1'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1' },
			],
		});
		const ctrlPos = await shard.getControllerPos('W2N1');
		const claimParts = 3;
		const creepId = await shard.placeCreep('W2N1', {
			pos: [ctrlPos!.x + 1, ctrlPos!.y],
			owner: 'p1',
			body: Array.from({ length: claimParts }, () => CLAIM),
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${creepId}).reserveController(
				Game.rooms['W2N1'].controller
			)
		`);
		expect(rc).toBe(OK);

		const ticksToEnd = await shard.runPlayer('p1', code`
			Game.rooms['W2N1'].controller.reservation.ticksToEnd
		`);
		expect(ticksToEnd).toBe(claimParts * CONTROLLER_RESERVE);
	});

	for (const row of ctrlReserveValidationCases) {
		test(`CTRL-RESERVE-008:${row.label} reserveController() validation returns the canonical code`, async ({ shard }) => {
			const blockers = shard.validationBlockers(row);
			const owner = blockers.has('not-owner') ? 'p2' : 'p1';
			const roomOwner = owner === 'p2' && blockers.has('busy') ? 'p2' : 'p1';
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [
					// RCL 3 affords the extensions a spawning CLAIM part needs.
					{ name: 'W1N1', rcl: blockers.has('busy') ? 3 : 1, owner: roomOwner },
					{ name: 'W2N1' },
				],
			});
			const reserved = blockers.has('hostile-reservation');
			// A spawning creep sits in W1N1; it targets W1N1's owned controller
			// unless the case needs W2N1's reserved one.
			const targetRoom = blockers.has('invalid-controller-state') || blockers.has('busy') && !reserved ? 'W1N1' : 'W2N1';
			const ctrlPos = await shard.getControllerPos(targetRoom);
			if (reserved) await reserveRoom(shard, 'p2', 'W2N1');
			if (owner === 'p2' && !blockers.has('busy') || reserved && blockers.has('busy')) {
				await shard.placeCreep(targetRoom, { pos: [20, 20], owner: 'p1', body: [MOVE] });
			}
			const creepId = blockers.has('busy')
				? await spawnBusyCreep(shard, {
					owner,
					observerOwner: owner === 'p2' ? 'p1' : undefined,
					pos: blockers.has('range') || reserved ? [25, 25] : [ctrlPos!.x + 1, ctrlPos!.y],
					body: blockers.has('no-bodypart') ? [MOVE] : [CLAIM, MOVE],
				})
				: await shard.placeCreep(targetRoom, {
					pos: blockers.has('range') ? [25, 25] : [ctrlPos!.x + 1, ctrlPos!.y],
					owner,
					body: blockers.has('no-bodypart') ? [MOVE] : [CLAIM, MOVE],
				});
			// Beside the reserver: a source is no structure, a container no controller.
			const targetId = blockers.has('invalid-target')
				? await shard.placeSource(targetRoom, { pos: [ctrlPos!.x + 1, ctrlPos!.y + 1] })
				: blockers.has('not-controller')
					? await shard.placeStructure(targetRoom, { pos: [ctrlPos!.x + 1, ctrlPos!.y + 1], structureType: STRUCTURE_CONTAINER })
					: null;

			const rc = await shard.runPlayer('p1', code`
				const target = ${targetId} === null ? Game.rooms[${targetRoom}].controller : Game.getObjectById(${targetId});
				Game.getObjectById(${creepId}).reserveController(target)
			`);
			expect(rc).toBe(row.expectedRc);
		});
	}

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

		// Two CLAIM parts → 2 * CONTROLLER_CLAIM_DOWNGRADE plus 2 ticks of natural decay.
		expect(probe.before - after).toBe(2 * CONTROLLER_CLAIM_DOWNGRADE + 2);
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
		// Anchored on the intent tick; read two ticks later.
		expect(upgradeBlocked).toBe(CONTROLLER_ATTACK_BLOCKED_UPGRADE - 2);
	});

	// ── 6.5 Sign Controller ───────────────────────────────────

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

	for (const row of ctrlSignValidationCases) {
		test(`CTRL-SIGN-004:${row.label} signController() validation returns the canonical code`, async ({ shard }) => {
			const blockers = shard.validationBlockers(row);
			await shard.ownedRoom('p1');
			const ctrlPos = await shard.getControllerPos('W1N1');
			const signerId = blockers.has('busy')
				? await spawnBusyCreep(shard, {
					owner: 'p1',
					pos: blockers.has('range') ? [25, 25] : [ctrlPos!.x + 1, ctrlPos!.y],
					body: [MOVE],
				})
				: await shard.placeCreep('W1N1', {
					pos: blockers.has('range') ? [25, 25] : [ctrlPos!.x + 1, ctrlPos!.y],
					owner: 'p1',
					body: [MOVE],
				});
			// A source is no structure; a container is a structure but no controller.
			const targetPos: [number, number] = blockers.has('range') ? [30, 30] : [ctrlPos!.x + 1, ctrlPos!.y + 1];
			const targetId = blockers.has('invalid-target')
				? await shard.placeSource('W1N1', { pos: targetPos })
				: blockers.has('not-controller')
					? await shard.placeStructure('W1N1', { pos: targetPos, structureType: STRUCTURE_CONTAINER })
					: null;

			const rc = targetId
				? await shard.runPlayer('p1', code`
					Game.getObjectById(${signerId}).signController(Game.getObjectById(${targetId}), 'hello')
				`)
				: await shard.runPlayer('p1', code`
					Game.getObjectById(${signerId}).signController(Game.rooms['W1N1'].controller, 'hello')
				`);
			expect(rc).toBe(row.expectedRc);
		});
	}

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
		// One CLAIM part → CONTROLLER_CLAIM_DOWNGRADE plus 2 ticks of natural decay.
		expect(preAttack.before - after.ttd).toBe(CONTROLLER_CLAIM_DOWNGRADE + 2);
		// Anchored on the intent tick; read two ticks later.
		expect(after.upgradeBlocked).toBe(CONTROLLER_ATTACK_BLOCKED_UPGRADE - 2);
	});

	for (const row of ctrlAttackValidationCases) {
		test(`CTRL-ATTACK-007:${row.label} attackController() validation returns the canonical code`, async ({ shard }) => {
			const blockers = shard.validationBlockers(row);
			const owner = blockers.has('not-owner') ? 'p2' : 'p1';
			const usesNeutralTarget = blockers.has('invalid-controller-state');
			const targetRoom = usesNeutralTarget ? 'W2N1' : 'W1N1';
			// A spawning attacker's room is its owner's, and attacking one's own controller is allowed
			// (CTRL-ATTACK-005). RCL 3 affords the extensions a CLAIM part needs.
			const safeMode = blockers.has('safe-mode');
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [
					{
						name: 'W1N1', rcl: 3, owner: blockers.has('busy') ? owner : 'p2',
						...(safeMode ? { safeMode: SAFE_MODE_DURATION } : {}),
					},
					...(usesNeutralTarget ? [{ name: 'W2N1' }] : []),
				],
			});
			const ctrlPos = await shard.getControllerPos(targetRoom);
			if (owner === 'p2' && !blockers.has('busy') || usesNeutralTarget && blockers.has('busy')) {
				await shard.placeCreep(targetRoom, { pos: [20, 20], owner: 'p1', body: [MOVE] });
			}
			const attackerId = blockers.has('busy')
				? await spawnBusyCreep(shard, {
					owner,
					observerOwner: owner === 'p2' ? 'p1' : undefined,
					pos: blockers.has('range') || usesNeutralTarget ? [25, 25] : [ctrlPos!.x + 1, ctrlPos!.y],
					// Three parts outlast the cooldown setup's ticks.
					body: blockers.has('no-bodypart') ? [MOVE, MOVE, MOVE] : [CLAIM, MOVE, MOVE],
				})
				: await shard.placeCreep(targetRoom, {
					pos: blockers.has('range') ? [25, 25] : [ctrlPos!.x + 1, ctrlPos!.y],
					owner,
					body: blockers.has('no-bodypart') ? [MOVE] : [CLAIM, MOVE],
				});
			const sourceId = blockers.has('invalid-target')
				? await shard.placeSource(targetRoom, { pos: [ctrlPos!.x + 1, ctrlPos!.y + 1] })
				: null;
			if (blockers.has('cooldown')) {
				// Safe mode refuses p1's attack; p2 may attack its own controller.
				const setupOwner = safeMode ? 'p2' : 'p1';
				const setupId = await shard.placeCreep(targetRoom, {
					pos: [ctrlPos!.x, ctrlPos!.y + 1],
					owner: setupOwner,
					body: [CLAIM, MOVE],
				});
				const first = await shard.runPlayer(setupOwner, code`
					Game.getObjectById(${setupId}).attackController(Game.rooms[${targetRoom}].controller)
				`);
				expect(first).toBe(OK);
				await shard.tick();
			}

			const rc = blockers.has('invalid-target')
				? await shard.runPlayer('p1', code`
					Game.getObjectById(${attackerId}).attackController(Game.getObjectById(${sourceId}))
				`)
				: await shard.runPlayer('p1', code`
					Game.getObjectById(${attackerId}).attackController(Game.rooms[${targetRoom}].controller)
				`);
			expect(rc).toBe(row.expectedRc);
		});
	}
});
