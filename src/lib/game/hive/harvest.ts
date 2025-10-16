import { maxWalkTime, outputBufferSize } from '$assets/constants'
import type { Character } from '$lib/game/population/character'
import { SpecificStorage } from '$lib/game/storage'
import type { HarvestJob } from '$lib/types/base'
import { axialDistance, type Positioned, toAxialCoord } from '../../utils/position'
import { UnBuiltLand } from '../board'
import { multiplyGoodsQty } from '../board/content/utils'
import type { Tile } from '../board/tile'
import { TransitAlveolus } from './transit'
export class HarvestAlveolus extends TransitAlveolus {
	declare action: Ssh.HarvestingAction
	constructor(tile: Tile) {
		const def: Ssh.AlveolusDefinition = new.target.prototype
		if (def.action.type !== 'harvest') {
			throw new Error('HarvestAlveolus can only be created from a harvest action')
		}
		super(
			tile,
			new SpecificStorage({
				...multiplyGoodsQty(def.action.output, outputBufferSize),
			}),
		)
	}

	//-@computed
	get canStoreInHarvester() {
		return this.storage.canStoreAll(this.action.output)
	}
	//-@computed
	get hiveHasCollector() {
		return this.hive.byActionType.gather?.length
	}
	//-@computed
	get alveoliNeedingGood() {
		return Object.keys(this.action.output).reduce(
			(acc, goodType) => acc + (goodType in this.hive.needs ? 1 : 0),
			0,
		)
	}
	// nextJob() replaces both alveolusSpecificJob() and keepWorking
	// Returns detailed job info including path when called from character
	nextJob(character?: Character): HarvestJob | undefined {
		if (!this.working) return undefined
		const startPos = character ? toAxialCoord(character.position) : toAxialCoord(this.tile.position)
		const hex = this.tile.game.hex
		const searchDistance = character ? maxWalkTime : 6

		// Helper to find deposit with priority
		const findDeposit = (priority: 'construction' | 'clearing' | 'zone' | 'any') => {
			const searchFn = (coord: Positioned) => {
				const tile = hex.getTile(coord)
				if (!(tile?.content instanceof UnBuiltLand)) return false
				if (tile.content.deposit?.name !== this.action.deposit) return false

				return priority === 'clearing' ? tile.clearing : tile.zone === 'harvest'
			}

			return hex.findNearest(startPos, searchFn, searchDistance, false)
		}

		let path = findDeposit('clearing')
		if (path) {
			return {
				job: 'harvest',
				path,
				urgency: 2.5,
				fatigue:
					this.getFatigueCost() +
					(character ? axialDistance(startPos, path[path.length - 1]) * 2 : 0),
			}
		}

		// For regular harvesting, only offer if harvester can store
		if (!this.canStoreInHarvester) return undefined

		path = findDeposit('any')
		if (path) {
			return {
				job: 'harvest',
				path,
				urgency: (this.alveoliNeedingGood ? 0.5 : 0) + 0.25,
				fatigue:
					this.getFatigueCost() +
					(character ? axialDistance(startPos, path[path.length - 1]) * 2 : 0),
			}
		}

		return undefined
	}
}
