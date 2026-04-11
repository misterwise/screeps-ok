import { CONSTRUCTION_COST } from '../index.js';

type BuildableStructureType = keyof typeof CONSTRUCTION_COST;

export const constructionCostCases = (
	Object.entries(CONSTRUCTION_COST) as [BuildableStructureType, number][]
).map(([structureType, cost]) => ({
	structureType,
	expectedCost: cost,
})) as ReadonlyArray<{ structureType: BuildableStructureType; expectedCost: number }>;
