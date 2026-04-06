import { POWER_INFO } from '../../../src/index.js';

const PWR_OPERATE_TOWER = 3;
const PWR_DISRUPT_TOWER = 10;
const operateInfo = POWER_INFO[PWR_OPERATE_TOWER];
const disruptInfo = POWER_INFO[PWR_DISRUPT_TOWER];

interface TowerPowerCase {
	power: 'operate' | 'disrupt';
	powerLevel: number;
	expectedEffect: number;
	expectedDuration: number;
	expectedCooldown: number;
}

// Canonical tower power effect table — operate (buff) and disrupt (debuff) per level.
export const towerPowerCases: readonly TowerPowerCase[] = [
	...operateInfo.level.map((_, i) => ({
		power: 'operate' as const,
		powerLevel: i,
		expectedEffect: operateInfo.effect![i],
		expectedDuration: operateInfo.duration!,
		expectedCooldown: operateInfo.cooldown,
	})),
	...disruptInfo.level.map((_, i) => ({
		power: 'disrupt' as const,
		powerLevel: i,
		expectedEffect: disruptInfo.effect![i],
		expectedDuration: disruptInfo.duration!,
		expectedCooldown: disruptInfo.cooldown,
	})),
];
