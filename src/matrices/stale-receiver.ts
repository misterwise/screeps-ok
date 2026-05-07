export interface StaleReceiverCase {
	catalogId: 'UNDOC-STALERECV-001';
	key: 'constructionSiteRemove' | 'structureNotifyWhenAttacked';
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
] as const;
