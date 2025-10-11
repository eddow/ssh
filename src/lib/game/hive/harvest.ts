import { computed } from 'mutts/src'
import { outputBufferSize } from '$assets/constants'
import { SpecificStorage } from '$lib/game/storage'
import type { GoodType, Job } from '$lib/types/base'
import { axialDistance, type Positioned, toAxialCoord } from '../../utils/position'
import { UnBuiltLand } from '../board'
import { multiplyGoodsQty } from '../board/content/utils'
import type { Tile } from '../board/tile'
import { BuildAlveolus } from './build'
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

	@computed
	get canStoreInHarvester() {
		return this.storage.canStoreAll(this.action.output)
	}
	@computed
	get hiveHasCollector() {
		return this.hive.byActionType.gather?.length
	}
	@computed
	get alveoliNeedingGood() {
		return Object.keys(this.action.output).reduce(
			(acc, goodType) => acc + (this.hive.needs.has(goodType as GoodType) ? 1 : 0),
			0,
		)
	}
	// TODO: no more `keepWorking` but a generic job finding function
	get keepWorking(): boolean {
		return this.storage.canStoreAll(this.action.output)
	}
	alveolusSpecificJob(): Job | undefined {
		// TODO: Give specifications of the job (like the deposit found) in the job description ?
		// First, try to find a deposit on a construction site tile (highest priority)
		const constructionDeposit = this.tile.game.hex.findNearest(
			toAxialCoord(this.tile.position),
			(coord: Positioned) => {
				const tile = this.tile.game.hex.getTile(coord)
				// Check if there's a BuildAlveolus on a neighboring tile waiting for this tile to be cleared
				return (
					tile?.content instanceof UnBuiltLand &&
					tile.content.deposit?.name === this.action.deposit &&
					tile.neighborTiles.some((neighbor) => neighbor.content instanceof BuildAlveolus)
				)
			},
			6,
		)

		// If found, prioritize it with higher urgency
		if (constructionDeposit) {
			const constructionDepositCoord = constructionDeposit[constructionDeposit.length - 1]
			return {
				type: 'harvest',
				fatigue:
					this.getFatigueCost() + axialDistance(this.tile.position, constructionDepositCoord) * 2,
				urgency: 3, // High urgency for construction site clearing
			}
		}

		// Second, try to find deposits in harvest zones (cleaning duties)
		// These jobs are offered even when the harvester is full, since goods can be dropped as free goods
		const zoneDeposit = this.tile.game.hex.findNearest(
			toAxialCoord(this.tile.position),
			(coord: Positioned) => {
				const tile = this.tile.game.hex.getTile(coord)
				return (
					tile?.content instanceof UnBuiltLand &&
					tile.content.deposit?.name === this.action.deposit &&
					tile.zone === 'harvest'
				)
			},
			6,
		)

		// If found, prioritize it with medium urgency
		if (zoneDeposit) {
			const zoneDepositCoord = zoneDeposit[zoneDeposit.length - 1]
			return {
				type: 'harvest',
				fatigue: this.getFatigueCost() + axialDistance(this.tile.position, zoneDepositCoord) * 2,
				urgency: 2, // Medium urgency for zone cleaning
			}
		}

		// For regular harvesting (not cleaning), only offer job if there's room to store
		if (!this.keepWorking) return undefined

		// Otherwise, find any deposit of the right type
		const nearestDeposit = this.tile.game.hex.findNearest(
			toAxialCoord(this.tile.position),
			(coord: Positioned) => {
				const tile = this.tile.game.hex.getTile(coord)
				return (
					tile?.content instanceof UnBuiltLand && tile.content.deposit?.name === this.action.deposit
				)
			},
			6,
		)
		if (!nearestDeposit) return undefined
		const nearestDepositCoord = nearestDeposit[nearestDeposit.length - 1]
		return {
			type: this.action.type,
			fatigue: this.getFatigueCost() + axialDistance(this.tile.position, nearestDepositCoord) * 2,
			urgency: (this.alveoliNeedingGood ? 0.5 : 0) + 0.25,
		}
	}
}
