import type { GoodType } from '$lib/arktype'
import type { Job } from '$lib/game/job'
import { SpecificStorage } from '$lib/game/storage'
import {
	Alveolus,
	inputBufferSize,
	multiplyGoodsQty,
	outputBufferSize,
} from '../board/content/alveolus'
import type { Tile } from '../board/tile'

export class TransformAlveolus extends Alveolus {
	declare action: Ssh.TransformationAction
	constructor(tile: Tile) {
		const def: Ssh.AlveolusDefinition = new.target.prototype
		if (def.action.type !== 'transform') {
			throw new Error('TransformAlveolus can only be created from a transform action')
		}
		super(
			tile,
			new SpecificStorage({
				...multiplyGoodsQty(def.action.inputs, inputBufferSize),
				...multiplyGoodsQty(def.action.output, outputBufferSize),
			}),
		)
	}
	alveolusSpecificJob(): Job | undefined {
		// For transformers, check if we have required inputs
		const hasInputs = Object.entries(this.action.inputs || {}).every(([goodType, required]) => {
			return this.available(goodType as GoodType) >= (required as number)
		})

		if (hasInputs) {
			return {
				type: this.action.type,
				fatigue: this.getFatigueCost(),
				urgency: 1,
			}
		}
	}
	available(goodType: GoodType): number {
		return goodType in this.action.inputs ? 0 : this.storage.available(goodType)
	}
}
