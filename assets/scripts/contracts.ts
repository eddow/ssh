import { type ContractType, Goods, GoodType } from '$lib/arktype'
import { TileArkType } from '$lib/game/board/tile'
import { WorkPlan } from '$lib/game/npcs/context/plan'
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
		goWork: [WorkPlan, Position.array()],
		harvest: [WorkPlan],
		convey: [WorkPlan],
		offload: [WorkPlan],
		gather: [WorkPlan],
		transform: [WorkPlan],
		construct: [WorkPlan],
	},
} as const

export type CharacterContract = ContractType<typeof CharacterContract>
