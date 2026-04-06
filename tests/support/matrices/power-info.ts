import { POWER_INFO } from '../../../src/index.js';

interface PowerInfoCase {
	powerId: number;
	className: string;
	levels: number[];
	cooldown: number;
	duration: number | undefined;
	effect: number[] | undefined;
	range: number | undefined;
	ops: number | undefined;
	energy: number | undefined;
	period: number | undefined;
}

// Canonical POWER_INFO table — one case per power ID.
export const powerInfoCases: readonly PowerInfoCase[] =
	Object.entries(POWER_INFO)
		.map(([id, info]) => ({
			powerId: Number(id),
			className: info.className,
			levels: [...info.level],
			cooldown: info.cooldown,
			duration: info.duration,
			effect: info.effect ? [...info.effect] : undefined,
			range: info.range,
			ops: info.ops,
			energy: info.energy,
			period: info.period,
		}))
		.sort((a, b) => a.powerId - b.powerId);
