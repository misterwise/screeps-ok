import { POWER_INFO } from '../constants.js';

// A power's `ops` and `duration` at a level, where POWER_INFO holds either one number or one per level.
const atLevel = (value: number | number[] | undefined, level: number): number =>
	Array.isArray(value) ? value[level - 1] : value ?? 0;

export const powerOps = (power: number, level: number): number => atLevel(POWER_INFO[power].ops, level);

export function powerDuration(power: number, level: number): number {
	const duration = POWER_INFO[power].duration;
	if (duration === undefined) throw new Error(`POWER_INFO[${power}] has no duration`);
	return atLevel(duration, level);
}
