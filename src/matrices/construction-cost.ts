import { CONSTRUCTION_COST, type CapabilityName } from '../index.js';
import { structureCapability } from '../helpers/structure-capability.js';

type BuildableStructureType = keyof typeof CONSTRUCTION_COST;

export const constructionCostCases = (
	Object.entries(CONSTRUCTION_COST) as [BuildableStructureType, number][]
).map(([structureType, cost]) => ({
	structureType,
	expectedCost: cost,
	capability: structureCapability[structureType],
})) as ReadonlyArray<{ structureType: BuildableStructureType; expectedCost: number; capability?: CapabilityName }>;
