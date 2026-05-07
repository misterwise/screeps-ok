export interface StaleArgumentCase {
	catalogId: 'UNDOC-STALEARG-001';
	key:
		| 'creepTransferStructure'
		| 'creepTransferCreep'
		| 'creepWithdrawStructure'
		| 'creepAttackCreep'
		| 'creepHeal'
		| 'creepRangedAttack'
		| 'creepRangedHeal'
		| 'creepRepair'
		| 'creepDismantle'
		| 'creepBuild'
		| 'creepPickup'
		| 'creepPull'
		| 'towerAttack'
		| 'towerHeal'
		| 'towerRepair'
		| 'linkTransferEnergy'
		| 'spawnRenewCreep'
		| 'spawnRecycleCreep';
	label: string;
	receiver: string;
	method: string;
	argReceiver: string;
}

export const staleArgumentCases: readonly StaleArgumentCase[] = [
	{
		catalogId: 'UNDOC-STALEARG-001',
		key: 'creepTransferStructure',
		label: 'creepTransferStructure',
		receiver: 'Creep',
		method: 'transfer',
		argReceiver: 'Structure',
	},
	{
		catalogId: 'UNDOC-STALEARG-001',
		key: 'creepTransferCreep',
		label: 'creepTransferCreep',
		receiver: 'Creep',
		method: 'transfer',
		argReceiver: 'Creep',
	},
	{
		catalogId: 'UNDOC-STALEARG-001',
		key: 'creepWithdrawStructure',
		label: 'creepWithdrawStructure',
		receiver: 'Creep',
		method: 'withdraw',
		argReceiver: 'Structure',
	},
	{
		catalogId: 'UNDOC-STALEARG-001',
		key: 'creepAttackCreep',
		label: 'creepAttackCreep',
		receiver: 'Creep',
		method: 'attack',
		argReceiver: 'Creep',
	},
	{
		catalogId: 'UNDOC-STALEARG-001',
		key: 'creepHeal',
		label: 'creepHeal',
		receiver: 'Creep',
		method: 'heal',
		argReceiver: 'Creep',
	},
	{
		catalogId: 'UNDOC-STALEARG-001',
		key: 'creepRangedAttack',
		label: 'creepRangedAttack',
		receiver: 'Creep',
		method: 'rangedAttack',
		argReceiver: 'Creep',
	},
	{
		catalogId: 'UNDOC-STALEARG-001',
		key: 'creepRangedHeal',
		label: 'creepRangedHeal',
		receiver: 'Creep',
		method: 'rangedHeal',
		argReceiver: 'Creep',
	},
	{
		catalogId: 'UNDOC-STALEARG-001',
		key: 'creepRepair',
		label: 'creepRepair',
		receiver: 'Creep',
		method: 'repair',
		argReceiver: 'Structure',
	},
	{
		catalogId: 'UNDOC-STALEARG-001',
		key: 'creepDismantle',
		label: 'creepDismantle',
		receiver: 'Creep',
		method: 'dismantle',
		argReceiver: 'Structure',
	},
	{
		catalogId: 'UNDOC-STALEARG-001',
		key: 'creepBuild',
		label: 'creepBuild',
		receiver: 'Creep',
		method: 'build',
		argReceiver: 'ConstructionSite',
	},
	{
		catalogId: 'UNDOC-STALEARG-001',
		key: 'creepPickup',
		label: 'creepPickup',
		receiver: 'Creep',
		method: 'pickup',
		argReceiver: 'Resource',
	},
	{
		catalogId: 'UNDOC-STALEARG-001',
		key: 'creepPull',
		label: 'creepPull',
		receiver: 'Creep',
		method: 'pull',
		argReceiver: 'Creep',
	},
	{
		catalogId: 'UNDOC-STALEARG-001',
		key: 'towerAttack',
		label: 'towerAttack',
		receiver: 'StructureTower',
		method: 'attack',
		argReceiver: 'Creep',
	},
	{
		catalogId: 'UNDOC-STALEARG-001',
		key: 'towerHeal',
		label: 'towerHeal',
		receiver: 'StructureTower',
		method: 'heal',
		argReceiver: 'Creep',
	},
	{
		catalogId: 'UNDOC-STALEARG-001',
		key: 'towerRepair',
		label: 'towerRepair',
		receiver: 'StructureTower',
		method: 'repair',
		argReceiver: 'Structure',
	},
	{
		catalogId: 'UNDOC-STALEARG-001',
		key: 'linkTransferEnergy',
		label: 'linkTransferEnergy',
		receiver: 'StructureLink',
		method: 'transferEnergy',
		argReceiver: 'StructureLink',
	},
	{
		catalogId: 'UNDOC-STALEARG-001',
		key: 'spawnRenewCreep',
		label: 'spawnRenewCreep',
		receiver: 'StructureSpawn',
		method: 'renewCreep',
		argReceiver: 'Creep',
	},
	{
		catalogId: 'UNDOC-STALEARG-001',
		key: 'spawnRecycleCreep',
		label: 'spawnRecycleCreep',
		receiver: 'StructureSpawn',
		method: 'recycleCreep',
		argReceiver: 'Creep',
	},
] as const;
