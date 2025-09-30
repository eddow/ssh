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
	concrete: {},
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
		maxAmount: 18,
		regenerate: 0.01,
		sprites: ['bushes/bush1'],
		generation: {
			goods: { berries: 0.05 },
		},
	},
	rock: {
		maxAmount: 18,
		sprites: [
			'rocks/rock1',
			'rocks/rock2',
			'rocks/rock3',
			'rocks/rock4',
			'rocks/rock5',
			'rocks/rock6',
		],
		generation: {
			goods: { stone: 0.6 },
		},
	},
	tree: {
		maxAmount: 12,
		sprites: [
			'trees/tree1',
			'trees/tree2',
			'trees/tree3',
			'trees/tree4',
			'trees/tree5',
			'trees/tree6',
			'trees/tree7',
			'trees/tree8',
			'trees/tree9',
			'trees/tree10',
			'trees/tree11',
		],
		regenerate: 0.01,
		generation: {
			goods: { wood: 0.5 },
		},
	},
} as const satisfies Record<string, Ssh.DepositDefinition>

export const alveoli = {
	tree_chopper: {
		preparationTime: 2,
		action: { type: 'harvest', deposit: 'tree', output: { wood: 1 } },
		workTime: 3,
		sprites: ['chopper'],
		icon: 'chopper',
	},
	stonecutter: {
		preparationTime: 3,
		action: { type: 'harvest', deposit: 'rock', output: { stone: 1 } },
		workTime: 4,
		sprites: ['cutter'],
		icon: 'cutter',
	},
	sawmill: {
		preparationTime: 1,
		action: { type: 'transform', inputs: { wood: 1 }, output: { planks: 1 } },
		workTime: 2,
		sprites: ['sawmill'],
		icon: 'sawmill',
	},
	storage: {
		preparationTime: 1,
		action: { type: 'storage', capacity: 3, slots: 6 },
		workTime: 0,
		sprites: ['store'],
		icon: 'store',
	},
	transit: {
		preparationTime: 1,
		action: { type: 'transit', individual: true },
		workTime: 2,
		sprites: ['transit'],
		icon: 'transit',
	},
} as const satisfies Record<string, Ssh.AlveolusDefinition>

export const goods = {
	berries: {
		feedingValue: 72,
		sprites: ['berries'],
		icon: 'berries',
		halfLife: 180, // 3 minutes
	},
	mushrooms: {
		feedingValue: 160,
		sprites: ['mushrooms'],
		icon: 'mushrooms',
		halfLife: 300, // 5 minutes
	},
	planks: {
		feedingValue: 0,
		sprites: ['planks'],
		icon: 'planks',
		halfLife: 600, // 10 minutes
	},
	stone: {
		feedingValue: 0,
		sprites: ['stone'],
		icon: 'stone',
		halfLife: 900, // 15 minutes
	},
	wood: {
		feedingValue: 0,
		sprites: ['wood'],
		icon: 'wood',
		halfLife: 300, // 5 minutes
	},
} as const satisfies Record<string, Ssh.GoodsDefinition>
