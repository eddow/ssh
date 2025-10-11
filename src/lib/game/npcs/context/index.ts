import * as gameContent from '$assets/game-content'
import type { CharacterContract } from '$assets/scripts/contracts'
import type { HarvestAlveolus } from '$lib/game/hive/harvest'
import { contract } from '$lib/types'
import type { GoodType } from '$lib/types/base'
import { objectMap } from '$lib/utils'
import { toAxialCoord } from '$lib/utils/position'
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
export { PickupPlan as GatherPlan, Plan, TransferPlan, WorkPlan } from '$lib/types/base'

class CharacterContext extends InteractiveContext<Character> {
	get I() {
		return this[subject]
	}
	@contract('GoodType?')
	haveRoom(goodType?: GoodType): number {
		return this[subject].vehicle.hasRoom(goodType)
	}
	@contract('HarvestAlveolus')
	isGatherable(harvestAlveolus: HarvestAlveolus) {
		// Return true if the harvest alveolus is full (can't store more)
		if (!harvestAlveolus.canStoreInHarvester) return true

		// TODO: check all gatherers collected by harvestAlveolus - even outside the hive
		const gatherers = harvestAlveolus.hive.byActionType.gather
		if (!gatherers || gatherers.length === 0) return false

		// Get the goods produced by this harvest alveolus
		const producedGoods = Object.keys(harvestAlveolus.action.output) as GoodType[]

		// Check if any gatherer can reach this position and gather the produced goods
		const currentPos = this[subject].tile.position

		return gatherers.some((gatherer) => {
			// Check if the gatherer can reach this position within its radius (walk time)
			const path = this[subject].game.hex.findPathForCharacter(
				toAxialCoord(gatherer.tile.position),
				toAxialCoord(currentPos),
				this[subject],
				(gatherer.action as Ssh.GatherAction).radius,
				false,
			)

			// If no path exists within the radius, this gatherer can't reach us
			if (!path) return false

			// Check if the hive needs any of the produced goods
			return producedGoods.some((good) => harvestAlveolus.hive.needs.has(good))
		})
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
