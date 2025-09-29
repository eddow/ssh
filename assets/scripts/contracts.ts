import { type ContractType, GoodType } from '$lib/arktype'
import { AlveolusArkType } from '$lib/game/board/content/alveolus'
import { TileArkType } from '$lib/game/board/tile'
import { Position } from '$lib/game/position'
export const CharacterContract = {
	walk: {
		into: [Position.array()],
		until: [Position.array()],
	},
	inventory: {
		dropAll: [],
		makeRoom: [],
		goDrop: [GoodType, 'number', TileArkType, Position.array().optional(), 'boolean?'],
		goGrab: [GoodType, 'number', TileArkType, Position.array().optional(), 'boolean?'],
	},
	selfCare: {
		goEat: [],
		wander: [],
	},
	work: {
		goWork: [AlveolusArkType, 'string', Position.array()],
		harvest: [AlveolusArkType],
		convey: [AlveolusArkType],
		transform: [AlveolusArkType],
	},
} as const

export type CharacterContract = ContractType<typeof CharacterContract>
