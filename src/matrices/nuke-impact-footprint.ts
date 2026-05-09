import { NUKE_DAMAGE } from '../constants.js';

// Each row pins one tile within the 7x7 box around the nuke. The 5x5 inner
// square (range 0-2) takes damage; the range-3 ring takes none. Mirrors the
// engine loop in @screeps/engine/src/processor/intents/nukes/tick.js:39-44
// (`range = max(|dx|, |dy|)`, `damage = range == 0 ? NUKE_DAMAGE[0] : NUKE_DAMAGE[2]`)
// and the surrounding-loop boundary that excludes range >= 3.

export type NukeImpactFootprintCase = {
	catalogId: 'NUKE-IMPACT-014';
	label: string;
	dx: number;
	dy: number;
	range: number;
	expectedDamage: number;
};

function pad(n: number): string {
	return (n < 0 ? `m${-n}` : `p${n}`);
}

export const nukeImpactFootprintCases: readonly NukeImpactFootprintCase[] = (() => {
	const rows: NukeImpactFootprintCase[] = [];
	for (let dx = -3; dx <= 3; dx++) {
		for (let dy = -3; dy <= 3; dy++) {
			const range = Math.max(Math.abs(dx), Math.abs(dy));
			const expectedDamage = range === 0
				? NUKE_DAMAGE[0]
				: range <= 2 ? NUKE_DAMAGE[2] : 0;
			rows.push({
				catalogId: 'NUKE-IMPACT-014',
				label: `dx${pad(dx)}dy${pad(dy)}range${range}`,
				dx,
				dy,
				range,
				expectedDamage,
			});
		}
	}
	return rows;
})();
