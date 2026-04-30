/**
 * 15.5 Effects Host Matrix
 *
 * Verifies that every currently feasible active effect producer/target pair
 * exposes the produced entry on the target RoomObject's public `effects`
 * array. Effect magnitudes remain owned by the power-specific sections.
 */
import { describe, test, expect, code,
	OK, STRUCTURE_RAMPART,
	type PlayerCode,
} from '../../src/index.js';
import { effectHostCases } from '../../src/matrices/effect-hosts.js';

type TargetSpec =
	| { kind: 'id'; id: string }
	| { kind: 'controller'; roomName: string }
	| { kind: 'shieldRampart'; roomName: string; pos: [number, number]; structureType: string };

type ObservedEffectEntry = {
	power: number | null;
	effect: number | null;
	level: number | null;
	ticksRemaining: number | null;
	shape: string[];
};

type EffectObservation = {
	targetExists: boolean;
	isArray: boolean;
	effectsLength: number;
	entry: ObservedEffectEntry | null;
};

const EFFECT_ENTRY_SHAPE = Object.freeze(['effect', 'level', 'power', 'ticksRemaining'].sort());

const DATA_PROPS_FN = `function dataProps(obj) {
	var props = new Set();
	var proto = obj;
	while (proto && proto !== Object.prototype) {
		var keys = Object.getOwnPropertyNames(proto);
		for (var i = 0; i < keys.length; i++) {
			var key = keys[i];
			if (key === 'constructor') continue;
			if (key.charAt(0) === '_' || key.charAt(0) === '#') continue;
			var d = Object.getOwnPropertyDescriptor(proto, key);
			if (d.get) { props.add(key); continue; }
			if (typeof d.value === 'function') continue;
			props.add(key);
		}
		proto = Object.getPrototypeOf(proto);
	}
	return Array.from(props).sort();
}`;

function effectHostCode(strings: TemplateStringsArray, ...values: unknown[]): PlayerCode {
	let body = strings[0];
	for (let i = 0; i < values.length; i++) {
		body += JSON.stringify(values[i]);
		body += strings[i + 1];
	}
	return `${DATA_PROPS_FN}\n${body}` as PlayerCode;
}

describe('15.5 Effects Host Matrix', () => {
	for (const row of effectHostCases) {
		test(`EFFECT-HOST-001 [${row.label}] target exposes active effects entry`, async ({ shard }) => {
			shard.requires('powerCreeps');
			if (row.capability) shard.requires(row.capability);

			const roomName = 'W1N1';
			await shard.ownedRoom('p1', roomName, 8);

			let targetSpec: TargetSpec;
			switch (row.target.kind) {
				case 'structure': {
					const id = await shard.placeStructure(roomName, {
						pos: [row.target.pos[0], row.target.pos[1]],
						structureType: row.target.structureType,
						owner: 'p1',
						...row.target.extra,
					});
					targetSpec = { kind: 'id', id };
					break;
				}
				case 'source': {
					const id = await shard.placeSource(roomName, {
						pos: [row.target.pos[0], row.target.pos[1]],
						energy: row.target.energy,
						energyCapacity: row.target.energyCapacity,
					});
					targetSpec = { kind: 'id', id };
					break;
				}
				case 'mineral': {
					const id = await shard.placeMineral(roomName, {
						pos: [row.target.pos[0], row.target.pos[1]],
						mineralType: row.target.mineralType,
						mineralAmount: row.target.mineralAmount,
					});
					targetSpec = { kind: 'id', id };
					break;
				}
				case 'controller':
					targetSpec = { kind: 'controller', roomName };
					break;
				case 'shieldRampart':
					targetSpec = {
						kind: 'shieldRampart',
						roomName,
						pos: [row.target.pos[0], row.target.pos[1]],
						structureType: STRUCTURE_RAMPART,
					};
					break;
			}

			let powerCreepPos: [number, number] = [25, 26];
			if (row.target.kind === 'controller') {
				const controllerPos = await shard.getControllerPos(roomName);
				if (!controllerPos) throw new Error(`${roomName} has no controller`);
				powerCreepPos = [controllerPos.x < 48 ? controllerPos.x + 1 : controllerPos.x - 1, controllerPos.y];
			} else if (row.target.kind === 'shieldRampart') {
				powerCreepPos = [row.target.pos[0], row.target.pos[1]];
			}

			await shard.placePowerCreep(roomName, {
				pos: powerCreepPos,
				owner: 'p1',
				powers: { [row.power]: row.powerLevel },
				store: { ops: 200 },
			});
			await shard.tick();

			const rc = await shard.runPlayer('p1', code`
				(function() {
					const spec = ${targetSpec};
					const pc = Object.values(Game.powerCreeps)[0];
					if (spec.kind === 'shieldRampart') return pc.usePower(${row.power});
					const target = spec.kind === 'controller'
						? Game.rooms[spec.roomName].controller
						: Game.getObjectById(spec.id);
					return target ? pc.usePower(${row.power}, target) : -999;
				})()
			`);
			expect(rc).toBe(OK);

			const observed = await shard.runPlayer('p1', effectHostCode`
				(function() {
					const spec = ${targetSpec};
					const expectedPower = ${row.expectedPower ?? null};
					const expectedEffect = ${row.expectedEffect ?? null};
					function resolveTarget() {
						if (spec.kind === 'controller') return Game.rooms[spec.roomName].controller;
						if (spec.kind === 'shieldRampart') {
							const pos = new RoomPosition(spec.pos[0], spec.pos[1], spec.roomName);
							return pos.lookFor(LOOK_STRUCTURES).find(s => s.structureType === spec.structureType) || null;
						}
						return Game.getObjectById(spec.id);
					}
					const target = resolveTarget();
					const arr = target && target.effects;
					const entries = Array.isArray(arr) ? arr : [];
					const entry = entries.find(e =>
						(expectedPower !== null && e.power === expectedPower) ||
						(expectedEffect !== null && e.effect === expectedEffect)
					) || null;
					return {
						targetExists: !!target,
						isArray: Array.isArray(arr),
						effectsLength: entries.length,
						entry: entry ? {
							power: entry.power === undefined ? null : entry.power,
							effect: entry.effect === undefined ? null : entry.effect,
							level: entry.level === undefined ? null : entry.level,
							ticksRemaining: typeof entry.ticksRemaining === 'number' ? entry.ticksRemaining : null,
							shape: dataProps(entry),
						} : null,
					};
				})()
			`) as EffectObservation;

			expect(observed.targetExists).toBe(true);
			expect(observed.isArray).toBe(true);
			expect(observed.effectsLength).toBeGreaterThan(0);
			expect(observed.entry).not.toBeNull();
			expect(observed.entry!.shape).toEqual([...EFFECT_ENTRY_SHAPE]);
			if (row.expectedPower !== undefined) expect(observed.entry!.power).toBe(row.expectedPower);
			if (row.expectedEffect !== undefined) expect(observed.entry!.effect).toBe(row.expectedEffect);
			else expect(observed.entry!.effect).toBeNull();
			if (row.expectedLevel !== undefined) expect(observed.entry!.level).toBe(row.expectedLevel);
			expect(observed.entry!.ticksRemaining).not.toBeNull();
			expect(observed.entry!.ticksRemaining!).toBeGreaterThan(0);
		});
	}
});
