import { describe, test, expect, code, OK, STRUCTURE_EXTENSION } from '../../src/index.js';

const FIND_MY_CONSTRUCTION_SITES = 114;

// A player must see its OWN construction sites through the "my"-scoped APIs:
// room.find(FIND_MY_CONSTRUCTION_SITES) and Game.constructionSites. Real bots key
// their build pipeline off these (a builder/worker director that finds zero own
// sites never assigns building), so a gap here silently stalls construction even
// though FIND_CONSTRUCTION_SITES works. Previously uncovered.
describe('MY-CONSTRUCTION-SITES-001: player sees its own construction sites', () => {
	test('FIND_MY_CONSTRUCTION_SITES and Game.constructionSites expose the placed site', async ({ shard }) => {
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
				const rm = Game.rooms['W1N1'];
				const mySites = rm.find(${FIND_MY_CONSTRUCTION_SITES});
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
