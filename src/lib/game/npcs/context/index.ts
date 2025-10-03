import * as gameContent from '$assets/game-content'
import type { CharacterContract } from '$assets/scripts/contracts'
import { contract, GoodType } from '$lib/arktype'
import { objectMap } from '$lib/utils'
import type { Character } from '../../population/character'
import { InteractiveContext, loadNpcScripts, protoCtx, subject } from '../scripts'

// Import all the function classes
import { FindFunctions } from './find'
import { InventoryFunctions } from './inventory'
import { PlanFunctions } from './plan'
import { SelfCareFunctions } from './selfCare'
import { WalkFunctions } from './walk'
import { WorkFunctions } from './work'

// Re-export TransferPlan for external use
export type { PickupPlan as GatherPlan, Plan, TransferPlan, WorkPlan } from './plan'

class CharacterContext extends InteractiveContext<Character> {
	get I() {
		return this[subject]
	}
	@contract(GoodType.optional())
	haveRoom(goodType?: GoodType): number {
		return this[subject].vehicle.hasRoom(goodType)
	}
	@contract()
	advertiseAlveolus() {
		return this[subject].assignedAlveolus!.campaign()
	}
}

const characterContext = protoCtx(CharacterContext, {
	find: protoCtx(FindFunctions),
	inventory: protoCtx(InventoryFunctions),
	walk: protoCtx(WalkFunctions),
	selfCare: protoCtx(SelfCareFunctions),
	work: protoCtx(WorkFunctions),
	plan: protoCtx(PlanFunctions),
	...gameContent,
})

const alveoli = import.meta.glob('$assets/scripts/**/*.npcs', {
	query: '?raw',
	eager: true,
})
loadNpcScripts(
	objectMap(alveoli, (v: any) => v.default) as Record<string, string>,
	characterContext,
)
export default function aCharacterContext(character: Character) {
	return Object.create(characterContext, {
		[subject]: { value: character },
	}) as CharacterContract & typeof characterContext
}
