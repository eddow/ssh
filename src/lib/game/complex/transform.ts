import type { GoodType } from '$lib/arktype'
import type { Job } from '$lib/game/job'
import { SpecificStorage } from '$lib/game/storage'
import {
	inputBufferSize,
	Module,
	multiplyGoodsQty,
	outputBufferSize,
} from '../board/content/module'
import type { Tile } from '../board/tile'

export class TransformModule extends Module {
	declare action: Ssh.TransformationAction
	constructor(tile: Tile) {
		const def: Ssh.ModuleDefinition = new.target.prototype
		if (def.action.type !== 'transform') {
			throw new Error('TransformModule can only be created from a transform action')
		}
		super(
			tile,
			new SpecificStorage({
				...multiplyGoodsQty(def.action.inputs, inputBufferSize),
				...multiplyGoodsQty(def.action.output, outputBufferSize),
			}),
		)
	}
	moduleSpecificJob(): Job | undefined {
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
