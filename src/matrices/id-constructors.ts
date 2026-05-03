export interface IdConstructorCase {
	catalogId: 'UNDOC-IDCTOR-001';
	label: string;
	constructorName: string;
	objectType: 'creep' | 'structure' | 'site' | 'resource' | 'tombstone' | 'ruin' | 'mineral' | 'source';
	fields: readonly string[];
}

export const idConstructorCases: readonly IdConstructorCase[] = [
	{
		catalogId: 'UNDOC-IDCTOR-001',
		label: 'Creep',
		constructorName: 'Creep',
		objectType: 'creep',
		fields: ['name', 'hits', 'hitsMax', 'fatigue', 'ticksToLive', 'body.length', 'pos.x', 'store.energy'],
	},
	{
		catalogId: 'UNDOC-IDCTOR-001',
		label: 'Structure',
		constructorName: 'Structure',
		objectType: 'structure',
		fields: ['structureType', 'hits', 'hitsMax'],
	},
	{
		catalogId: 'UNDOC-IDCTOR-001',
		label: 'ConstructionSite',
		constructorName: 'ConstructionSite',
		objectType: 'site',
		fields: ['structureType', 'progress', 'progressTotal'],
	},
	{
		catalogId: 'UNDOC-IDCTOR-001',
		label: 'Resource',
		constructorName: 'Resource',
		objectType: 'resource',
		fields: ['resourceType', 'amount'],
	},
	{
		catalogId: 'UNDOC-IDCTOR-001',
		label: 'Tombstone',
		constructorName: 'Tombstone',
		objectType: 'tombstone',
		fields: ['deathTime', 'ticksToDecay', 'creep.name'],
	},
	{
		catalogId: 'UNDOC-IDCTOR-001',
		label: 'Ruin',
		constructorName: 'Ruin',
		objectType: 'ruin',
		fields: ['destroyTime', 'ticksToDecay', 'structure.structureType'],
	},
	{
		catalogId: 'UNDOC-IDCTOR-001',
		label: 'Mineral',
		constructorName: 'Mineral',
		objectType: 'mineral',
		fields: ['mineralType', 'mineralAmount', 'ticksToRegeneration'],
	},
	{
		catalogId: 'UNDOC-IDCTOR-001',
		label: 'Source',
		constructorName: 'Source',
		objectType: 'source',
		fields: ['energy', 'energyCapacity', 'ticksToRegeneration'],
	},
] as const;
