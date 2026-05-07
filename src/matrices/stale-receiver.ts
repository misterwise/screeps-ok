export interface StaleReceiverCase {
	catalogId: 'UNDOC-STALERECV-001';
	key:
		| 'constructionSiteRemove'
		| 'structureNotifyWhenAttacked'
		| 'linkTransferEnergy'
		| 'towerAttack'
		| 'towerHeal'
		| 'towerRepair';
	label: string;
	receiver: string;
	method: string;
}

export const staleReceiverCases: readonly StaleReceiverCase[] = [
	{
		catalogId: 'UNDOC-STALERECV-001',
		key: 'constructionSiteRemove',
		label: 'constructionSiteRemove',
		receiver: 'ConstructionSite',
		method: 'remove',
	},
	{
		catalogId: 'UNDOC-STALERECV-001',
		key: 'structureNotifyWhenAttacked',
		label: 'structureNotifyWhenAttacked',
		receiver: 'Structure',
		method: 'notifyWhenAttacked',
	},
	{
		catalogId: 'UNDOC-STALERECV-001',
		key: 'linkTransferEnergy',
		label: 'linkTransferEnergy',
		receiver: 'StructureLink',
		method: 'transferEnergy',
	},
	{
		catalogId: 'UNDOC-STALERECV-001',
		key: 'towerAttack',
		label: 'towerAttack',
		receiver: 'StructureTower',
		method: 'attack',
	},
	{
		catalogId: 'UNDOC-STALERECV-001',
		key: 'towerHeal',
		label: 'towerHeal',
		receiver: 'StructureTower',
		method: 'heal',
	},
	{
		catalogId: 'UNDOC-STALERECV-001',
		key: 'towerRepair',
		label: 'towerRepair',
		receiver: 'StructureTower',
		method: 'repair',
	},
] as const;
