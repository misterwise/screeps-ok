import {
	ATTACK_POWER, EVENT_ATTACK, EVENT_ATTACK_TYPE_MELEE, EVENT_ATTACK_TYPE_RANGED,
	EVENT_HARVEST, EVENT_HEAL, EVENT_HEAL_TYPE_RANGED, EVENT_REPAIR,
	HARVEST_MINERAL_POWER, TOWER_ENERGY_COST,
} from '../index.js';
import { towerAttackRangeCases, towerHealRangeCases, towerRepairRangeCases } from './tower-range.js';

// Towers act at a range inside the falloff band, so the logged amount is scaled.
export const EVENT_LOG_TOWER_RANGE = 10;
const atRange = (cases: ReadonlyArray<{ range: number; expectedAmount: number }>) =>
	cases.find(row => row.range === EVENT_LOG_TOWER_RANGE)!.expectedAmount;

// Two ATTACK parts; three WORK parts on a mineral holding less than they harvest.
export const EVENT_LOG_ATTACK_PARTS = 2;
export const EVENT_LOG_WORK_PARTS = 3;

// ROOM-EVENTLOG-002: each unowned event source's entry, less `targetId`
// (_damage.js:93, towers/heal.js:51, towers/repair.js:52, creeps/harvest.js:110).
export const eventLogSourceCases = [
	{ label: 'creepAttack', event: EVENT_ATTACK, data: { damage: EVENT_LOG_ATTACK_PARTS * ATTACK_POWER, attackType: EVENT_ATTACK_TYPE_MELEE } },
	{ label: 'towerAttack', event: EVENT_ATTACK, data: { damage: atRange(towerAttackRangeCases), attackType: EVENT_ATTACK_TYPE_RANGED } },
	{ label: 'towerHeal', event: EVENT_HEAL, data: { amount: atRange(towerHealRangeCases), healType: EVENT_HEAL_TYPE_RANGED } },
	{ label: 'towerRepair', event: EVENT_REPAIR, data: { amount: atRange(towerRepairRangeCases), energySpent: TOWER_ENERGY_COST } },
	// The WORK parts' harvest power, not what the mineral had left.
	{ label: 'mineralHarvest', event: EVENT_HARVEST, data: { amount: EVENT_LOG_WORK_PARTS * HARVEST_MINERAL_POWER } },
] as const;
