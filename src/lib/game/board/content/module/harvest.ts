import type { Job } from '$lib/game/job'
import { SpecificStorage } from '$lib/game/storage'
import type { Tile } from '../../tile'
import { Module, multiplyGoodsQty, outputBufferSize } from './module'
export class HarvestModule extends Module {
	constructor(tile: Tile, def: Ssh.ModuleDefinition) {
		if (def.action.type !== 'harvest') {
			throw new Error('HarvestModule can only be created from a harvest action')
		}
		super(
			tile,
			new SpecificStorage({
				...multiplyGoodsQty(def.action.output, outputBufferSize),
			}),
		)
	}
	moduleSpecificJob(): Job | undefined {
		// For harvesters, check if there are resources to harvest
		// For now, assume there are always resources available
		// TODO: check there is a deposit available in the working zone
		// (for now: around the module to a certain distance, 6?))
		// Use that information to calculate the fatigue
		return {
			type: this.action.type,
			fatigue: this.getFatigueCost(),
			urgency: 1,
		}
	}
}
