export const Visual = {
	"align": 4,
	"size": 5,
	"list": {
		"variant": [ {
			"align": 8,
			"size": 72,
			"layout": {
				"variant": "l",
				"struct": {
					"x1": { "member": "double", "offset": 0x28 },
					"x2": { "member": "double", "offset": 0x30 },
					"y1": { "member": "double", "offset": 0x38 },
					"y2": { "member": "double", "offset": 0x40 },
					"s": {
						"offset": 0x0,
						"member": {
							"struct": {
								"color": {
									"member": { "optional": "string", "size": 8 },
									"offset": 0xc,
								},
								"lineStyle": {
									"offset": 0x9,
									"member": {
										"size": 1,
										"optional": {
											"enum": [ undefined, "dashed", "dotted" ],
										},
									},
								},
								"opacity": {
									"member": { "optional": "double", "size": 8 },
									"offset": 0x0,
								},
								"width": {
									"member": { "optional": "double", "size": 8 },
									"offset": 0x18,
								},
							},
						},
					},
				},
			},
		}, {
			"align": 8,
			"size": 80,
			"layout": {
				"variant": "c",
				"struct": {
					"x": { "member": "double", "offset": 0x40 },
					"y": { "member": "double", "offset": 0x48 },
					"s": {
						"offset": 0x0,
						"member": {
							"struct": {
								"fill": {
									"member": { "optional": "string", "size": 8 },
									"offset": 0xc,
								},
								"lineStyle": {
									"offset": 0x9,
									"member": {
										"size": 1,
										"optional": {
											"enum": [ undefined, "dashed", "dotted" ],
										},
									},
								},
								"opacity": {
									"member": { "optional": "double", "size": 8 },
									"offset": 0x0,
								},
								"radius": {
									"member": { "optional": "double", "size": 8 },
									"offset": 0x18,
								},
								"stroke": {
									"member": { "optional": "string", "size": 8 },
									"offset": 0x24,
								},
								"strokeWidth": {
									"member": { "optional": "double", "size": 8 },
									"offset": 0x30,
								},
							},
						},
					},
				},
			},
		}, {
			"align": 8,
			"size": 80,
			"layout": {
				"variant": "r",
				"struct": {
					"h": { "member": "double", "offset": 0x30 },
					"w": { "member": "double", "offset": 0x38 },
					"x": { "member": "double", "offset": 0x40 },
					"y": { "member": "double", "offset": 0x48 },
					"s": {
						"offset": 0x0,
						"member": {
							"struct": {
								"fill": {
									"member": { "optional": "string", "size": 8 },
									"offset": 0xc,
								},
								"lineStyle": {
									"offset": 0x9,
									"member": {
										"size": 1,
										"optional": {
											"enum": [ undefined, "dashed", "dotted" ],
										},
									},
								},
								"opacity": {
									"member": { "optional": "double", "size": 8 },
									"offset": 0x0,
								},
								"stroke": {
									"member": { "optional": "string", "size": 8 },
									"offset": 0x24,
								},
								"strokeWidth": {
									"member": { "optional": "double", "size": 8 },
									"offset": 0x18,
								},
							},
						},
					},
				},
			},
		}, {
			"align": 8,
			"size": 56,
			"layout": {
				"variant": "p",
				"struct": {
					"points": {
						"offset": 0x30,
						"member": {
							"align": 8,
							"size": 16,
							"stride": 16,
							"vector": { "array": "double", "length": 2, "stride": 8 },
						},
					},
					"s": {
						"offset": 0x0,
						"member": {
							"struct": {
								"fill": {
									"member": { "optional": "string", "size": 8 },
									"offset": 0xc,
								},
								"lineStyle": {
									"offset": 0x9,
									"member": {
										"size": 1,
										"optional": {
											"enum": [ undefined, "dashed", "dotted" ],
										},
									},
								},
								"opacity": {
									"member": { "optional": "double", "size": 8 },
									"offset": 0x0,
								},
								"stroke": {
									"member": { "optional": "string", "size": 8 },
									"offset": 0x24,
								},
								"strokeWidth": {
									"member": { "optional": "double", "size": 8 },
									"offset": 0x18,
								},
							},
						},
					},
				},
			},
		}, {
			"align": 8,
			"size": 120,
			"layout": {
				"variant": "t",
				"struct": {
					"text": { "member": "string", "offset": 0x70 },
					"x": { "member": "double", "offset": 0x60 },
					"y": { "member": "double", "offset": 0x68 },
					"s": {
						"offset": 0x0,
						"member": {
							"struct": {
								"align": {
									"member": { "optional": "string", "size": 8 },
									"offset": 0xc,
								},
								"backgroundColor": {
									"member": { "optional": "string", "size": 8 },
									"offset": 0x24,
								},
								"backgroundPadding": {
									"member": { "optional": "double", "size": 8 },
									"offset": 0x0,
								},
								"color": {
									"member": { "optional": "string", "size": 8 },
									"offset": 0x3c,
								},
								"font": {
									"member": { "optional": "string", "size": 8 },
									"offset": 0x48,
								},
								"opacity": {
									"member": { "optional": "double", "size": 8 },
									"offset": 0x18,
								},
								"stroke": {
									"member": { "optional": "string", "size": 8 },
									"offset": 0x54,
								},
								"strokeWidth": {
									"member": { "optional": "double", "size": 8 },
									"offset": 0x30,
								},
							},
						},
					},
				},
			},
		} ],
	},
};
export default Visual;
