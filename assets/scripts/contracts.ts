import type { ContractType } from '$lib/arktype'
import { Positioned } from '$lib/game/position'


// Const → Type contracts (declarative shape used for typings)
export const CharacterContract = {
	walk: {
		into: [Positioned],
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
