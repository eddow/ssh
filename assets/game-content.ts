export const prefix = "/assets/"
export const resources: Record<string, string> = {
	rocks: "objects/rocks.json",
	trees: "objects/trees.json",
	bushes: "objects/bushes.json",
	"terrain-rocky": "terrain/stone.jpg",
	"terrain-grass": "terrain/grass.jpg",
	"terrain-forest": "terrain/forest.jpg",
	"terrain-water": "terrain/water.jpg",
}
export const deposits: Record<string, Ssh.DepositDefinition> = {
	berry_bush: {
		name: 'Berry Bush',
		maxAmount: 18,
		regenerate: .01,
		sprites: ["bushes/bush1"],
	},
	rock: {
		name: "Rock",
		maxAmount: 18,
		sprites: ["rocks/rock1", "rocks/rock2", "rocks/rock3", "rocks/rock4", "rocks/rock5", "rocks/rock6"],
	},
	tree: {
		name: "Tree",
		maxAmount: 12,
		sprites: ["trees/tree1", "trees/tree2", "trees/tree3", "trees/tree4", "trees/tree5", "trees/tree6", "trees/tree7", "trees/tree8", "trees/tree9", "trees/tree10", "trees/tree11"],
		regenerate: 0.01,
	},
}

export const buildings: Record<string, Ssh.BuildingDefinition> = {
	sawmill: {
		name: "Sawmill",
		maxWorkers: 3,
		carryingCapacity: 1,
		restEase: 50,
		goodsCapacity: { wood: 6, planks: 12 },
		actions: [
			{
				type: "transformation",
				inputs: { wood: 1 },
				outputs: { planks: 1 },
				time: 2,
			},
		],
		sprites: ["buildings/sawmill"],
	},
	shack: {
		name: "Shack",
		maxWorkers: 1,
		carryingCapacity: 2,
		restEase: 5,
		goodsCapacity: { berries: 8, wood: 6, planks: 8, stone: 6 },
		actions: [
			{ type: "transformation", inputs: { wood: 1 }, outputs: { planks: 1 }, time: 6 },
			{ type: "harvesting", deposit: "tree", output: { wood: 1 }, time: 5 },
			{ type: "harvesting", deposit: "berry_bush", output: { berries: 1 }, time: 4 },
			{ type: "harvesting", deposit: "rock", output: { stone: 1 }, time: 6 },
		],
		sprites: ["buildings/shack"],
	},
	stonecutter: {
		name: "Stone Cutter",
		maxWorkers: 2,
		carryingCapacity: 1,
		restEase: 10,
		goodsCapacity: { stone: 12 },
		actions: [{ type: "harvesting", deposit: "rock", output: { stone: 1 }, time: 4 }],
		sprites: ["buildings/stonecutter"],
	},
	tree_chopper: {
		name: "Tree Chopper",
		maxWorkers: 2,
		carryingCapacity: 1,
		restEase: 10,
		goodsCapacity: { wood: 12 },
		actions: [{ type: "harvesting", deposit: "tree", output: { wood: 1 }, time: 3 }],
		sprites: ["buildings/tree_chopper"],
	},
}

export const goods: Record<string, Ssh.GoodsDefinition> = {
	berries: {
		name: "Berries",
		feedingValue: 72,
		sprites: ["goods/berries"],
	},
	mushrooms: {
		name: "Mushrooms",
		feedingValue: 60,
		sprites: ["goods/mushrooms"],
	},
	planks: {
		name: "Planks",
		feedingValue: 0,
		sprites: ["goods/planks"],
	},
	stone: {
		name: "Stone",
		feedingValue: 0,
		sprites: ["goods/stone"],
	},
	wood: {
		name: "Wood",
		feedingValue: 0,
		sprites: ["goods/wood"],
	},
}
