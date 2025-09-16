export const terrain = {
	water: {},
	forest: {
		generation: {
			deposits: { tree: 0.7 },
			goods: { mushrooms: 0.3 },
		},
	},
	rocky: {
		generation: {
			deposits: { rock: 0.6 },
		},
	},
	grass: {
		generation: {
			deposits: { berry_bush: 0.1 },
		},
	},
	sand: {
		generation: {
			deposits: { rock: 0.3 },
			goods: { berries: 0.05 },
		},
	},
	snow: {},
} as const satisfies Record<string, Ssh.TerrainDefinition>

export const deposits = {
	berry_bush: {
		name: 'Berry Bush',
		maxAmount: 18,
		regenerate: .01,
		sprites: ["bushes/bush1"],
		generation: {
			goods: { berries: 0.05 },
		},
	},
	rock: {
		name: "Rock",
		maxAmount: 18,
		sprites: ["rocks/rock1", "rocks/rock2", "rocks/rock3", "rocks/rock4", "rocks/rock5", "rocks/rock6"],
		generation: {
			goods: { stone: 0.6 },
		},
	},
	tree: {
		name: "Tree",
		maxAmount: 12,
		sprites: ["trees/tree1", "trees/tree2", "trees/tree3", "trees/tree4", "trees/tree5", "trees/tree6", "trees/tree7", "trees/tree8", "trees/tree9", "trees/tree10", "trees/tree11"],
		regenerate: 0.01,
		generation: {
			goods: { wood: 0.5 },
		},
	},
} as const satisfies Record<string, Ssh.DepositDefinition>

export const modules = {
	tree_chopper: {
		name: "Tree Chopper",
		maxWorkers: 2,
		restEase: 10,
		action: { type: "harvest", deposit: "tree" },
		output: "wood",
		time: 3,
		sprites: ["chopper"],
		icon: "chopper",
	},
	stonecutter: {
		name: "Stone Cutter",
		maxWorkers: 2,
		restEase: 10,
		action: { type: "harvest", deposit: "rock" },
		output: "stone",
		time: 4,
		sprites: ["cutter"],
		icon: "cutter",
	},
	sawmill: {
		name: "Sawmill",
		maxWorkers: 3,
		restEase: 50,
		action: { type: "transform", inputs: { wood: 1 } },
		output: 'planks',
		time: 2,
		sprites: ["sawmill"],
		icon: "sawmill",
	},
} as const satisfies Record<string, Ssh.ModuleDefinition>

export const goods = {
	berries: {
		name: "Berries",
		feedingValue: 72,
		sprites: ["berries"],
		icon: "berries",
	},
	mushrooms: {
		name: "Mushrooms",
		feedingValue: 160,
		sprites: ["mushrooms"],
		icon: "mushrooms",
	},
	planks: {
		name: "Planks",
		feedingValue: 0,
		sprites: ["planks"],
		icon: "planks",
	},
	stone: {
		name: "Stone",
		feedingValue: 0,
		sprites: ["stone"],
		icon: "stone",
	},
	wood: {
		name: "Wood",
		feedingValue: 0,
		sprites: ["wood"],
		icon: "wood",
	},
} as const satisfies Record<string, Ssh.GoodsDefinition>
