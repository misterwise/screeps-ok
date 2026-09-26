export type NukeEventLogCase = {
	catalogId: 'ROOM-EVENTLOG-026';
	label: string;
	scenario: 'attackIdDirection' | 'noCreepAttackEvents' | 'rampartBeforeCoveredStructure';
};

export const nukeEventLogCases: readonly NukeEventLogCase[] = [
	{
		catalogId: 'ROOM-EVENTLOG-026',
		label: 'attackObjectIsNukeTargetIsStructure',
		scenario: 'attackIdDirection',
	},
	{
		catalogId: 'ROOM-EVENTLOG-026',
		label: 'roomwideCreepKillEmitsNoAttackEvent',
		scenario: 'noCreepAttackEvents',
	},
	{
		catalogId: 'ROOM-EVENTLOG-026',
		label: 'rampartAttackEntryPrecedesCoveredStructure',
		scenario: 'rampartBeforeCoveredStructure',
	},
];
