import { POWER_INFO, PWR_REGEN_SOURCE } from '../../../src/index.js';
const info = POWER_INFO[PWR_REGEN_SOURCE];

interface SourcePowerCase {
	powerLevel: number;
	expectedEffect: number;
	expectedDuration: number;
	expectedPeriod: number;
	expectedCooldown: number;
}

// Canonical PWR_REGEN_SOURCE table — effect, duration, period, cooldown per level.
export const sourcePowerCases: readonly SourcePowerCase[] =
	info.level.map((_, i) => ({
		powerLevel: i,
		expectedEffect: info.effect![i],
		expectedDuration: info.duration!,
		expectedPeriod: info.period!,
		expectedCooldown: info.cooldown,
	}));
