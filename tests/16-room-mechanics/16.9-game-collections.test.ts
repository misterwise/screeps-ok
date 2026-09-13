import { describe, test, expect, code,
	MOVE,
	STRUCTURE_SPAWN, STRUCTURE_EXTENSION, STRUCTURE_ROAD, STRUCTURE_WALL, STRUCTURE_CONTROLLER,
} from '../../src/index.js';

describe('Game object lookup and collections', () => {
	// Bots resolve ids straight out of Memory, where the value is routinely stale,
	// absent, or null. Engine game.js:172 is `register._objects[id] || null`, so
	// every miss is a null and never a throw.
	test('GAME-LOOKUP-001 Game.getObjectById returns null for an unknown id and for undefined or null', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const creepId = await shard.placeCreep('W1N1', { pos: [25, 25], owner: 'p1', body: [MOVE] });
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			[
				Game.getObjectById(${creepId}) !== null,
				Game.getObjectById('0123456789abcdef0123456'),
				Game.getObjectById(undefined),
				Game.getObjectById(null),
			]
		`);
		expect(result).toEqual([true, null, null, null]);
	});

	test('GAME-STRUCTURES-001 Game.structures holds exactly the player\'s owned structures keyed by id', async ({ shard }) => {
		await shard.createShard({
			players: ['p1', 'p2'],
			rooms: [{ name: 'W1N1', rcl: 2, owner: 'p1' }],
		});
		const spawnId = await shard.placeStructure('W1N1', {
			pos: [25, 25], structureType: STRUCTURE_SPAWN, owner: 'p1',
		});
		const extId = await shard.placeStructure('W1N1', {
			pos: [26, 25], structureType: STRUCTURE_EXTENSION, owner: 'p1',
		});
		await shard.placeStructure('W1N1', {
			pos: [27, 25], structureType: STRUCTURE_SPAWN, owner: 'p2',
		});
		await shard.placeStructure('W1N1', { pos: [23, 25], structureType: STRUCTURE_ROAD });
		await shard.placeStructure('W1N1', { pos: [28, 25], structureType: STRUCTURE_WALL });
		await shard.tick();

		// The owned controller is a structure too, so it is the third entry.
		const result = await shard.runPlayer('p1', code`
			(function () {
				const ids = Object.keys(Game.structures);
				return {
					types: ids.map(function (id) { return Game.structures[id].structureType; }).sort(),
					hasSpawn: Game.structures[${spawnId}] !== undefined,
					hasExtension: Game.structures[${extId}] !== undefined,
					keyed: ids.every(function (id) { return Game.structures[id].id === id; }),
					mine: ids.every(function (id) { return Game.structures[id].my === true; }),
				};
			})()
		`) as { types: string[]; hasSpawn: boolean; hasExtension: boolean; keyed: boolean; mine: boolean };

		expect(result).toEqual({
			types: [STRUCTURE_CONTROLLER, STRUCTURE_EXTENSION, STRUCTURE_SPAWN].sort(),
			hasSpawn: true,
			hasExtension: true,
			keyed: true,
			mine: true,
		});
	});
});
