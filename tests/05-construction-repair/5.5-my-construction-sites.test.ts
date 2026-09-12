import { describe, test, expect, code, OK,
	FIND_MY_CONSTRUCTION_SITES, STRUCTURE_EXTENSION,
} from '../../src/index.js';

describe('owner-scoped construction site access', () => {
	// Real bots key their build pipeline off the "my"-scoped APIs; a gap here
	// silently stalls construction even when FIND_CONSTRUCTION_SITES works.
	test('CONSTRUCTION-SITE-018 FIND_MY_CONSTRUCTION_SITES and Game.constructionSites expose the placed site', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 3, owner: 'p1' }],
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			Game.rooms['W1N1'].createConstructionSite(30, 30, ${STRUCTURE_EXTENSION})
		`);
		expect(rc).toBe(OK);
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			(function () {
				const mySites = Game.rooms['W1N1'].find(${FIND_MY_CONSTRUCTION_SITES});
				return [
					mySites.length,
					Object.keys(Game.constructionSites).length,
					mySites[0] ? mySites[0].my : null,
					mySites[0] ? mySites[0].structureType : null,
				];
			})()
		`);
		expect(result).toEqual([1, 1, true, STRUCTURE_EXTENSION]);
	});
});
