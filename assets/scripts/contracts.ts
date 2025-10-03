import { type ContractType, Goods, GoodType } from '$lib/arktype'
import { TileArkType } from '$lib/game/board/tile'
import { Position, Positioned } from '$lib/utils/position'
export const CharacterContract = {
	walk: {
		into: [Position.array()],
		until: [Position.array()],
	},
	inventory: {
		dropAllFree: [],
		makeRoom: [],
		dropStored: [Goods, TileArkType, Position.array().optional(), 'boolean?'],
		grabStored: [Goods, TileArkType, Position.array().optional(), 'boolean?'],
		grabFree: [GoodType, Positioned, Position.array().optional(), 'boolean?'],
	},
	selfCare: {
		goEat: [],
		wander: [],
	},
	work: {
		// It's well known, it's a jobPlan
		goWork: ['unknown', Position.array()],
		harvest: ['unknown'],
		convey: ['unknown'],
		gather: ['unknown'],
		transform: ['unknown'],
	},
} as const

export type CharacterContract = ContractType<typeof CharacterContract>
