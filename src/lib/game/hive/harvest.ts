import type { Job } from '$lib/game/job'
import { SpecificStorage } from '$lib/game/storage'
import { Alveolus, multiplyGoodsQty, outputBufferSize } from '../board/content/alveolus'
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
	/**
	 * Used by the NPCS to determine whether to gather or let the goods outside
	 * @returns true if the alveolus can gather resources
	 */
	get gather(): boolean {
		// TODO: indeed, make a priority thingy
		return (
			this.canStoreAll(this.action.output) &&
			!((this.hive.byActionType.transit?.length && true) /* hive.canStoreAll */)
		)
	}
	alveolusSpecificJob(): Job | undefined {
		// For harvesters, check if there are resources to harvest
		// For now, assume there are always resources available
		// TODO: check there is a deposit available in the working zone
		// (for now: around the alveolus to a certain distance, 6?))
		// Use that information to calculate the fatigue
		return {
			type: this.action.type,
			fatigue: this.getFatigueCost(),
			urgency: 1,
		}
	}
}
