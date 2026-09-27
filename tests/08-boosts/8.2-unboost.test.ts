import { describe, test, expect, code,
	OK,
	STRUCTURE_LAB, FIND_DROPPED_RESOURCES,
	MOVE, ATTACK, WORK,
	RESOURCE_UTRIUM_HYDRIDE, LAB_ENERGY_CAPACITY,
	LAB_UNBOOST_MINERAL, LAB_REACTION_AMOUNT,
	REACTIONS, REACTION_TIME, ENERGY_DECAY,
} from '../../src/index.js';
import { boostTableCases } from '../../src/matrices/boost-tables.js';
import { unboostValidationCases } from '../../src/matrices/unboost-validation.js';

const UH = RESOURCE_UTRIUM_HYDRIDE;
const firstCompound = (mechanic: string) => boostTableCases.find(row => row.mechanic === mechanic)!.compound;
const lastCompound = (mechanic: string) => boostTableCases.filter(row => row.mechanic === mechanic).at(-1)!.compound;

// Ticks of every reaction on the way to `compound`, reagents included
// (utils.js:665-669).
function totalReactionTime(compound: string): number {
	if (!REACTION_TIME[compound]) return 0;
	const [a, b] = Object.entries(REACTIONS).flatMap(([first, products]) =>
		Object.entries(products).filter(([, product]) => product === compound).map(([second]) => [first, second]))[0];
	return REACTION_TIME[compound] + totalReactionTime(a) + totalReactionTime(b);
}

describe('lab.unboostCreep()', () => {
	test('UNBOOST-001 unboostCreep returns OK and removes every boost from the creep', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);
		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1', store: { energy: LAB_ENERGY_CAPACITY },
		});
		const boosts = [firstCompound('attack'), firstCompound('build'), firstCompound('fatigue')];
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1', body: [ATTACK, WORK, MOVE], boosts: { ...boosts },
		});
		const boosted = await shard.expectObject(creepId, 'creep');
		expect(boosted.body.map(part => part.boost ?? null)).toEqual(boosts);

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${labId}).unboostCreep(Game.getObjectById(${creepId}))
		`);
		expect(rc).toBe(OK);
		const unboosted = await shard.expectObject(creepId, 'creep');
		expect(unboosted.body.map(part => part.boost ?? null)).toEqual([null, null, null]);
	});

	test('UNBOOST-004 unboost drops LAB_UNBOOST_MINERAL per part as a resource pile at the creep tile', async ({ shard }) => {
		shard.requires('chemistry');
		await shard.ownedRoom('p1', 'W1N1', 6);
		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1', store: { energy: LAB_ENERGY_CAPACITY },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1', body: [ATTACK, ATTACK, MOVE], boosts: { 0: UH, 1: UH },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${labId}).unboostCreep(Game.getObjectById(${creepId}))
		`);
		expect(rc).toBe(OK);
		// The pile decays once on the tick it lands (DROP-DECAY-001).
		const dropped = 2 * LAB_UNBOOST_MINERAL;
		const piles = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		expect(piles.map(pile => ({ pos: [pile.pos.x, pile.pos.y], resourceType: pile.resourceType, amount: pile.amount })))
			.toEqual([{ pos: [25, 26], resourceType: UH, amount: dropped - Math.ceil(dropped / ENERGY_DECAY) }]);
		const lab = await shard.expectStructure(labId, STRUCTURE_LAB);
		expect(lab.store).toEqual({ energy: LAB_ENERGY_CAPACITY });
	});

	test('UNBOOST-005 unboost cooldown sums parts * calcTotalReactionsTime * LAB_UNBOOST_MINERAL / LAB_REACTION_AMOUNT over compounds', async ({ shard }) => {
		shard.requires('chemistry');
		// Two parts carry a tier-3 attack compound and one a tier-1 build compound.
		const attackCompound = lastCompound('attack');
		const buildCompound = firstCompound('build');
		await shard.ownedRoom('p1', 'W1N1', 6);
		const labId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_LAB, owner: 'p1', store: { energy: LAB_ENERGY_CAPACITY },
		});
		const creepId = await shard.placeCreep('W1N1', {
			pos: [25, 26], owner: 'p1', body: [ATTACK, ATTACK, WORK, MOVE],
			boosts: { 0: attackCompound, 1: attackCompound, 2: buildCompound },
		});

		const rc = await shard.runPlayer('p1', code`
			Game.getObjectById(${labId}).unboostCreep(Game.getObjectById(${creepId}))
		`);
		expect(rc).toBe(OK);
		const cooldown = (2 * totalReactionTime(attackCompound) + totalReactionTime(buildCompound))
			* LAB_UNBOOST_MINERAL / LAB_REACTION_AMOUNT;
		// The snapshot reads the tick after the unboost.
		const lab = await shard.expectStructure(labId, STRUCTURE_LAB);
		expect(lab.cooldown).toBe(cooldown - 1);
	});

	for (const row of unboostValidationCases) {
		test(`UNBOOST-006:${row.label} unboostCreep() validation returns the canonical code`, async ({ shard }) => {
			shard.requires('chemistry');
			const blockers = shard.validationBlockers(row);
			const labOwner = blockers.has('lab-not-owner') ? 'p2' : 'p1';
			// Paired with invalid-target, the target that isn't the player's is the lab standing in for the creep.
			const targetOwner = blockers.has('creep-not-owner') ? 'p2' : 'p1';
			await shard.createShard({
				players: ['p1', 'p2'],
				rooms: [{ name: 'W1N1', rcl: blockers.has('rcl') ? 5 : 6, owner: 'p1' }],
			});
			const labId = await shard.placeStructure('W1N1', {
				pos: [25, 25],
				structureType: STRUCTURE_LAB,
				owner: labOwner,
				store: { energy: LAB_ENERGY_CAPACITY },
				...(blockers.has('cooldown') ? { cooldown: REACTION_TIME[UH] } : {}),
			});
			const targetPos: [number, number] = blockers.has('range') ? [25, 28] : [25, 26];
			const targetId = blockers.has('invalid-target')
				? await shard.placeStructure('W1N1', {
					pos: targetPos,
					structureType: STRUCTURE_LAB,
					owner: targetOwner,
					store: { energy: LAB_ENERGY_CAPACITY },
				})
				: await shard.placeCreep('W1N1', {
					pos: targetPos,
					owner: targetOwner,
					body: [ATTACK, MOVE],
					boosts: blockers.has('not-found') ? {} : { 0: UH },
				});
			await shard.tick();

			const rc = await shard.runPlayer('p1', code`
				Game.getObjectById(${labId}).unboostCreep(Game.getObjectById(${targetId}))
			`);
			expect(rc).toBe(row.expectedRc);
		});
	}
});
