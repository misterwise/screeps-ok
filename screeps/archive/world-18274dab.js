export const World = {
	"align": 4,
	"size": 636,
	"list": {
		"struct": {
			"name": { "member": "string", "offset": 0x274 },
			"info": {
				"offset": 0x0,
				"member": {
					"struct": {
						"exits": { "member": "uint8", "offset": 0x271 },
						"terrain": {
							"member": { "array": "uint8", "length": 625, "stride": 1 },
							"offset": 0x0,
						},
					},
				},
			},
		},
	},
};
export default World;
