export const prefix = "/assets/"
// Note: resources are grouped/tree in files but not in the record
export const resources: Record<string, string> = {
	rocks: "objects/rocks.json",
	trees: "objects/trees.json",
	bushes: "objects/bushes.json",
	"terrain-rocky": "terrain/stone.jpg",
	"terrain-grass": "terrain/grass.jpg",
	"terrain-forest": "terrain/forest.jpg",
	"terrain-water": "terrain/water.jpg",
	cabin: "buildings/cabin.png",
	chopper: "buildings/chopper.png",
	cutter: "buildings/cutter.png",
	sawmill: "buildings/sawmill.png",
	berries: "goods/berries.png",
	mushrooms: "goods/mushrooms.png",
	planks: "goods/planks.png",
	wood: "goods/wood.png",
	stone: "goods/stone.png",
	select: "commands/click.png",
	character: "character.png",
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
	shack: {
		name: "Shack",
		maxWorkers: 1,
		carryingCapacity: 2,
		restEase: 5,
		goodsCapacity: { berries: 3, wood: 3, planks: 3, stone: 3 },
		actions: [
			{ type: "transformation", inputs: { wood: 1 }, outputs: { planks: 1 }, time: 6 },
			{ type: "harvesting", deposit: "tree", output: { wood: 1 }, time: 5 },
			{ type: "harvesting", deposit: "berry_bush", output: { berries: 1 }, time: 4 },
			{ type: "harvesting", deposit: "rock", output: { stone: 1 }, time: 6 },
		],
		sprites: ["cabin"],
		icon: "cabin",
	},
	tree_chopper: {
		name: "Tree Chopper",
		maxWorkers: 2,
		carryingCapacity: 1,
		restEase: 10,
		goodsCapacity: { wood: 6 },
		actions: [{ type: "harvesting", deposit: "tree", output: { wood: 1 }, time: 3 }],
		sprites: ["chopper"],
		icon: "chopper",
	},
	stonecutter: {
		name: "Stone Cutter",
		maxWorkers: 2,
		carryingCapacity: 1,
		restEase: 10,
		goodsCapacity: { stone: 6 },
		actions: [{ type: "harvesting", deposit: "rock", output: { stone: 1 }, time: 4 }],
		sprites: ["cutter"],
		icon: "cutter",
	},
	sawmill: {
		name: "Sawmill",
		maxWorkers: 3,
		carryingCapacity: 1,
		restEase: 50,
		goodsCapacity: { wood: 3, planks: 6 },
		actions: [
			{
				type: "transformation",
				inputs: { wood: 1 },
				outputs: { planks: 1 },
				time: 2,
			},
		],
		sprites: ["sawmill"],
		icon: "sawmill",
	},
}

export const goods: Record<string, Ssh.GoodsDefinition> = {
	berries: {
		name: "Berries",
		feedingValue: 72,
		sprites: ["berries"],
		icon: "berries",
	},
	mushrooms: {
		name: "Mushrooms",
		feedingValue: 60,
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
}
