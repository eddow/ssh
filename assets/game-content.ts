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
			berries: 0.000214, // Balanced for 1 berry per bush at equilibrium
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
			mushrooms: 0.000097, // Balanced for 1 mushroom per 2 trees at equilibrium
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
		// No wood/plank cost for the wood-chopper itself
		constructionCost: { stone: 2 },
	},
	stonecutter: {
		preparationTime: 3,
		action: { type: 'harvest', deposit: 'rock', output: { stone: 1 } },
		workTime: 4,
		sprites: ['cutter'],
		icon: 'cutter',
		// No stone cost for the stone cutter
		constructionCost: { wood: 2, planks: 1 },
	},
	sawmill: {
		preparationTime: 1,
		action: { type: 'transform', inputs: { wood: 1 }, output: { planks: 1 } },
		workTime: 2,
		sprites: ['sawmill'],
		icon: 'sawmill',
		// No planks cost for the sawmill
		constructionCost: { wood: 3, stone: 2 },
	},
	storage: {
		preparationTime: 1,
		action: { type: 'storage', capacity: 3, slots: 6 },
		workTime: 0,
		sprites: ['store'],
		icon: 'store',
		constructionCost: { wood: 2, planks: 2, stone: 1 },
	},
	gather: {
		preparationTime: 1,
		action: { type: 'gather', radius: 3 },
		workTime: 2,
		sprites: ['transit'],
		icon: 'transit',
		constructionCost: { wood: 1, planks: 1, stone: 1 },
	},
	building: {
		preparationTime: 1,
		action: { type: 'build', target: 'sawmill' },
		workTime: 2,
		sprites: ['construction'],
		icon: 'construction',
	},
	engineer: {
		preparationTime: 1,
		action: { type: 'engineer', radius: 6 },
		workTime: 2,
		sprites: ['engineer'],
		icon: 'engineer',
		constructionCost: { wood: 1, stone: 1 },
	},
} as const satisfies Record<string, Ssh.AlveolusDefinition>

export const goods = {
	berries: {
		feedingValue: 72,
		sprites: ['berries'],
		icon: 'berries',
		halfLife: 90, // 3 minutes
	},
	mushrooms: {
		feedingValue: 160,
		sprites: ['mushrooms'],
		icon: 'mushrooms',
		halfLife: 180, // 5 minutes
	},
	planks: {
		sprites: ['planks'],
		icon: 'planks',
		halfLife: 600, // 10 minutes
	},
	stone: {
		sprites: ['stone'],
		icon: 'stone',
		halfLife: Infinity, // infinite half-life
	},
	wood: {
		sprites: ['wood'],
		icon: 'wood',
		halfLife: 300, // 5 minutes
	},
} as const satisfies Record<string, Ssh.GoodsDefinition>
