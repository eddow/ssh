import type { ContractType } from '$lib/arktype'
import { Module } from '$lib/game/hex/tile/module'
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
