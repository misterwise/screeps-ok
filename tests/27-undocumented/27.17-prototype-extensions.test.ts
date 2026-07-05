import { describe, test, expect, code } from '../../src/index.js';

// This came up as an error running a real bot on an experimental screeps engine —
// player-added members on the engine object prototypes (RoomObject/Creep/Structure) did
// not apply to live objects or persist across ticks. No screeps-ok suite covers it; this
// test is meant to cover that gap.
describe('PROTO-EXT-001: player prototype extensions apply to instances and persist across ticks', () => {
	test('a RoomObject.prototype member added on tick 1 applies to creep + structure on tick 2', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', { pos: [25, 25], owner: 'p1', body: ['move'], name: 'protoCreep' });

		// Tick 1: install prototype extensions on the base and leaf classes.
		await shard.runPlayer('p1', code`
			RoomObject.prototype.__okBase = function () { return 'base-ok'; };
			Creep.prototype.__okCreep = function () { return 'creep-ok'; };
			Structure.prototype.__okStruct = function () { return 'struct-ok'; };
			'installed'
		`);

		await shard.tick();

		// Tick 2: WITHOUT reinstalling, the extensions must still apply to live objects.
		const result = await shard.runPlayer('p1', code`
			(function () {
				const creep = Object.values(Game.creeps)[0];
				const struct = Game.rooms['W1N1'].controller; // StructureController -> Structure -> RoomObject
				return {
					// leaf-class extension applies
					creepMethod: typeof creep.__okCreep === 'function' ? creep.__okCreep() : null,
					structMethod: typeof struct.__okStruct === 'function' ? struct.__okStruct() : null,
					// base-class (RoomObject) extension applies to both leaves
					creepViaBase: typeof creep.__okBase === 'function' ? creep.__okBase() : null,
					structViaBase: typeof struct.__okBase === 'function' ? struct.__okBase() : null,
					// objects are genuine instances of the persistent global classes
					creepIsInstance: creep instanceof Creep,
					structIsInstance: struct instanceof Structure,
				};
			})()
		`) as Record<string, unknown>;

		expect(result.creepMethod).toBe('creep-ok');
		expect(result.structMethod).toBe('struct-ok');
		expect(result.creepViaBase).toBe('base-ok');
		expect(result.structViaBase).toBe('base-ok');
		expect(result.creepIsInstance).toBe(true);
		expect(result.structIsInstance).toBe(true);
	});
});
