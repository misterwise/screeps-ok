import { POWER_INFO, PWR_REGEN_MINERAL } from '../../../src/index.js';
const info = POWER_INFO[PWR_REGEN_MINERAL];

interface MineralPowerCase {
	powerLevel: number;
	expectedEffect: number;
	expectedDuration: number;
	expectedPeriod: number;
	expectedCooldown: number;
}

// Canonical PWR_REGEN_MINERAL table — effect, duration, period, cooldown per level.
export const mineralPowerCases: readonly MineralPowerCase[] =
	info.level.map((_, i) => ({
		powerLevel: i,
		expectedEffect: info.effect![i],
		expectedDuration: info.duration!,
		expectedPeriod: info.period!,
		expectedCooldown: info.cooldown,
	}));
