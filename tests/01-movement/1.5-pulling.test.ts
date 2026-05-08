import { describe, test, expect, code, limitationGated,
	OK, ERR_NOT_IN_RANGE, ERR_INVALID_TARGET,
	MOVE, WORK, TOP, BOTTOM, STRUCTURE_SPAWN,
} from '../../src/index.js';
import { movePullValidationCases } from '../../src/matrices/move-pull-validation.js';
import { staleArgumentCases } from '../../src/matrices/stale-argument.js';
import { expectStaleArgumentRejected, spawnBusyCreep } from '../intent-validation-helpers.js';

const stalePullCase = staleArgumentCases.find(row => row.key === 'creepPull')!;

describe('creep.pull()', () => {
	test('MOVE-PULL-001 pull() on an adjacent friendly creep returns OK', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE, MOVE],
			name: 'puller',
		});
		await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [WORK, WORK, WORK],
			name: 'heavy',
		});

		const rc = await shard.runPlayer('p1', code`
			Game.creeps['puller'].pull(Game.creeps['heavy'])
		`);
		expect(rc).toBe(OK);
	});

	test('MOVE-PULL-002 the pulled creep must call move() toward the puller in the same tick for the pull to complete', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const pullerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE, MOVE],
			name: 'puller',
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [WORK, WORK, WORK],
			name: 'heavy',
		});

		const rc = await shard.runPlayer('p1', code`
			const puller = Game.creeps['puller'];
			const heavy = Game.creeps['heavy'];
			({
				pull: puller.pull(heavy),
				move: puller.move(TOP),
			})
		`) as { pull: number; move: number };
		expect(rc.pull).toBe(OK);
		expect(rc.move).toBe(OK);

		await shard.tick();

		const puller = await shard.expectObject(pullerId, 'creep');
		const target = await shard.expectObject(targetId, 'creep');
		expect(puller.pos.y).toBe(24);
		expect(target.pos.y).toBe(26);
	});

	test("MOVE-PULL-003 when a pull completes, the pulled creep moves into the puller's previous tile", async ({ shard }) => {
		await shard.ownedRoom('p1');
		const pullerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE, MOVE],
			name: 'puller',
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [WORK, WORK, WORK],
			name: 'heavy',
		});

		const rc = await shard.runPlayer('p1', code`
			const puller = Game.creeps['puller'];
			const heavy = Game.creeps['heavy'];
			({
				pull: puller.pull(heavy),
				move: puller.move(TOP),
				targetMove: heavy.move(puller),
			})
		`) as { pull: number; move: number; targetMove: number };
		expect(rc.pull).toBe(OK);
		expect(rc.move).toBe(OK);

		await shard.tick();

		const puller = await shard.expectObject(pullerId, 'creep');
		const target = await shard.expectObject(targetId, 'creep');
		expect(puller.pos.y).toBe(24);
		expect(target.pos.y).toBe(25);
	});

	test('MOVE-PULL-004 pull() returns ERR_NOT_IN_RANGE when the target is not adjacent', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const pullerId = await shard.placeCreep('W1N1', {
			pos: [10, 10], owner: 'p1',
			body: [MOVE],
			name: 'puller',
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [20, 20], owner: 'p1',
			body: [WORK],
			name: 'heavy',
		});

		const rc = await shard.runPlayer('p1', code`
			Game.creeps['puller'].pull(Game.creeps['heavy'])
		`);
		expect(rc).toBe(ERR_NOT_IN_RANGE);
	});

	test('MOVE-PULL-005 the puller accumulates fatigue for both itself and the pulled creep', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// Puller has only MOVE parts (zero own weight), so any post-move fatigue
		// must come from the pulled creep's weight being added to the puller.
		const pullerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE], name: 'puller',
		});
		// Pulled has 2 weighted parts (2 WORK) and NO MOVE parts. Pulled MOVE
		// parts would otherwise also reduce the puller's fatigue (vanilla
		// _add-fatigue tunnels reductions up the pull chain).
		const pulledId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [WORK, WORK], name: 'pulled',
		});
		await shard.tick();

		// Pull + same-tick coordinated move so the pull resolves.
		await shard.runPlayer('p1', code`
			const puller = Game.creeps['puller'];
			const pulled = Game.creeps['pulled'];
			puller.pull(pulled);
			puller.move(TOP);
			pulled.move(puller);
		`);

		const puller = await shard.expectObject(pullerId, 'creep');
		const pulled = await shard.expectObject(pulledId, 'creep');
		// Both creeps moved one tile north.
		expect(puller.pos.y).toBe(24);
		expect(pulled.pos.y).toBe(25);
		// Puller takes the combined fatigue. Pulled (2 weighted parts) +
		// puller (0 weighted parts) = 2 weighted parts → 4 plain fatigue.
		// Puller has 1 MOVE → reduces by 2 → residual 2 on the puller.
		expect(puller.fatigue).toBe(2);
		// The pulled creep does not accumulate its own move fatigue.
		expect(pulled.fatigue).toBe(0);
	});

	test('MOVE-PULL-006 pull can chain through multiple creeps in a train', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// Three creeps in a vertical train: A (head) at [25,23], B at [25,24],
		// C (tail) at [25,25]. A pulls B, B pulls C, A moves TOP, B moves toward
		// A, C moves toward B. After the tick all three should have shifted
		// one tile north.
		const aId = await shard.placeCreep('W1N1', {
			pos: [25, 23], owner: 'p1',
			body: [MOVE, MOVE, MOVE], name: 'a',
		});
		const bId = await shard.placeCreep('W1N1', {
			pos: [25, 24], owner: 'p1',
			body: [MOVE, MOVE], name: 'b',
		});
		const cId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE, MOVE], name: 'c',
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			const a = Game.creeps['a'];
			const b = Game.creeps['b'];
			const c = Game.creeps['c'];
			a.pull(b);
			b.pull(c);
			a.move(TOP);
			b.move(a);
			c.move(b);
		`);

		const a = await shard.expectObject(aId, 'creep');
		const b = await shard.expectObject(bId, 'creep');
		const c = await shard.expectObject(cId, 'creep');
		expect(a.pos.x).toBe(25); expect(a.pos.y).toBe(22);
		expect(b.pos.x).toBe(25); expect(b.pos.y).toBe(23);
		expect(c.pos.x).toBe(25); expect(c.pos.y).toBe(24);
	});

	const pullSelfTest = limitationGated('pullSelfHang');
	pullSelfTest('MOVE-PULL-007:self pull() returns ERR_INVALID_TARGET for self', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE], name: 'solo',
		});

		const rc = await shard.runPlayer('p1', code`
			const c = Game.creeps['solo'];
			c.pull(c)
		`);
		expect(rc).toBe(ERR_INVALID_TARGET);
	});

	test('MOVE-PULL-007:nonCreep pull() returns ERR_INVALID_TARGET for non-creep', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE], name: 'puller',
		});
		const structId = await shard.placeStructure('W1N1', {
			pos: [25, 26], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.creeps['puller'].pull(Game.getObjectById(${structId}))
		`);
		expect(rc).toBe(ERR_INVALID_TARGET);
	});

	test('MOVE-PULL-007:spawning pull() returns ERR_INVALID_TARGET for spawning creep', async ({ shard }) => {
		await shard.ownedRoom('p1', 'W1N1', 1);
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
			store: { energy: 300 },
		});
		await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1', body: [MOVE, MOVE], name: 'puller',
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			Game.getObjectById(${spawnId}).spawnCreep([MOVE], 'Spawning')
		`);

		const rc = await shard.runPlayer('p1', code`
			const target = Game.creeps['Spawning'];
			target ? Game.creeps['puller'].pull(target) : -99
		`);
		expect(rc).toBe(ERR_INVALID_TARGET);
	});

	test('MOVE-PULL-008 pull() on adjacent enemy returns OK', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [
				{ name: 'W1N1', rcl: 1, owner: 'p1' },
				{ name: 'W2N1', rcl: 1, owner: 'p2' },
			],
		});
		const pullerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE, MOVE], name: 'puller',
		});
		const enemyId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p2', body: [WORK], name: 'enemy',
		});

		const rc = await shard.runPlayer('p1', code`
			Game.creeps['puller'].pull(Game.getObjectById(${enemyId}))
		`);
		expect(rc).toBe(OK);
	});

	test('MOVE-PULL-009 pulled creep moving away from puller breaks the pull', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const pullerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE, MOVE], name: 'puller',
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1', body: [MOVE], name: 'target',
		});
		await shard.tick();

		// Puller pulls and moves north. Target moves south (away) instead
		// of toward the puller — this breaks the pull. Each creep moves
		// independently in its own direction.
		await shard.runPlayer('p1', code`
			const puller = Game.creeps['puller'];
			const target = Game.creeps['target'];
			puller.pull(target);
			puller.move(TOP);
			target.move(BOTTOM);
		`);

		const puller = await shard.expectObject(pullerId, 'creep');
		const target = await shard.expectObject(targetId, 'creep');
		// Puller moves north normally.
		expect(puller.pos.y).toBe(24);
		// Target moves south independently — pull was broken.
		expect(target.pos.y).toBe(27);
	});

	test('MOVE-PULL-010 pull() returns OK but does not resolve when puller is fatigued', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// Puller: 3 WORK + 1 MOVE — will be fatigued after first move.
		// Target placed diagonally so puller stays adjacent after moving TOP.
		const pullerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [WORK, WORK, WORK, MOVE], name: 'puller',
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [26, 25], owner: 'p1',
			body: [WORK], name: 'target',
		});
		await shard.tick();

		// Move puller TOP to [25,24]. Target at [26,25] — still adjacent
		// (Chebyshev 1). Puller now has residual fatigue.
		await shard.runPlayer('p1', code`Game.creeps['puller'].move(TOP)`);
		const afterMove = await shard.expectObject(pullerId, 'creep');
		expect(afterMove.pos.y).toBe(24);
		expect(afterMove.fatigue).toBeGreaterThan(0);

		// Puller is fatigued but adjacent. pull() returns OK, move() returns
		// ERR_TIRED. Since the puller cannot move, the pull does not resolve.
		const rc = await shard.runPlayer('p1', code`
			const puller = Game.creeps['puller'];
			const target = Game.creeps['target'];
			puller.pull(target)
		`);
		expect(rc).toBe(OK);

		const puller = await shard.expectObject(pullerId, 'creep');
		const target = await shard.expectObject(targetId, 'creep');
		// Neither creep moved.
		expect(puller.pos.x).toBe(25);
		expect(puller.pos.y).toBe(24);
		expect(target.pos.x).toBe(26);
		expect(target.pos.y).toBe(25);
	});

	for (const row of movePullValidationCases) {
		test(`MOVE-PULL-011:${row.label} pull() validation returns the canonical code`, async ({ shard }) => {
			const blockers = new Set(row.blockers);
			const owner = blockers.has('not-owner') ? 'p2' : 'p1';
			if (owner === 'p2') {
				await shard.createShard({
					players: ['p1', 'p2'],
					rooms: [{ name: 'W1N1', rcl: 1, owner: 'p2' }],
				});
				if (!blockers.has('busy')) {
					await shard.placeCreep('W1N1', {
						pos: [20, 20],
						owner: 'p1',
						body: [MOVE],
					});
				}
			} else {
				await shard.ownedRoom('p1');
			}

			const pullerId = blockers.has('busy')
				? await spawnBusyCreep(shard, {
					owner,
					observerOwner: owner === 'p2' ? 'p1' : undefined,
					name: 'PullerBusy',
				})
				: await shard.placeCreep('W1N1', {
					pos: [25, 25],
					owner,
					body: [MOVE],
					name: 'puller-validation',
				});
			const targetId = blockers.has('invalid-target')
				? await shard.placeStructure('W1N1', {
					pos: blockers.has('range') ? [30, 30] : [25, 26],
					structureType: STRUCTURE_SPAWN,
					owner,
					store: { energy: 300 },
				})
				: await shard.placeCreep('W1N1', {
					pos: blockers.has('range') ? [30, 30] : [25, 26],
					owner,
					body: [WORK],
					name: 'pulled-validation',
				});

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${pullerId}).pull(Game.getObjectById(${targetId}))
			`);
			expect(rc).toBe(row.expectedRc);
		});
	}

	test('MOVE-PULL-012:pullerFirst puller-first iteration — fatigue dies with the puller, not stranded on the pulled creep', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// Carrier (puller): 2 MOVE — zero own fatigue contribution, full
		// MOVE clearing. TTL=2: first runPlayer tick is normal; second is
		// the carrier's last.
		const carrierId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE, MOVE], name: 'carrier',
			ticksToLive: 2,
		});
		// Harvester (pulled): 2 WORK — 2 weighted parts, no MOVE. Plain
		// terrain fatigue from a single move = 2 weighted * 2 = 4. No MOVE
		// means it cannot clear fatigue once it lands.
		const harvesterId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [WORK, WORK], name: 'harvester',
		});

		// Tick T: carrier alive — pull resolves; harvester's move fatigue
		// chain-walks to the carrier; carrier's MOVE clears it.
		await shard.runPlayer('p1', code`
			const carrier = Game.creeps['carrier'];
			const harvester = Game.creeps['harvester'];
			carrier.pull(harvester);
			carrier.move(TOP);
			harvester.move(carrier);
		`);

		const carrierMid = await shard.expectObject(carrierId, 'creep');
		const harvesterMid = await shard.expectObject(harvesterId, 'creep');
		expect(carrierMid.pos.y).toBe(24);
		expect(harvesterMid.pos.y).toBe(25);
		expect(carrierMid.fatigue).toBe(0);
		expect(harvesterMid.fatigue).toBe(0);
		expect(carrierMid.ticksToLive).toBe(1);

		// Tick T+1: carrier dies mid-tick. The intended behavior is that
		// the move's fatigue is buried with the dying puller — the pulled
		// creep ends the tick at fatigue 0 regardless of placement /
		// iteration order. Vanilla's `_add-fatigue` chain walk runs from
		// inside per-creep `creeps/tick.js`, where the puller can be
		// removed from `roomObjects` before the pulled creep's later
		// `movement.execute`; with the carrier inserted first that walk
		// fails to find the (now-deleted) carrier and strands the fatigue
		// on the harvester. That's tracked as a vanilla parity gap.
		await shard.runPlayer('p1', code`
			const carrier = Game.creeps['carrier'];
			const harvester = Game.creeps['harvester'];
			if (carrier) {
				carrier.pull(harvester);
				carrier.move(TOP);
				harvester.move(carrier);
			}
		`);

		expect(await shard.getObject(carrierId)).toBeNull();

		const harvesterAfter = await shard.expectObject(harvesterId, 'creep');
		expect(harvesterAfter.pos.x).toBe(25);
		expect(harvesterAfter.pos.y).toBe(24);
		expect(harvesterAfter.fatigue).toBe(0);

		// And nothing rematerializes on a later tick.
		await shard.tick();
		const harvesterLater = await shard.expectObject(harvesterId, 'creep');
		expect(harvesterLater.fatigue).toBe(0);
	});

	test('MOVE-PULL-012:pulledFirst pulled-first iteration — same intended outcome (consistency check)', async ({ shard }) => {
		await shard.ownedRoom('p1');
		// Same scenario but harvester placed first. Vanilla happens to
		// produce the intended outcome here even with its order-dependent
		// chain walk: the harvester's per-creep tick.js iterates before
		// the carrier's, so `_add-fatigue` reaches the still-alive carrier
		// and the fatigue dies with the carrier in its own tick.js. This
		// row exists to lock in that the intended behavior is observable
		// in at least one vanilla configuration; the `:pullerFirst` row
		// captures the one vanilla cannot reach without the chain-walk
		// quirk biting.
		const harvesterId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			body: [WORK, WORK], name: 'harvester',
		});
		const carrierId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			body: [MOVE, MOVE], name: 'carrier',
			ticksToLive: 2,
		});

		await shard.runPlayer('p1', code`
			const carrier = Game.creeps['carrier'];
			const harvester = Game.creeps['harvester'];
			carrier.pull(harvester);
			carrier.move(TOP);
			harvester.move(carrier);
		`);

		await shard.runPlayer('p1', code`
			const carrier = Game.creeps['carrier'];
			const harvester = Game.creeps['harvester'];
			if (carrier) {
				carrier.pull(harvester);
				carrier.move(TOP);
				harvester.move(carrier);
			}
		`);

		expect(await shard.getObject(carrierId)).toBeNull();

		const harvesterAfter = await shard.expectObject(harvesterId, 'creep');
		expect(harvesterAfter.pos.x).toBe(25);
		expect(harvesterAfter.pos.y).toBe(24);
		expect(harvesterAfter.fatigue).toBe(0);
	});

	test(`${stalePullCase.catalogId}:${stalePullCase.label} creep.pull() rejects a stale cached Creep target`, async ({ shard }) => {
		await shard.ownedRoom('p1');
		const pullerId = await shard.placeCreep('W1N1', {
			pos: [25, 25], owner: 'p1', body: [MOVE, MOVE], name: 'PullPuller',
		});
		const targetId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1', body: [WORK], name: 'PullTarget',
		});
		await shard.tick();

		const rc1 = await shard.runPlayer('p1', code`
			globalThis.__screepsOkStaleArgPullTarget = Game.getObjectById(${targetId});
			globalThis.__screepsOkStaleArgPullTarget.suicide()
		`);
		expect(rc1).toBe(OK);
		expect(await shard.getObject(targetId)).toBeNull();

		await expectStaleArgumentRejected(shard, 'p1', code`
			Game.getObjectById(${pullerId}).pull(globalThis.__screepsOkStaleArgPullTarget)
		`);
	});
});
