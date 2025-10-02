import { type ContractType, GoodType } from '$lib/arktype'
import { AlveolusArkType } from '$lib/game/board/content/alveolus'
import { TileArkType } from '$lib/game/board/tile'
import { Position } from '$lib/utils/position'
export const CharacterContract = {
	walk: {
		into: [Position.array()],
		until: [Position.array()],
	},
	inventory: {
		dropAll: [],
		makeRoom: [],
		dropStored: [GoodType, 'number', TileArkType, Position.array().optional(), 'boolean?'],
		grabStored: [GoodType, 'number', TileArkType, Position.array().optional(), 'boolean?'],
		grabFree: [GoodType, TileArkType, Position.array().optional(), 'boolean?'],
	},
	selfCare: {
		goEat: [],
		wander: [],
	},
	work: {
		goWork: [AlveolusArkType, 'string', Position.array()],
		harvest: [AlveolusArkType],
		convey: [AlveolusArkType],
		gather: [AlveolusArkType],
		transform: [AlveolusArkType],
	},
} as const

export type CharacterContract = ContractType<typeof CharacterContract>
