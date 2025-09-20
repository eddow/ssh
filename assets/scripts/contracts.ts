import { GoodType, type ContractType } from '$lib/arktype'
import { TileType } from '$lib/game/board/tile'
import { Module } from '$lib/game/board/content/module'
import { Position } from '$lib/game/position'
import { type } from 'arktype'
import { TileBorderType } from '$lib/game'
export const CharacterContract = {
	walk: {
		into: [Position.array()],
		until: [Position.array()],
	},
	inventory: {
		dropAll: [],
		makeRoom: [],
		goDrop: [GoodType, 'number', type.or(TileType, TileBorderType), Position.array()],
		goGrab: [GoodType, 'number', type.or(TileType, TileBorderType), Position.array()],
	},
	selfCare: {
		goEat: [],
		wander: [],
	},
	work: {
		goWork: [type.instanceOf(Module), 'string', Position.array()],
		harvest: [type.instanceOf(Module)],
	},
} as const

export type CharacterContract = ContractType<typeof CharacterContract>
