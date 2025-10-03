import { computed } from 'mutts/src'
import { outputBufferSize } from '$assets/constants'
import type { GoodType } from '$lib/arktype'
import type { Job } from '$lib/game/job'
import { SpecificStorage } from '$lib/game/storage'
import { axialDistance, type Positioned, toAxialCoord } from '../../utils/position'
import { UnBuiltLand } from '../board'
import { Alveolus, multiplyGoodsQty } from '../board/content/alveolus'
import type { Tile } from '../board/tile'
export class HarvestAlveolus extends Alveolus {
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

	/**
	 * Used by the NPCS to determine whether to gather or let the goods outside
	 * @returns true if the alveolus can gather resources
	 */
	get gather(): boolean {
		return this.canStoreInHarvester && !this.hiveHasCollector
	}
	alveolusSpecificJob(): Job | undefined {
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
