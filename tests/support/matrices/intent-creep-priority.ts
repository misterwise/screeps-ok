// Canonical same-tick creep intent priority exclusion table.
// When a higher-priority method issues an intent, the lower-priority method's
// intent is blocked (discarded) for that tick.
//
// This is a pairwise exclusion table, not a total ordering.
// Source: @screeps/engine/src/processor/intents/creeps/intents.js

interface IntentPriorityCase {
	blocker: string;
	blocked: string;
}

export const intentCreepPriorityCases: readonly IntentPriorityCase[] = [
	// rangedHeal blocks heal
	{ blocker: 'rangedHeal', blocked: 'heal' },

	// attackController blocks rangedHeal, heal
	{ blocker: 'attackController', blocked: 'rangedHeal' },
	{ blocker: 'attackController', blocked: 'heal' },

	// dismantle blocks attackController, rangedHeal, heal
	{ blocker: 'dismantle', blocked: 'attackController' },
	{ blocker: 'dismantle', blocked: 'rangedHeal' },
	{ blocker: 'dismantle', blocked: 'heal' },

	// repair blocks dismantle, attackController, rangedHeal, heal
	{ blocker: 'repair', blocked: 'dismantle' },
	{ blocker: 'repair', blocked: 'attackController' },
	{ blocker: 'repair', blocked: 'rangedHeal' },
	{ blocker: 'repair', blocked: 'heal' },

	// build blocks repair, dismantle, attackController, rangedHeal, heal
	{ blocker: 'build', blocked: 'repair' },
	{ blocker: 'build', blocked: 'dismantle' },
	{ blocker: 'build', blocked: 'attackController' },
	{ blocker: 'build', blocked: 'rangedHeal' },
	{ blocker: 'build', blocked: 'heal' },

	// attack blocks build, repair, dismantle, attackController, rangedHeal, heal
	{ blocker: 'attack', blocked: 'build' },
	{ blocker: 'attack', blocked: 'repair' },
	{ blocker: 'attack', blocked: 'dismantle' },
	{ blocker: 'attack', blocked: 'attackController' },
	{ blocker: 'attack', blocked: 'rangedHeal' },
	{ blocker: 'attack', blocked: 'heal' },

	// harvest blocks attack, build, repair, dismantle, attackController, rangedHeal, heal
	{ blocker: 'harvest', blocked: 'attack' },
	{ blocker: 'harvest', blocked: 'build' },
	{ blocker: 'harvest', blocked: 'repair' },
	{ blocker: 'harvest', blocked: 'dismantle' },
	{ blocker: 'harvest', blocked: 'attackController' },
	{ blocker: 'harvest', blocked: 'rangedHeal' },
	{ blocker: 'harvest', blocked: 'heal' },

	// rangedMassAttack blocks build, repair, rangedHeal
	{ blocker: 'rangedMassAttack', blocked: 'build' },
	{ blocker: 'rangedMassAttack', blocked: 'repair' },
	{ blocker: 'rangedMassAttack', blocked: 'rangedHeal' },

	// rangedAttack blocks rangedMassAttack, build, repair, rangedHeal
	{ blocker: 'rangedAttack', blocked: 'rangedMassAttack' },
	{ blocker: 'rangedAttack', blocked: 'build' },
	{ blocker: 'rangedAttack', blocked: 'repair' },
	{ blocker: 'rangedAttack', blocked: 'rangedHeal' },
];
