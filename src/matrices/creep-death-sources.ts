export const creepDeathResourceCases = [
	{
		label: 'suicide',
		creepName: 'SuicideCreep',
		ticksToLive: undefined,
		trigger: 'suicide',
	},
	{
		label: 'ticksToLive',
		creepName: 'AgingCreep',
		ticksToLive: 1,
		trigger: 'ticksToLive',
	},
] as const;
