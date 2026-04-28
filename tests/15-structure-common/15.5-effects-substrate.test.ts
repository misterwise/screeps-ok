/**
 * 15.5 Effects Substrate
 *
 * Verifies the universal RoomObject `effects` array surface — decay
 * cadence, expiry-removal semantics, no-stacking on re-apply, independent
 * coexistence of distinct effects, and clearance on host destruction.
 *
 * These pin the substrate independent of any specific power's magnitude
 * or duration. Per-power magnitudes live in §7.12, §17.2, §17.4, §19.4–
 * §19.7 and are out of scope here.
 */
import { describe, test, expect, code,
	OK,
	FIND_RUINS,
	STRUCTURE_TOWER,
	PWR_OPERATE_TOWER, PWR_DISRUPT_TOWER,
} from '../../src/index.js';

type EffectEntry = { power: number; effect: number; level: number; ticksRemaining: number };
type Sample = { entry: EffectEntry | null; gameTime: number; effectsLength: number };

describe('15.5 Effects Substrate', () => {

	// EFFECT-DECAY-001 — ticksRemaining decrements by exactly 1 per tick.
	// Spec: the runtime view of an entry's remaining duration is recomputed
	// each tick from a server-side endTime, so the implied invariant is
	// `ticksRemaining + gameTime` is constant across consecutive
	// observations.
	test('EFFECT-DECAY-001 entry ticksRemaining decrements by exactly 1 per tick', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.ownedRoom('p1', 'W1N1', 8);
		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 1000 },
		});
		await shard.placePowerCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			powers: { [PWR_DISRUPT_TOWER]: 1 },
			store: { ops: 200 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			pc.usePower(PWR_DISRUPT_TOWER, Game.getObjectById(${towerId}))
		`);
		expect(rc).toBe(OK);

		const sample = async (): Promise<Sample> => {
			const result = await shard.runPlayer('p1', code`
				const t = Game.getObjectById(${towerId});
				const arr = (t && t.effects) || [];
				const e = arr.find(e => e.power === PWR_DISRUPT_TOWER || e.effect === PWR_DISRUPT_TOWER);
				({
					entry: e ? { power: e.power, effect: e.effect, level: e.level, ticksRemaining: e.ticksRemaining } : null,
					gameTime: Game.time,
					effectsLength: arr.length,
				})
			`) as Sample;
			return result;
		};

		// Take three consecutive samples; each runPlayer advances exactly one tick.
		const s0 = await sample();
		const s1 = await sample();
		const s2 = await sample();

		expect(s0.entry).not.toBeNull();
		expect(s1.entry).not.toBeNull();
		expect(s2.entry).not.toBeNull();

		// gameTime advances by exactly the number of player runs between samples.
		expect(s1.gameTime - s0.gameTime).toBe(1);
		expect(s2.gameTime - s1.gameTime).toBe(1);

		// ticksRemaining decrements by exactly the number of ticks elapsed between samples.
		expect(s0.entry!.ticksRemaining - s1.entry!.ticksRemaining).toBe(s1.gameTime - s0.gameTime);
		expect(s1.entry!.ticksRemaining - s2.entry!.ticksRemaining).toBe(s2.gameTime - s1.gameTime);

		// `ticksRemaining + gameTime` is invariant across observations: it is
		// the original endTime, recomputed each tick.
		expect(s1.entry!.ticksRemaining + s1.gameTime).toBe(s0.entry!.ticksRemaining + s0.gameTime);
		expect(s2.entry!.ticksRemaining + s2.gameTime).toBe(s0.entry!.ticksRemaining + s0.gameTime);
	});

	// EFFECT-DECAY-002 — entry is removed the tick its duration reaches 0.
	// Spec: the runtime filter `ticksRemaining > 0` means the entry's last
	// observable frame shows ticksRemaining === 1; on the next observation
	// it must be absent from the array, never present with ticksRemaining
	// === 0.
	test('EFFECT-DECAY-002 entry is removed the tick its remaining duration reaches zero', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.ownedRoom('p1', 'W1N1', 8);
		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 1000 },
		});
		await shard.placePowerCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			powers: { [PWR_DISRUPT_TOWER]: 1 },
			store: { ops: 200 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			pc.usePower(PWR_DISRUPT_TOWER, Game.getObjectById(${towerId}))
		`);
		expect(rc).toBe(OK);

		const sample = async (): Promise<Sample> => await shard.runPlayer('p1', code`
			const t = Game.getObjectById(${towerId});
			const arr = (t && t.effects) || [];
			const e = arr.find(e => e.power === PWR_DISRUPT_TOWER || e.effect === PWR_DISRUPT_TOWER);
			({
				entry: e ? { power: e.power, effect: e.effect, level: e.level, ticksRemaining: e.ticksRemaining } : null,
				gameTime: Game.time,
				effectsLength: arr.length,
			})
		`) as Sample;

		// Sample until the entry hits its final-visible frame (ticksRemaining === 1),
		// asserting the never-zero invariant on every step.
		let prev = await sample();
		expect(prev.entry).not.toBeNull();
		const steps: Sample[] = [prev];
		while (prev.entry && prev.entry.ticksRemaining > 1) {
			prev = await sample();
			steps.push(prev);
			// Bound the loop in case the engine reports a runaway value.
			expect(steps.length).toBeLessThan(100);
		}

		// Last visible frame must show exactly 1 — never 0.
		expect(prev.entry).not.toBeNull();
		expect(prev.entry!.ticksRemaining).toBe(1);

		// Next sample: entry must be absent (not a zero-valued entry).
		const after = await sample();
		expect(after.entry).toBeNull();

		// Earlier in the decay, no observation may have ticksRemaining === 0.
		for (const s of steps) {
			if (s.entry) expect(s.entry.ticksRemaining).toBeGreaterThan(0);
		}
	});

	// EFFECT-APPLY-001 — re-applying a still-active power refreshes; never stacks.
	// Spec: the engine removes any pre-existing entry of the same power
	// before pushing the new one. Player code must observe exactly one
	// entry, with ticksRemaining matching the post-application value seen
	// on the very first apply.
	test('EFFECT-APPLY-001 re-applying an active power refreshes the entry without stacking', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.ownedRoom('p1', 'W1N1', 8);
		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 1000 },
		});
		await shard.placePowerCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			powers: { [PWR_DISRUPT_TOWER]: 1 },
			store: { ops: 200 },
		});
		await shard.tick();

		const rc1 = await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			pc.usePower(PWR_DISRUPT_TOWER, Game.getObjectById(${towerId}))
		`);
		expect(rc1).toBe(OK);

		await shard.tick();
		const initial = await shard.runPlayer('p1', code`
			const t = Game.getObjectById(${towerId});
			const matches = t.effects.filter(e => e.power === PWR_DISRUPT_TOWER || e.effect === PWR_DISRUPT_TOWER);
			({ count: matches.length, ticksRemaining: matches[0] ? matches[0].ticksRemaining : -1 })
		`) as { count: number; ticksRemaining: number };
		expect(initial.count).toBe(1);
		const fullDuration = initial.ticksRemaining;
		expect(fullDuration).toBeGreaterThan(0);

		// Let the entry decay so a refresh is observable.
		await shard.tick();
		const decayed = await shard.runPlayer('p1', code`
			const t = Game.getObjectById(${towerId});
			const e = t.effects.find(e => e.power === PWR_DISRUPT_TOWER || e.effect === PWR_DISRUPT_TOWER);
			e ? e.ticksRemaining : -1
		`) as number;
		expect(decayed).toBeLessThan(fullDuration);

		// Re-apply.
		const rc2 = await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			pc.usePower(PWR_DISRUPT_TOWER, Game.getObjectById(${towerId}))
		`);
		expect(rc2).toBe(OK);

		await shard.tick();
		const refreshed = await shard.runPlayer('p1', code`
			const t = Game.getObjectById(${towerId});
			const matches = t.effects.filter(e => e.power === PWR_DISRUPT_TOWER || e.effect === PWR_DISRUPT_TOWER);
			({ count: matches.length, ticksRemaining: matches[0] ? matches[0].ticksRemaining : -1 })
		`) as { count: number; ticksRemaining: number };

		// No stacking — must remain a single entry.
		expect(refreshed.count).toBe(1);
		// Refreshed back to the initial post-apply value, not summed or capped.
		expect(refreshed.ticksRemaining).toBe(fullDuration);
		expect(refreshed.ticksRemaining).toBeGreaterThan(decayed);
	});

	// EFFECT-APPLY-002 — distinct powers coexist with independent timers.
	// Spec: only entries with the same power key are deduped; entries for
	// different powers persist alongside one another. Expiry of one entry
	// must not affect any other entry.
	test('EFFECT-APPLY-002 distinct powers coexist on a target with independent timers', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.ownedRoom('p1', 'W1N1', 8);
		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 1000 },
		});
		// Operator A: OPERATE_TOWER (long duration).
		await shard.placePowerCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			name: 'op_operate',
			powers: { [PWR_OPERATE_TOWER]: 1 },
			store: { ops: 200 },
		});
		// Operator B: DISRUPT_TOWER (short duration).
		await shard.placePowerCreep('W1N1', {
			pos: [25, 27], owner: 'p1',
			name: 'op_disrupt',
			powers: { [PWR_DISRUPT_TOWER]: 1 },
			store: { ops: 200 },
		});
		await shard.tick();

		const rcs = await shard.runPlayer('p1', code`
			const ops = Game.powerCreeps['op_operate'];
			const dis = Game.powerCreeps['op_disrupt'];
			const t = Game.getObjectById(${towerId});
			[ops.usePower(PWR_OPERATE_TOWER, t), dis.usePower(PWR_DISRUPT_TOWER, t)]
		`) as [number, number];
		expect(rcs[0]).toBe(OK);
		expect(rcs[1]).toBe(OK);

		await shard.tick();

		const sampleAll = async () => await shard.runPlayer('p1', code`
			const t = Game.getObjectById(${towerId});
			({
				entries: (t.effects || []).map(e => ({ power: e.power, effect: e.effect, level: e.level, ticksRemaining: e.ticksRemaining })),
				gameTime: Game.time,
			})
		`) as { entries: EffectEntry[]; gameTime: number };

		const before = await sampleAll();
		const operateEntry = before.entries.find(e => e.power === PWR_OPERATE_TOWER || e.effect === PWR_OPERATE_TOWER);
		const disruptEntry = before.entries.find(e => e.power === PWR_DISRUPT_TOWER || e.effect === PWR_DISRUPT_TOWER);
		expect(operateEntry).toBeDefined();
		expect(disruptEntry).toBeDefined();
		expect(before.entries.length).toBe(2);
		// Independent timers — DISRUPT_TOWER's duration is shorter.
		expect(disruptEntry!.ticksRemaining).toBeLessThan(operateEntry!.ticksRemaining);

		// Tick past the disrupt entry's expiry; OPERATE must survive.
		await shard.tick(disruptEntry!.ticksRemaining + 1);

		const after = await sampleAll();
		const operateSurvived = after.entries.find(e => e.power === PWR_OPERATE_TOWER || e.effect === PWR_OPERATE_TOWER);
		const disruptGone = after.entries.find(e => e.power === PWR_DISRUPT_TOWER || e.effect === PWR_DISRUPT_TOWER);
		expect(operateSurvived).toBeDefined();
		expect(disruptGone).toBeUndefined();

		// OPERATE's timer advanced by exactly the number of ticks elapsed
		// between observations — its lifetime is independent of DISRUPT's
		// expiry. Use measured gameTime rather than counting harness calls.
		const elapsed = after.gameTime - before.gameTime;
		expect(operateEntry!.ticksRemaining - operateSurvived!.ticksRemaining).toBe(elapsed);
	});

	// EFFECT-DESTROY-001 — effects do not transfer to a successor on host destroy.
	// Spec: when a structure carrying active effects is destroyed, the
	// resulting ruin (and any other same-tile successor) must not inherit
	// those effects. Effects are bound to the host object's lifetime.
	test('EFFECT-DESTROY-001 active effects do not transfer to a ruin when the host is destroyed', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.ownedRoom('p1', 'W1N1', 8);
		const towerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TOWER, owner: 'p1',
			store: { energy: 1000 },
		});
		await shard.placePowerCreep('W1N1', {
			pos: [25, 26], owner: 'p1',
			powers: { [PWR_DISRUPT_TOWER]: 1 },
			store: { ops: 200 },
		});
		await shard.tick();

		await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			pc.usePower(PWR_DISRUPT_TOWER, Game.getObjectById(${towerId}))
		`);
		await shard.tick();

		// Confirm the effect is in fact on the tower before destroying it.
		const present = await shard.runPlayer('p1', code`
			const t = Game.getObjectById(${towerId});
			(t.effects || []).some(e => e.power === PWR_DISRUPT_TOWER || e.effect === PWR_DISRUPT_TOWER)
		`) as boolean;
		expect(present).toBe(true);

		const destroyRc = await shard.runPlayer('p1', code`
			Game.getObjectById(${towerId}).destroy()
		`);
		expect(destroyRc).toBe(OK);
		await shard.tick();

		const ruins = await shard.findInRoom('W1N1', FIND_RUINS);
		const ruin = ruins.find(r => r.pos.x === 25 && r.pos.y === 25);
		expect(ruin).toBeDefined();

		// The ruin must not carry the destroyed tower's effect — neither as a
		// migrated entry nor any other.
		const ruinEffects = await shard.runPlayer('p1', code`
			const r = Game.getObjectById(${ruin!.id});
			r ? (r.effects ? r.effects.length : 0) : -1
		`) as number;
		expect(ruinEffects).toBe(0);
	});
});
