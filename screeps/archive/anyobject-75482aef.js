export const ActionLog = {
	"align": 4,
	"size": 7,
	"stride": 8,
	"vector": {
		"struct": {
			"time": { "member": "int32", "offset": 0x0 },
			"x": { "member": "int8", "offset": 0x5 },
			"y": { "member": "int8", "offset": 0x6 },
			"type": {
				"offset": 0x4,
				"member": {
					"enum": [ "harvest", "reaction1", "reaction2", "reverseReaction1", "reverseReaction2", "attack", "attacked", "heal", "healed", "rangedAttack", "rangedHeal", "rangedMassAttack", "build", "repair", "produce", "transferEnergy", "reserveController", "upgradeController" ],
				},
			},
		},
	},
};
export const Id = { "array": "uint32", "length": 4, "stride": 4 };
export const ResourceType = {
	"enum": [ undefined, "energy", "power", "H", "O", "U", "L", "K", "Z", "X", "G", "OH", "ZK", "UL", "UH", "UO", "KH", "KO", "LH", "LO", "ZH", "ZO", "GH", "GO", "UH2O", "UHO2", "KH2O", "KHO2", "LH2O", "LHO2", "ZH2O", "ZHO2", "GH2O", "GHO2", "XUH2O", "XUHO2", "XKH2O", "XKHO2", "XLH2O", "XLHO2", "XZH2O", "XZHO2", "XGH2O", "XGHO2", "utrium_bar", "lemergium_bar", "zynthium_bar", "keanium_bar", "ghodium_melt", "oxidant", "reductant", "purifier", "battery", "silicon", "metal", "biomass", "mist", "ops", "composite", "crystal", "liquid", "wire", "switch", "transistor", "microchip", "circuit", "device", "cell", "phlegm", "tissue", "muscle", "organoid", "organism", "alloy", "tube", "fixtures", "frame", "hydraulics", "machine", "condensate", "concentrate", "extract", "spirit", "emanation", "essence" ],
};
export const OpenStore = {
	"struct": {
		"#capacity": { "member": "int32", "offset": 0x8 },
		"#resources": {
			"offset": 0x0,
			"member": {
				"align": 4,
				"size": 5,
				"stride": 8,
				"vector": {
					"struct": {
						"amount": { "member": "int32", "offset": 0x0 },
						"type": { "member": ResourceType, "offset": 0x4 },
					},
				},
			},
		},
	},
};
export const RoomPosition = { "layout": "int32", "named": "RoomPosition" };
export const RoomObject = {
	"struct": {
		"#posId": { "member": "int32", "offset": 0x10, "union": true },
		"id": { "member": Id, "offset": 0x0 },
		"pos": { "member": RoomPosition, "offset": 0x10 },
	},
};
export const ConstructionSite = {
	"inherit": RoomObject,
	"variant": "constructionSite",
	"struct": {
		"#user": { "member": Id, "offset": 0x14 },
		"name": { "member": "string", "offset": 0x24 },
		"progress": { "member": "int32", "offset": 0x2c },
		"structureType": {
			"offset": 0x30,
			"member": {
				"enum": [ "container", "extractor", "lab", "rampart", "tower", "constructedWall", "factory", "link", "storage", "terminal", "observer", "road", "extension", "spawn" ],
			},
		},
	},
};
export const Creep = {
	"inherit": RoomObject,
	"variant": "creep",
	"struct": {
		"#actionLog": { "member": ActionLog, "offset": 0x30 },
		"#ageTime": { "member": "int32", "offset": 0x48 },
		"#user": { "member": Id, "offset": 0x14 },
		"fatigue": { "member": "int32", "offset": 0x50 },
		"hits": { "member": "int32", "offset": 0x54 },
		"name": { "member": "string", "offset": 0x40 },
		"store": { "member": OpenStore, "offset": 0x24 },
		"#saying": {
			"offset": 0x4c,
			"member": {
				"align": 4,
				"size": 13,
				"pointer": {
					"struct": {
						"isPublic": { "member": "bool", "offset": 0xc },
						"message": { "member": "string", "offset": 0x0 },
						"time": { "member": "int32", "offset": 0x8 },
					},
				},
			},
		},
		"body": {
			"offset": 0x38,
			"member": {
				"align": 1,
				"size": 3,
				"stride": 3,
				"vector": {
					"struct": {
						"boost": { "member": ResourceType, "offset": 0x0 },
						"hits": { "member": "int8", "offset": 0x1 },
						"type": {
							"offset": 0x2,
							"member": {
								"enum": [ "move", "work", "carry", "attack", "ranged_attack", "tough", "heal", "claim" ],
							},
						},
					},
				},
			},
		},
	},
};
export const Mineral = {
	"inherit": RoomObject,
	"variant": "mineral",
	"struct": {
		"#nextRegenerationTime": { "member": "int32", "offset": 0x14 },
		"density": { "member": "int32", "offset": 0x18 },
		"mineralAmount": { "member": "int32", "offset": 0x1c },
		"mineralType": { "member": ResourceType, "offset": 0x20 },
	},
};
export const ObserverSpy = {
	"inherit": RoomObject,
	"variant": "ObserverSpy",
	"struct": {
		"#user": { "member": Id, "offset": 0x14 },
	},
};
export const Resource = {
	"inherit": RoomObject,
	"variant": "resource",
	"struct": {
		"amount": { "member": "int32", "offset": 0x14 },
		"resourceType": { "member": ResourceType, "offset": 0x18 },
	},
};
export const Ruin = {
	"inherit": RoomObject,
	"variant": "ruin",
	"struct": {
		"#decayTime": { "member": "int32", "offset": 0x4c },
		"destroyTime": { "member": "int32", "offset": 0x50 },
		"store": { "member": OpenStore, "offset": 0x40 },
		"#structure": {
			"offset": 0x14,
			"member": {
				"struct": {
					"hitsMax": { "member": "int32", "offset": 0x28 },
					"id": { "member": Id, "offset": 0x0 },
					"type": { "member": "string", "offset": 0x20 },
					"user": { "member": Id, "offset": 0x10 },
				},
			},
		},
	},
};
export const SingleStore = {
	"struct": {
		"#amount": { "member": "int32", "offset": 0x0 },
		"#capacity": { "member": "int32", "offset": 0x4 },
		"#type": { "member": ResourceType, "offset": 0x8 },
	},
};
export const Source = {
	"inherit": RoomObject,
	"variant": "source",
	"struct": {
		"#nextRegenerationTime": { "member": "int32", "offset": 0x14 },
		"energy": { "member": "int32", "offset": 0x18 },
		"energyCapacity": { "member": "int32", "offset": 0x1c },
	},
};
export const Structure = RoomObject;
export const Container = {
	"inherit": Structure,
	"variant": "container",
	"struct": {
		"#nextDecayTime": { "member": "int32", "offset": 0x20 },
		"hits": { "member": "int32", "offset": 0x24 },
		"store": { "member": OpenStore, "offset": 0x14 },
	},
};
export const OwnedStructure = {
	"inherit": Structure,
	"struct": {
		"#user": { "member": Id, "offset": 0x14 },
	},
};
export const Controller = {
	"inherit": OwnedStructure,
	"variant": "controller",
	"struct": {
		"#downgradeTime": { "member": "int32", "offset": 0x24 },
		"#progress": { "member": "int32", "offset": 0x28 },
		"#reservationEndTime": { "member": "int32", "offset": 0x2c },
		"#safeModeCooldownTime": { "member": "int32", "offset": 0x30 },
		"#upgradeBlockedUntil": { "member": "int32", "offset": 0x34 },
		"isPowerEnabled": { "member": "bool", "offset": 0x3c },
		"safeModeAvailable": { "member": "int32", "offset": 0x38 },
	},
};
export const Extension = {
	"inherit": OwnedStructure,
	"variant": "extension",
	"struct": {
		"hits": { "member": "int32", "offset": 0x30 },
		"store": { "member": SingleStore, "offset": 0x24 },
	},
};
export const Extractor = {
	"inherit": OwnedStructure,
	"variant": "extractor",
	"struct": {
		"#cooldownTime": { "member": "int32", "offset": 0x24 },
		"hits": { "member": "int32", "offset": 0x28 },
	},
};
export const KeeperLair = {
	"inherit": OwnedStructure,
	"variant": "keeperLair",
	"struct": {
		"#nextSpawnTime": { "member": "int32", "offset": 0x24 },
	},
};
export const Lab = {
	"inherit": OwnedStructure,
	"variant": "lab",
	"struct": {
		"#actionLog": { "member": ActionLog, "offset": 0x30 },
		"#cooldownTime": { "member": "int32", "offset": 0x38 },
		"hits": { "member": "int32", "offset": 0x3c },
		"store": {
			"offset": 0x24,
			"member": {
				"struct": {
					"#energy": { "member": "int32", "offset": 0x0 },
					"#mineralAmount": { "member": "int32", "offset": 0x4 },
					"#mineralType": { "member": ResourceType, "offset": 0x8 },
				},
			},
		},
	},
};
export const Link = {
	"inherit": OwnedStructure,
	"variant": "link",
	"struct": {
		"#actionLog": { "member": ActionLog, "offset": 0x30 },
		"#cooldownTime": { "member": "int32", "offset": 0x38 },
		"hits": { "member": "int32", "offset": 0x3c },
		"store": { "member": SingleStore, "offset": 0x24 },
	},
};
export const Observer = {
	"inherit": OwnedStructure,
	"variant": "observer",
	"struct": {
		"hits": { "member": "int32", "offset": 0x24 },
	},
};
export const Rampart = {
	"inherit": OwnedStructure,
	"variant": "rampart",
	"struct": {
		"#nextDecayTime": { "member": "int32", "offset": 0x24 },
		"hits": { "member": "int32", "offset": 0x28 },
		"isPublic": { "member": "bool", "offset": 0x2c },
	},
};
export const Road = {
	"inherit": Structure,
	"variant": "road",
	"struct": {
		"#nextDecayTime": { "member": "int32", "offset": 0x14 },
		"#terrain": { "member": "int8", "offset": 0x1c },
		"hits": { "member": "int32", "offset": 0x18 },
	},
};
export const Spawn = {
	"inherit": OwnedStructure,
	"variant": "spawn",
	"struct": {
		"hits": { "member": "int32", "offset": 0x38 },
		"name": { "member": "string", "offset": 0x30 },
		"store": { "member": SingleStore, "offset": 0x24 },
		"spawning": {
			"offset": 0x3c,
			"member": {
				"align": 4,
				"size": 52,
				"uninitialized": null,
				"pointer": {
					"struct": {
						"#spawnId": { "member": Id, "offset": 0x0 },
						"#spawnTime": { "member": "int32", "offset": 0x2c },
						"#spawningCreepId": { "member": Id, "offset": 0x10 },
						"needTime": { "member": "int32", "offset": 0x30 },
						"directions": {
							"offset": 0x20,
							"member": {
								"optional": { "align": 1, "size": 1, "stride": 1, "vector": "int8" },
								"size": 8,
							},
						},
					},
				},
			},
		},
	},
};
export const Storage = {
	"inherit": OwnedStructure,
	"variant": "storage",
	"struct": {
		"hits": { "member": "int32", "offset": 0x30 },
		"store": { "member": OpenStore, "offset": 0x24 },
	},
};
export const StructureFactory = {
	"inherit": OwnedStructure,
	"variant": "factory",
	"struct": {
		"#actionLog": { "member": ActionLog, "offset": 0x30 },
		"#cooldownTime": { "member": "int32", "offset": 0x38 },
		"#level": { "member": "int32", "offset": 0x3c },
		"hits": { "member": "int32", "offset": 0x40 },
		"store": { "member": OpenStore, "offset": 0x24 },
	},
};
export const StructureTerminal = {
	"inherit": OwnedStructure,
	"variant": "terminal",
	"struct": {
		"#cooldownTime": { "member": "int32", "offset": 0x30 },
		"hits": { "member": "int32", "offset": 0x34 },
		"store": { "member": OpenStore, "offset": 0x24 },
	},
};
export const Tombstone = {
	"inherit": RoomObject,
	"variant": "tombstone",
	"struct": {
		"#decayTime": { "member": "int32", "offset": 0x58 },
		"deathTime": { "member": "int32", "offset": 0x5c },
		"store": { "member": OpenStore, "offset": 0x4c },
		"#creep": {
			"offset": 0x14,
			"member": {
				"struct": {
					"id": { "member": Id, "offset": 0x0 },
					"name": { "member": "string", "offset": 0x28 },
					"ticksToLive": { "member": "int32", "offset": 0x34 },
					"user": { "member": Id, "offset": 0x10 },
					"body": {
						"offset": 0x20,
						"member": {
							"align": 1,
							"size": 1,
							"stride": 1,
							"vector": {
								"enum": [ "move", "work", "carry", "attack", "ranged_attack", "tough", "heal", "claim" ],
							},
						},
					},
					"saying": {
						"offset": 0x30,
						"member": {
							"align": 4,
							"size": 13,
							"pointer": {
								"struct": {
									"isPublic": { "member": "bool", "offset": 0xc },
									"message": { "member": "string", "offset": 0x0 },
									"time": { "member": "int32", "offset": 0x8 },
								},
							},
						},
					},
				},
			},
		},
	},
};
export const Tower = {
	"inherit": OwnedStructure,
	"variant": "tower",
	"struct": {
		"#actionLog": { "member": ActionLog, "offset": 0x30 },
		"hits": { "member": "int32", "offset": 0x38 },
		"store": { "member": SingleStore, "offset": 0x24 },
	},
};
export const Wall = {
	"inherit": Structure,
	"variant": "constructedWall",
	"struct": {
		"hits": { "member": "int32", "offset": 0x14 },
	},
};
export const AnyObject = {
	"variant": [
		{ "align": 4, "layout": Ruin, "size": 84 },
		{ "align": 4, "layout": Container, "size": 40 },
		{ "align": 4, "layout": Resource, "size": 25 },
		{ "align": 4, "layout": Creep, "size": 88 },
		{ "align": 4, "layout": Tombstone, "size": 96 },
		{ "align": 4, "layout": Extractor, "size": 44 },
		{ "align": 4, "layout": Mineral, "size": 33 },
		{ "align": 4, "layout": Lab, "size": 64 },
		{ "align": 4, "layout": Rampart, "size": 45 },
		{ "align": 4, "layout": Tower, "size": 60 },
		{ "align": 4, "layout": Wall, "size": 24 },
		{ "align": 4, "layout": ConstructionSite, "size": 49 },
		{ "align": 4, "layout": StructureFactory, "size": 68 },
		{ "align": 4, "layout": Link, "size": 64 },
		{ "align": 4, "layout": Storage, "size": 52 },
		{ "align": 4, "layout": StructureTerminal, "size": 56 },
		{ "align": 4, "layout": Observer, "size": 40 },
		{ "align": 4, "layout": ObserverSpy, "size": 36 },
		{ "align": 4, "layout": Road, "size": 29 },
		{ "align": 4, "layout": Source, "size": 32 },
		{ "align": 4, "layout": KeeperLair, "size": 40 },
		{ "align": 4, "layout": Controller, "size": 61 },
		{ "align": 4, "layout": Extension, "size": 52 },
		{ "align": 4, "layout": Spawn, "size": 64 },
	],
};
export default AnyObject;
