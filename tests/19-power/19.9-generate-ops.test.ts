import { describe, test, expect, code,
	OK,
	POWER_INFO, PWR_GENERATE_OPS,
	FIND_DROPPED_RESOURCES, RESOURCE_OPS, ENERGY_DECAY,
} from '../../src/index.js';

const PI = POWER_INFO as Record<number, {
	className: string;
	level: number[];
	cooldown: number;
	effect?: number[];
	duration?: number | number[];
	period?: number;
	ops?: number;
	range?: number;
}>;

describe('PWR_GENERATE_OPS', () => {
	test('POWER-GENERATE-OPS-001 amount, cooldown, and ops cost match POWER_INFO for each supported power level', async ({ shard }) => {
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const info = POWER_INFO[PWR_GENERATE_OPS];
			({
				className: info.className,
				cooldown: info.cooldown,
				effect: info.effect,
				ops: info.ops,
				level: info.level,
			})
		`) as { className: string; cooldown: number; effect: number[]; ops: number | undefined; level: number[] };

		const localInfo = PI[PWR_GENERATE_OPS];
		expect(result.cooldown).toBe(localInfo.cooldown);
		expect(result.effect).toEqual(localInfo.effect);
		expect(result.ops).toBe(localInfo.ops);
	});

	test('POWER-GENERATE-OPS-002 usePower(PWR_GENERATE_OPS) returns OK and adds ops to the power creep store', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});

		await shard.placePowerCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			powers: { [PWR_GENERATE_OPS]: 1 },
			store: { ops: 0 },
		});
		await shard.tick();

		const rc = await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			pc.usePower(PWR_GENERATE_OPS)
		`);
		expect(rc).toBe(OK);

		const ops = await shard.runPlayer('p1', code`
			Object.values(Game.powerCreeps)[0].store.ops
		`) as number;
		expect(ops).toBe(PI[PWR_GENERATE_OPS].effect![0]);
	});

	test('POWER-GENERATE-OPS-003 overflow ops are dropped on the same tile', async ({ shard }) => {
		shard.requires('powerCreeps');
		await shard.createShard({
			players: ['p1'],
			rooms: [{ name: 'W1N1', rcl: 8, owner: 'p1' }],
		});

		// A level-5 creep holds 100 * (5 + 1); leave room for part of one generation.
		const capacity = 600;
		const generated = PI[PWR_GENERATE_OPS].effect![4];
		const free = 3;
		await shard.placePowerCreep('W1N1', {
			pos: [25, 25], owner: 'p1',
			powers: { [PWR_GENERATE_OPS]: 5 },
			store: { ops: capacity - free },
		});
		await shard.tick();

		const result = await shard.runPlayer('p1', code`
			const pc = Object.values(Game.powerCreeps)[0];
			({ capacity: pc.store.getCapacity(), rc: pc.usePower(PWR_GENERATE_OPS) })
		`) as { capacity: number; rc: number };
		expect(result).toEqual({ capacity, rc: OK });

		// The drop decays once in the tick it lands, like any overflow pile.
		const overflow = generated - free;
		const drops = await shard.findInRoom('W1N1', FIND_DROPPED_RESOURCES);
		expect(drops.map(r => ({ x: r.pos.x, y: r.pos.y, resourceType: r.resourceType, amount: r.amount })))
			.toEqual([{ x: 25, y: 25, resourceType: RESOURCE_OPS, amount: overflow - Math.ceil(overflow / ENERGY_DECAY) }]);

		const ops = await shard.runPlayer('p1', code`
			Object.values(Game.powerCreeps)[0].store.ops
		`);
		expect(ops).toBe(capacity);
	});
});
