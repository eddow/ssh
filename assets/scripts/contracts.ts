import type { ContractType } from '$lib/arktype'
import '$lib/game/position'
import { Position } from '$lib/game/position'
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
} as const

export type CharacterContract = ContractType<typeof CharacterContract>
