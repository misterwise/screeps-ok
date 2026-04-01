export const Id = { "array": "uint32", "length": 4, "stride": 4 };
export const RoomPosition = { "layout": "int32", "named": "RoomPosition" };
export const RoomObject = {
	"struct": {
		"#posId": { "member": "int32", "offset": 0x10, "union": true },
		"id": { "member": Id, "offset": 0x0 },
		"pos": { "member": RoomPosition, "offset": 0x10 },
	},
};
export const Flag = {
	"inherit": RoomObject,
	"struct": {
		"color": { "member": "int8", "offset": 0x1c },
		"name": { "member": "string", "offset": 0x14 },
		"secondaryColor": { "member": "int8", "offset": 0x1d },
	},
};
export const Flags = { "align": 4, "list": Flag, "size": 30 };
export default Flags;
