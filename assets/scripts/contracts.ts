import { GoodType, type ContractType } from '$lib/arktype'
import { TileArkType } from '$lib/game/board/tile'
import { ModuleArkType } from '$lib/game/board/content/module'
import { Position } from '$lib/game/position'
import { Module, type } from 'arktype'
import { TileBorderArkType } from '$lib/game'
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
		goWork: [ModuleArkType, 'string', Position.array()],
		harvest: [ModuleArkType],
	},
} as const

export type CharacterContract = ContractType<typeof CharacterContract>
