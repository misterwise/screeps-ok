import { describe, test, expect, code,
	OK, ERR_TIRED,
	STRUCTURE_CONTAINER, STRUCTURE_LAB, STRUCTURE_RAMPART,
	ATTACK, CARRY, CLAIM, HEAL, MOVE, RANGED_ATTACK, WORK,
	LAB_REACTION_AMOUNT, PWR_GENERATE_OPS, REACTION_TIME, RESOURCE_ENERGY,
} from '../../src/index.js';
import { timerSafeModeCases } from '../../src/matrices/timer-safemode.js';

const safeModeActionPart: Record<string, string> = {
	attack: ATTACK, rangedAttack: RANGED_ATTACK, rangedMassAttack: RANGED_ATTACK, dismantle: WORK,
	withdraw: CARRY, heal: HEAL, rangedHeal: HEAL, attackController: CLAIM,
};

describe('Timer gating', () => {
	test('TIMER-COOLDOWN-001 action gated by cooldownTime becomes available on the tick cooldown reaches 0', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);

		// Set up three labs for H + O -> OH reaction.
		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000 },
		});
		const lab1 = await shard.placeStructure('W1N1', {
			pos: [25, 27], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, H: 500 },
		});
		const lab2 = await shard.placeStructure('W1N1', {
			pos: [27, 25], structureType: STRUCTURE_LAB, owner: 'p1',
			store: { energy: 2000, O: 500 },
		});

		// First reaction to trigger cooldown.
		const rc1 = await shard.runPlayer('p1', code`
			const lab = Game.getObjectById(${labId});
			lab.runReaction(Game.getObjectById(${lab1}), Game.getObjectById(${lab2}))
		`);
		expect(rc1).toBe(OK);

		// Anchored on the reaction tick: refused while it reads 1, allowed at 0.
		const cooldown = REACTION_TIME.OH;
		const first = await shard.runPlayer('p1', code`Game.getObjectById(${labId}).cooldown`);
		expect(first).toBe(cooldown - 1);
		await shard.tick(cooldown - 3);
		const react = code`
			const lab = Game.getObjectById(${labId});
			({ cooldown: lab.cooldown, rc: lab.runReaction(Game.getObjectById(${lab1}), Game.getObjectById(${lab2})) })
		`;
		expect(await shard.runPlayer('p1', react)).toEqual({ cooldown: 1, rc: ERR_TIRED });
		expect(await shard.runPlayer('p1', react)).toEqual({ cooldown: 0, rc: OK });
	});

	for (const row of timerSafeModeCases) {
		test(`TIMER-SAFEMODE-001:${row.action} a hostile ${row.action} is refused while safeMode reads 1 and allowed the next tick`, async ({ shard }) => {
			if (row.powerCreep) shard.requires('powerCreeps');
			// usePower checks power before safe mode (game/power-creeps.js:255).
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [{ name: 'W1N1', rcl: 1, owner: 'p1', safeMode: 2, powerEnabled: row.action === 'usePower' }],
			});
			const ctrlPos = await shard.getControllerPos('W1N1');
			const actorPos: [number, number] = row.target === 'controller' ? [ctrlPos!.x + 1, ctrlPos!.y + 1] : [25, 26];
			const targetId = row.target === 'rampart'
				? await shard.placeStructure('W1N1', { pos: [25, 25], structureType: STRUCTURE_RAMPART, owner: 'p1', hits: 10000 })
				: row.target === 'container'
					? await shard.placeStructure('W1N1', { pos: [25, 25], structureType: STRUCTURE_CONTAINER, store: { [RESOURCE_ENERGY]: 500 } })
					: row.target === 'friendlyCreep'
						? await shard.placeCreep('W1N1', { pos: [25, 25], owner: 'p2', body: [MOVE] })
						: null;
			const actorId = row.powerCreep
				? await shard.placePowerCreep('W1N1', { pos: actorPos, owner: 'p2', powers: { [PWR_GENERATE_OPS]: 1 } })
				: await shard.placeCreep('W1N1', { pos: actorPos, owner: 'p2', body: [safeModeActionPart[row.action], MOVE] });
			// Seeded 2; this tick leaves the last one.
			await shard.tick();

			// Reads the timer and makes the call in one tick; the target is the controller when none was placed.
			const probe = code`
				const actor = Game.getObjectById(${actorId});
				const target = ${targetId} === null ? Game.rooms.W1N1.controller : Game.getObjectById(${targetId});
				const calls = {
					rangedMassAttack: () => actor.rangedMassAttack(),
					withdraw: () => actor.withdraw(target, RESOURCE_ENERGY),
					usePower: () => actor.usePower(PWR_GENERATE_OPS),
				};
				({ safeMode: Game.rooms.W1N1.controller.safeMode ?? null, rc: (calls[${row.action}] ?? (() => actor[${row.action}](target)))() })
			`;
			expect(await shard.runPlayer('p2', probe)).toEqual({ safeMode: 1, rc: row.refusedRc });
			expect(await shard.runPlayer('p2', probe)).toEqual({ safeMode: null, rc: OK });
		});
	}
});
