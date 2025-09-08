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
	"terrain-sand": "terrain/sand.jpg",
	"terrain-snow": "terrain/snow.jpg",
	concrete: "terrain/concrete.jpg",
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
export const terrain = {
	water: {
		deposits: {},
		goods: {},
	},
	forest: {
		deposits: { tree: 0.7 },
		goods: { mushrooms: 0.3 },
	},
	rocky: {
		deposits: { rock: 0.6 },
		goods: {},
	},
	grass: {
		deposits: { berry_bush: 0.1 },
		goods: {},
	},
	sand: {
		deposits: { rock: 0.3 },
		goods: { berries: 0.05 },
	},
	snow: {
		deposits: {},
		goods: {},
	},
} as const satisfies Record<string, Ssh.TerrainDefinition>

export const deposits = {
	berry_bush: {
		name: 'Berry Bush',
		maxAmount: 18,
		regenerate: .01,
		sprites: ["bushes/bush1"],
		terrain: "grass",
	},
	rock: {
		name: "Rock",
		maxAmount: 18,
		sprites: ["rocks/rock1", "rocks/rock2", "rocks/rock3", "rocks/rock4", "rocks/rock5", "rocks/rock6"],
		terrain: "rocky",
	},
	tree: {
		name: "Tree",
		maxAmount: 12,
		sprites: ["trees/tree1", "trees/tree2", "trees/tree3", "trees/tree4", "trees/tree5", "trees/tree6", "trees/tree7", "trees/tree8", "trees/tree9", "trees/tree10", "trees/tree11"],
		regenerate: 0.01,
		terrain: "forest",
	},
} as const satisfies Record<string, Ssh.DepositDefinition>

export const modules = {
	tree_chopper: {
		name: "Tree Chopper",
		maxWorkers: 2,
		carryingCapacity: 1,
		restEase: 10,
		goodsCapacity: 6,
		action: { type: "harvest", deposit: "tree" },
		output: "wood",
		time: 3,
		sprites: ["chopper"],
		icon: "chopper",
	},
	stonecutter: {
		name: "Stone Cutter",
		maxWorkers: 2,
		carryingCapacity: 1,
		restEase: 10,
		goodsCapacity: 6,
		action: { type: "harvest", deposit: "rock" },
		output: "stone",
		time: 4,
		sprites: ["cutter"],
		icon: "cutter",
	},
	sawmill: {
		name: "Sawmill",
		maxWorkers: 3,
		carryingCapacity: 1,
		restEase: 50,
		goodsCapacity: 6,
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
} as const satisfies Record<string, Ssh.GoodsDefinition>
