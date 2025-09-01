export const resources: Record<string, Resources.SpriteDefinition> = {
	rocks: {
		file: "assets/objects/rocks.png",
		atlas: "assets/objects/rocks.json",
	},
	trees: {
		file: "assets/objects/trees.png",
		atlas: "assets/objects/trees.json",
	},
}
export const deposits: Record<string, Resources.DepositDefinition> = {
	/*
	berry_bush: {
		name: 'Berry Bush',
		harvestTime: 2,
		produced: {
			berries: 1
		},
		maxAmount: 72,
		regenerateRate: 1
	},*/
	rock: {
		name: "Rock",
		maxAmount: 144,
		sprites: [{ atlas: "rocks" }],
	},
	tree: {
		name: "Tree",
		maxAmount: 72,
		sprites: [{ atlas: "trees" }],
		regenerate: 0.01,
	},
}

export const buildings: Record<string, Resources.BuildingDefinition> = {
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
		sprites: [{ atlas: "buildings", frame: "sawmill" }],
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
		sprites: [{ atlas: "buildings", frame: "shack" }],
	},
	stonecutter: {
		name: "Stone Cutter",
		maxWorkers: 2,
		carryingCapacity: 1,
		restEase: 10,
		goodsCapacity: { stone: 12 },
		actions: [{ type: "harvesting", deposit: "rock", output: { stone: 1 }, time: 4 }],
		sprites: [{ atlas: "buildings", frame: "stonecutter" }],
	},
	tree_chopper: {
		name: "Tree Chopper",
		maxWorkers: 2,
		carryingCapacity: 1,
		restEase: 10,
		goodsCapacity: { wood: 12 },
		actions: [{ type: "harvesting", deposit: "tree", output: { wood: 1 }, time: 3 }],
		sprites: [{ atlas: "buildings", frame: "tree_chopper" }],
	},
}
