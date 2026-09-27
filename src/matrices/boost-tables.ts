import { BOOSTS } from '../index.js';
import { toLabelToken } from './validation-cases.js';

// The section 8 row that owns each BOOSTS mechanic's magnitudes.
const boostTableRows = [
	{ mechanic: 'attack', catalogId: 'BOOST-ATTACK-001' },
	{ mechanic: 'rangedAttack', catalogId: 'BOOST-RANGED-001' },
	{ mechanic: 'rangedMassAttack', catalogId: 'BOOST-RANGED-001' },
	{ mechanic: 'heal', catalogId: 'BOOST-HEAL-001' },
	{ mechanic: 'rangedHeal', catalogId: 'BOOST-HEAL-001' },
	{ mechanic: 'damage', catalogId: 'BOOST-TOUGH-001' },
	{ mechanic: 'harvest', catalogId: 'BOOST-HARVEST-001' },
	{ mechanic: 'build', catalogId: 'BOOST-BUILD-001' },
	{ mechanic: 'repair', catalogId: 'BOOST-BUILD-001' },
	{ mechanic: 'dismantle', catalogId: 'BOOST-DISMANTLE-001' },
	{ mechanic: 'upgradeController', catalogId: 'BOOST-UPGRADE-001' },
	{ mechanic: 'fatigue', catalogId: 'BOOST-MOVE-001' },
	{ mechanic: 'capacity', catalogId: 'BOOST-CARRY-001' },
] as const;

type BoostTableRow = (typeof boostTableRows)[number];
export type BoostMechanic = BoostTableRow['mechanic'];

export interface BoostTableCase {
	catalogId: BoostTableRow['catalogId'];
	label: string;
	bodyPart: string;
	compound: string;
	mechanic: BoostMechanic;
	multiplier: number;
}

// One case per BOOSTS (body part, compound, mechanic) triple, keyed
// `:<compound><Mechanic>` (`:UHAttack`, `:KORangedMassAttack`).
export const boostTableCases: readonly BoostTableCase[] = Object.entries(BOOSTS).flatMap(([bodyPart, compounds]) =>
	Object.entries(compounds).flatMap(([compound, effects]) =>
		Object.entries(effects).map(([mechanic, multiplier]) => {
			const row = boostTableRows.find(candidate => candidate.mechanic === mechanic);
			if (!row) throw new Error(`boostTableCases: no section 8 row owns BOOSTS mechanic '${mechanic}'`);
			return {
				catalogId: row.catalogId,
				label: toLabelToken(`${compound}-${mechanic}`),
				bodyPart, compound, mechanic: row.mechanic, multiplier,
			};
		})));
