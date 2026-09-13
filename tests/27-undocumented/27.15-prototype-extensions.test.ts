/**
 * 27.15 Player Prototype Extensions
 *
 * The global game classes are the real prototype chain of live objects:
 * player-added prototype members apply to engine-returned instances and —
 * because the classes persist with the VM — survive tick boundaries even
 * though per-tick instances are discarded (UNDOC-IDENTITY-005).
 */
import { describe, test, expect, code, OK, MOVE, CARRY, WORK, TOP } from '../../src/index.js';

describe('Undocumented API Surface — player prototype extensions', () => {
	test('UNDOC-PROTO-001 leaf-class prototype members apply to live instances in the same tick', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', { pos: [25, 25], owner: 'p1', body: [MOVE], name: 'protoLeaf' });

		const result = await shard.runPlayer('p1', code`
			Creep.prototype.__okLeafCreep = function () { return 'creep-ok'; };
			Structure.prototype.__okLeafStruct = function () { return 'struct-ok'; };
			const creep = Object.values(Game.creeps)[0];
			const struct = Game.rooms['W1N1'].controller;
			({
				creepMethod: typeof creep.__okLeafCreep === 'function' ? creep.__okLeafCreep() : null,
				structMethod: typeof struct.__okLeafStruct === 'function' ? struct.__okLeafStruct() : null,
			})
		`) as { creepMethod: unknown; structMethod: unknown };

		expect(result.creepMethod).toBe('creep-ok');
		expect(result.structMethod).toBe('struct-ok');
	});

	test('UNDOC-PROTO-002 RoomObject.prototype members are inherited by derived-class instances', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', { pos: [25, 25], owner: 'p1', body: [MOVE], name: 'protoBase' });

		const result = await shard.runPlayer('p1', code`
			RoomObject.prototype.__okBase = function () { return 'base-ok'; };
			const creep = Object.values(Game.creeps)[0];
			const struct = Game.rooms['W1N1'].controller;
			({
				creepViaBase: typeof creep.__okBase === 'function' ? creep.__okBase() : null,
				structViaBase: typeof struct.__okBase === 'function' ? struct.__okBase() : null,
				creepIsInstance: creep instanceof Creep,
				structIsInstance: struct instanceof Structure,
			})
		`) as { creepViaBase: unknown; structViaBase: unknown; creepIsInstance: boolean; structIsInstance: boolean };

		expect(result.creepViaBase).toBe('base-ok');
		expect(result.structViaBase).toBe('base-ok');
		expect(result.creepIsInstance).toBe(true);
		expect(result.structIsInstance).toBe(true);
	});

	test('UNDOC-PROTO-003 prototype extensions persist across ticks within the same VM', async ({ shard }) => {
		await shard.ownedRoom('p1');
		await shard.placeCreep('W1N1', { pos: [25, 25], owner: 'p1', body: [MOVE], name: 'protoTick' });

		await shard.runPlayer('p1', code`
			RoomObject.prototype.__okTickBase = function () { return 'base-ok'; };
			Creep.prototype.__okTickCreep = function () { return 'creep-ok'; };
			'installed'
		`);

		// Next tick, without reinstalling: the persistent classes must still
		// carry the extensions even though the instances are fresh objects.
		const result = await shard.runPlayer('p1', code`
			const creep = Object.values(Game.creeps)[0];
			const struct = Game.rooms['W1N1'].controller;
			({
				creepMethod: typeof creep.__okTickCreep === 'function' ? creep.__okTickCreep() : null,
				creepViaBase: typeof creep.__okTickBase === 'function' ? creep.__okTickBase() : null,
				structViaBase: typeof struct.__okTickBase === 'function' ? struct.__okTickBase() : null,
			})
		`) as { creepMethod: unknown; creepViaBase: unknown; structViaBase: unknown };

		expect(result.creepMethod).toBe('creep-ok');
		expect(result.creepViaBase).toBe('base-ok');
		expect(result.structViaBase).toBe('base-ok');
	});

	// Engine methods must live on the CLASS PROTOTYPE, not as own properties of
	// each object. Essentially every serious bot wraps natives:
	//     const orig = Creep.prototype.transfer;
	//     Creep.prototype.transfer = function (...) { const r = orig.call(this, ...); ... };
	// An own-property method shadows the prototype: the wrapper never runs, `orig`
	// is captured as `undefined`, and nothing throws. UNDOC-PROTO-001..003 add
	// members; these two rows wrap existing ones.
	test('UNDOC-PROTO-004 a creep exposes no own method properties and inherits them from Creep.prototype', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', { pos: [25, 25], owner: 'p1', body: [MOVE, CARRY, WORK] });
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			(function () {
				const c = Game.getObjectById(${id});
				const ownMethods = Object.getOwnPropertyNames(c)
					.filter(function (k) { return typeof c[k] === 'function'; });
				return {
					ownMethods: ownMethods,
					protoMove: typeof Creep.prototype.move,
					protoTransfer: typeof Creep.prototype.transfer,
					inherited: c.move === Creep.prototype.move,
				};
			})()
		`) as { ownMethods: string[]; protoMove: string; protoTransfer: string; inherited: boolean };

		expect(result.ownMethods).toEqual([]);
		expect(result.protoMove).toBe('function');
		expect(result.protoTransfer).toBe('function');
		expect(result.inherited).toBe(true);
	});

	test('UNDOC-PROTO-005 a prototype override wraps the native and is the method that runs', async ({ shard }) => {
		await shard.ownedRoom('p1');
		const id = await shard.placeCreep('W1N1', { pos: [25, 25], owner: 'p1', body: [MOVE, CARRY] });
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			(function () {
				const native = Creep.prototype.move;
				if (typeof native !== 'function') return { captured: false };
				globalThis.__wrapCalls = 0;
				Creep.prototype.move = function (dir) {
					globalThis.__wrapCalls++;
					return native.call(this, dir);
				};
				const rc = Game.getObjectById(${id}).move(${TOP});
				return { captured: true, calls: globalThis.__wrapCalls, rc: rc };
			})()
		`) as { captured: boolean; calls: number; rc: number };

		// The bot could capture the native (not undefined), its wrapper actually
		// ran, and the native still produced the normal return code.
		expect(result.captured).toBe(true);
		expect(result.calls).toBe(1);
		expect(result.rc).toBe(OK);
	});
});
