import type { CapabilityName } from '../adapter.js';

export type JsonObjectCaseKey =
	| 'room'
	| 'roomPosition'
	| 'ownedCreep'
	| 'hostileCreep'
	| 'controller'
	| 'ownedStructure'
	| 'hostileStructure'
	| 'source'
	| 'mineral'
	| 'droppedResource'
	| 'constructionSite'
	| 'flag'
	| 'tombstone'
	| 'ruin'
	| 'deposit'
	| 'nuke'
	| 'ownedPowerCreep'
	| 'hostilePowerCreep';

export interface JsonObjectCase {
	catalogId: 'UNDOC-JSONOBJ-001';
	key: JsonObjectCaseKey;
	label: string;
	fields: readonly string[];
	requiredCapability?: CapabilityName;
}

export const jsonObjectCases: readonly JsonObjectCase[] = [
	{
		catalogId: 'UNDOC-JSONOBJ-001',
		key: 'room',
		label: 'Room',
		fields: ['name', 'energyAvailable', 'energyCapacityAvailable'],
	},
	{
		catalogId: 'UNDOC-JSONOBJ-001',
		key: 'roomPosition',
		label: 'RoomPosition',
		fields: ['x', 'y', 'roomName'],
	},
	{
		catalogId: 'UNDOC-JSONOBJ-001',
		key: 'ownedCreep',
		label: 'owned Creep',
		fields: [
			'id', 'name', 'pos.x', 'pos.y', 'pos.roomName',
			'room.name', 'my', 'owner.username', 'ticksToLive',
		],
	},
	{
		catalogId: 'UNDOC-JSONOBJ-001',
		key: 'hostileCreep',
		label: 'hostile Creep',
		fields: [
			'id', 'name', 'pos.x', 'pos.y', 'pos.roomName',
			'room.name', 'my', 'owner.username', 'ticksToLive',
		],
	},
	{
		catalogId: 'UNDOC-JSONOBJ-001',
		key: 'controller',
		label: 'StructureController',
		fields: [
			'id', 'pos.x', 'pos.y', 'pos.roomName', 'room.name',
			'structureType', 'level', 'my', 'owner.username',
		],
	},
	{
		catalogId: 'UNDOC-JSONOBJ-001',
		key: 'ownedStructure',
		label: 'owned Structure',
		fields: [
			'id', 'pos.x', 'pos.y', 'pos.roomName', 'room.name',
			'structureType', 'my', 'owner.username', 'hits',
		],
	},
	{
		catalogId: 'UNDOC-JSONOBJ-001',
		key: 'hostileStructure',
		label: 'hostile Structure',
		fields: [
			'id', 'pos.x', 'pos.y', 'pos.roomName', 'room.name',
			'structureType', 'my', 'owner.username', 'hits',
		],
	},
	{
		catalogId: 'UNDOC-JSONOBJ-001',
		key: 'source',
		label: 'Source',
		fields: [
			'id', 'pos.x', 'pos.y', 'pos.roomName', 'room.name',
			'energy', 'energyCapacity',
		],
	},
	{
		catalogId: 'UNDOC-JSONOBJ-001',
		key: 'mineral',
		label: 'Mineral',
		fields: [
			'id', 'pos.x', 'pos.y', 'pos.roomName', 'room.name',
			'mineralType', 'mineralAmount',
		],
	},
	{
		catalogId: 'UNDOC-JSONOBJ-001',
		key: 'droppedResource',
		label: 'Resource',
		fields: [
			'id', 'pos.x', 'pos.y', 'pos.roomName', 'room.name',
			'resourceType', 'amount',
		],
	},
	{
		catalogId: 'UNDOC-JSONOBJ-001',
		key: 'constructionSite',
		label: 'ConstructionSite',
		fields: [
			'id', 'pos.x', 'pos.y', 'pos.roomName', 'room.name',
			'structureType', 'my', 'owner.username', 'progress', 'progressTotal',
		],
	},
	{
		catalogId: 'UNDOC-JSONOBJ-001',
		key: 'flag',
		label: 'Flag',
		fields: [
			'name', 'pos.x', 'pos.y', 'pos.roomName', 'room.name',
			'color', 'secondaryColor',
		],
	},
	{
		catalogId: 'UNDOC-JSONOBJ-001',
		key: 'tombstone',
		label: 'Tombstone',
		fields: [
			'id', 'pos.x', 'pos.y', 'pos.roomName', 'room.name',
			'deathTime', 'ticksToDecay',
		],
	},
	{
		catalogId: 'UNDOC-JSONOBJ-001',
		key: 'ruin',
		label: 'Ruin',
		fields: [
			'id', 'pos.x', 'pos.y', 'pos.roomName', 'room.name',
			'structureType', 'destroyTime', 'ticksToDecay', 'structure.structureType',
		],
	},
	{
		catalogId: 'UNDOC-JSONOBJ-001',
		key: 'deposit',
		label: 'Deposit',
		fields: [
			'id', 'pos.x', 'pos.y', 'pos.roomName', 'room.name',
			'depositType', 'lastCooldown', 'cooldown',
		],
		requiredCapability: 'deposit',
	},
	{
		catalogId: 'UNDOC-JSONOBJ-001',
		key: 'nuke',
		label: 'Nuke',
		fields: [
			'id', 'pos.x', 'pos.y', 'pos.roomName', 'room.name',
			'launchRoomName', 'timeToLand',
		],
		requiredCapability: 'nuke',
	},
	{
		catalogId: 'UNDOC-JSONOBJ-001',
		key: 'ownedPowerCreep',
		label: 'owned PowerCreep',
		fields: [
			'id', 'name', 'pos.x', 'pos.y', 'pos.roomName',
			'room.name', 'my', 'owner.username', 'ticksToLive',
		],
		requiredCapability: 'powerCreeps',
	},
	{
		catalogId: 'UNDOC-JSONOBJ-001',
		key: 'hostilePowerCreep',
		label: 'hostile PowerCreep',
		fields: [
			'id', 'name', 'pos.x', 'pos.y', 'pos.roomName',
			'room.name', 'my', 'owner.username', 'ticksToLive',
		],
		requiredCapability: 'powerCreeps',
	},
] as const;
