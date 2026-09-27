import { describe, test, expect, code,
	OK, ERR_TIRED,
	STRUCTURE_CONTAINER, STRUCTURE_EXTRACTOR, STRUCTURE_FACTORY, STRUCTURE_LAB, STRUCTURE_LINK,
	STRUCTURE_NUKER, STRUCTURE_RAMPART, STRUCTURE_TERMINAL,
	ATTACK, CARRY, CLAIM, HEAL, MOVE, RANGED_ATTACK, WORK,
	COMMODITIES, LAB_REACTION_AMOUNT, LINK_CAPACITY, NUKER_ENERGY_CAPACITY, NUKER_GHODIUM_CAPACITY, PWR_GENERATE_OPS,
	RESOURCE_BATTERY, RESOURCE_ENERGY, RESOURCE_GHODIUM, RESOURCE_HYDROGEN, RESOURCE_HYDROXIDE, RESOURCE_OXYGEN,
	RESOURCE_SILICON, RESOURCE_UTRIUM_HYDRIDE,
} from '../../src/index.js';
import type { PlayerCode } from '../../src/index.js';
import type { ShardFixture } from '../../src/fixture.js';
import { timerCooldownCases } from '../../src/matrices/timer-cooldown.js';
import { timerSafeModeCases } from '../../src/matrices/timer-safemode.js';

const safeModeActionPart: Record<string, string> = {
	attack: ATTACK, rangedAttack: RANGED_ATTACK, rangedMassAttack: RANGED_ATTACK, dismantle: WORK,
	withdraw: CARRY, heal: HEAL, rangedHeal: HEAL, attackController: CLAIM,
};

