import type { ContractType } from '$lib/arktype'
import { Module } from '$lib/game/board/content/module'
import '$lib/game/position'
import { Position } from '$lib/game/position'
import { type } from 'arktype'
export const CharacterContract = {
	walk: {
		into: [Position.array()],
		until: [Position.array()],
	},
	inventory: {
		dropAll: [],
		makeRoom: [],
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
