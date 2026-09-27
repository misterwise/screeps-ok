import { ERR_INVALID_TARGET, OK } from '../constants.js';

export type TowerTarget = 'creep' | 'powerCreep' | 'structure' | 'controller' | 'constructionSite' | 'source';

const towerTargets: readonly TowerTarget[] = ['creep', 'powerCreep', 'structure', 'controller', 'constructionSite', 'source'];

// The target classes each tower method accepts (game/structures.js:770, :790,
// :810); the controller is a registered structure (game/game.js:298-300).
const towerActions = [
	{ action: 'attack', catalogId: 'TOWER-ATTACK-003', accepts: ['creep', 'powerCreep', 'structure', 'controller'] },
	{ action: 'heal', catalogId: 'TOWER-HEAL-003', accepts: ['creep', 'powerCreep'] },
	{ action: 'repair', catalogId: 'TOWER-REPAIR-003', accepts: ['structure', 'controller'] },
] as const;

export const towerTargetCases = towerActions.flatMap(({ action, catalogId, accepts }) =>
	towerTargets.map(target => ({
		catalogId,
		label: target,
		action,
		target,
		expectedRc: (accepts as readonly TowerTarget[]).includes(target) ? OK : ERR_INVALID_TARGET,
	})));