// Each action set up to succeed but for a cooldown seeded at 1; the probe reads that cooldown and makes the call.
const cooldownSetups: Record<string, (shard: ShardFixture) => Promise<PlayerCode>> = {
	async runReaction(shard) {
		await shard.ownedRoom('p1', 'W1N1', 6);
		const labId = await shard.placeStructure('W1N1', { pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1', cooldown: 1 });
		const lab1 = await shard.placeStructure('W1N1', { pos: [25, 27], structureType: STRUCTURE_LAB, owner: 'p1', store: { [RESOURCE_HYDROGEN]: LAB_REACTION_AMOUNT } });
		const lab2 = await shard.placeStructure('W1N1', { pos: [27, 25], structureType: STRUCTURE_LAB, owner: 'p1', store: { [RESOURCE_OXYGEN]: LAB_REACTION_AMOUNT } });
		return code`
			const lab = Game.getObjectById(${labId});
			({ cooldown: lab.cooldown, rc: lab.runReaction(Game.getObjectById(${lab1}), Game.getObjectById(${lab2})) })
		`;
	},
	async reverseReaction(shard) {
		await shard.ownedRoom('p1', 'W1N1', 6);
		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1', cooldown: 1, store: { [RESOURCE_HYDROXIDE]: LAB_REACTION_AMOUNT },
		});
		const lab1 = await shard.placeStructure('W1N1', { pos: [25, 27], structureType: STRUCTURE_LAB, owner: 'p1' });
		const lab2 = await shard.placeStructure('W1N1', { pos: [27, 25], structureType: STRUCTURE_LAB, owner: 'p1' });
		return code`
			const lab = Game.getObjectById(${labId});
			({ cooldown: lab.cooldown, rc: lab.reverseReaction(Game.getObjectById(${lab1}), Game.getObjectById(${lab2})) })
		`;
	},
	async unboostCreep(shard) {
		await shard.ownedRoom('p1', 'W1N1', 6);
		const labId = await shard.placeStructure('W1N1', { pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1', cooldown: 1 });
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1', body: [ATTACK, MOVE], boosts: { 0: RESOURCE_UTRIUM_HYDRIDE },
		});
		return code`
			const lab = Game.getObjectById(${labId});
			({ cooldown: lab.cooldown, rc: lab.unboostCreep(Game.getObjectById(${creepId})) })
		`;
	},
	async transferEnergy(shard) {
		await shard.ownedRoom('p1', 'W1N1', 5);
		const linkId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LINK, owner: 'p1', cooldown: 1, store: { [RESOURCE_ENERGY]: LINK_CAPACITY },
		});
		const targetId = await shard.placeStructure('W1N1', { pos: [30, 30], structureType: STRUCTURE_LINK, owner: 'p1' });
		return code`
			const link = Game.getObjectById(${linkId});
			({ cooldown: link.cooldown, rc: link.transferEnergy(Game.getObjectById(${targetId})) })
		`;
	},
	async send(shard) {
		shard.requires('terminal');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 6, owner: 'p1' }, { name: 'W2N1', rcl: 6, owner: 'p1' }],
		});
		const terminalId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1', cooldown: 1, store: { [RESOURCE_ENERGY]: 10000 },
		});
		await shard.placeStructure('W2N1', { pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1' });
		return code`
			const terminal = Game.getObjectById(${terminalId});
			({ cooldown: terminal.cooldown, rc: terminal.send(RESOURCE_ENERGY, 100, 'W2N1') })
		`;
	},
	async deal(shard) {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 6, owner: 'p1' }, { name: 'W5N1', rcl: 6, owner: 'p2' }],
		});
		const terminalId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p1', cooldown: 1, store: { [RESOURCE_ENERGY]: 10000 },
		});
		await shard.placeStructure('W5N1', {
			pos: [25, 25], structureType: STRUCTURE_TERMINAL, owner: 'p2', store: { [RESOURCE_ENERGY]: 10000, [RESOURCE_HYDROGEN]: 100 },
		});
		const orderId = await shard.placeMarketOrder({
			owner: 'p2', type: 'sell', resourceType: RESOURCE_HYDROGEN, price: 1, totalAmount: 100, roomName: 'W5N1',
		});
		return code`
			({ cooldown: Game.getObjectById(${terminalId}).cooldown, rc: Game.market.deal(${orderId}, 1, 'W1N1') })
		`;
	},
	async launchNuke(shard) {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }, { name: 'W2N1', rcl: 1, owner: 'p2' }],
		});
		const nukerId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_NUKER, owner: 'p1', cooldown: 1,
			store: { [RESOURCE_ENERGY]: NUKER_ENERGY_CAPACITY, [RESOURCE_GHODIUM]: NUKER_GHODIUM_CAPACITY },
		});
		return code`
			const nuker = Game.getObjectById(${nukerId});
			({ cooldown: nuker.cooldown, rc: nuker.launchNuke(new RoomPosition(25, 25, 'W2N1')) })
		`;
	},
	async produce(shard) {
		await shard.ownedRoom('p1', 'W1N1', 7);
		const factoryId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_FACTORY, owner: 'p1', cooldown: 1,
			store: { ...COMMODITIES[RESOURCE_BATTERY].components },
		});
		return code`
			const factory = Game.getObjectById(${factoryId});
			({ cooldown: factory.cooldown, rc: factory.produce(RESOURCE_BATTERY) })
		`;
	},
	async harvestMineral(shard) {
		await shard.ownedRoom('p1', 'W1N1', 6);
		const extractorId = await shard.placeStructure('W1N1', { pos: [25, 26], structureType: STRUCTURE_EXTRACTOR, owner: 'p1', cooldown: 1 });
		const mineralId = await shard.placeMineral('W1N1', { pos: [25, 26], mineralType: RESOURCE_HYDROGEN });
		const creepId = await shard.placeCreep('W1N1', { pos: [25, 25], owner: 'p1', body: [WORK, CARRY, MOVE] });
		return code`
			({
				cooldown: Game.getObjectById(${extractorId}).cooldown,
				rc: Game.getObjectById(${creepId}).harvest(Game.getObjectById(${mineralId})),
			})
		`;
	},
	async harvestDeposit(shard) {
		await shard.ownedRoom('p1');
		const depositId = await shard.placeObject('W1N1', 'deposit', { pos: [25, 26], depositType: RESOURCE_SILICON, cooldown: 1 });
		const creepId = await shard.placeCreep('W1N1', { pos: [25, 25], owner: 'p1', body: [WORK, CARRY, MOVE] });
		return code`
			const deposit = Game.getObjectById(${depositId});
			({ cooldown: deposit.cooldown, rc: Game.getObjectById(${creepId}).harvest(deposit) })
		`;
	},
	async usePower(shard) {
		await shard.createShard({ players: ['p1'], rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1', powerEnabled: true }] });
		const creepId = await shard.placePowerCreep('W1N1', {
			pos: [25, 25], owner: 'p1', powers: { [PWR_GENERATE_OPS]: { level: 1, cooldown: 1 } },
		});
		return code`
			const pc = Game.getObjectById(${creepId});
			({ cooldown: pc.powers[PWR_GENERATE_OPS].cooldown, rc: pc.usePower(PWR_GENERATE_OPS) })
		`;
	},
};

describe('Timer gating', () => {
	for (const row of timerCooldownCases) {
		test(`TIMER-COOLDOWN-001:${row.action} is refused while its cooldown reads 1 and allowed at 0`, async ({ shard }) => {
			if (row.capability) shard.requires(row.capability);
			const probe = await cooldownSetups[row.action](shard);
			expect(await shard.runPlayer('p1', probe)).toEqual({ cooldown: 1, rc: ERR_TIRED });
			expect(await shard.runPlayer('p1', probe)).toEqual({ cooldown: 0, rc: OK });
		});
	}

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
