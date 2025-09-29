import { computed } from 'mutts/src'
import { inputBufferSize, outputBufferSize } from '$assets/constants'
import type { GoodType } from '$lib/arktype'
import type { Job } from '$lib/game/job'
import { SpecificStorage } from '$lib/game/storage'
import { Alveolus, multiplyGoodsQty } from '../board/content/alveolus'
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
	@computed
	get canWork(): boolean {
		return (
			// If we have all the inputs required
			Object.entries(this.action.inputs || {}).every(([goodType, required]) => {
				return this.storage.available(goodType as GoodType) >= (required as number)
			}) &&
			// If we have all the room for the outputs
			Object.entries(this.action.output || {}).every(([goodType, required]) => {
				return this.storage.hasRoom(goodType as GoodType) >= (required as number)
			})
		)
	}
	alveolusSpecificJob(): Job | undefined {
		if (this.canWork) {
			return {
				type: 'transform',
				fatigue: this.getFatigueCost(),
				urgency: 1,
			}
		}
	}
	get keepWorking(): boolean {
		return this.canWork
	}
	available(goodType: GoodType): number {
		return goodType in this.action.inputs ? 0 : this.storage.available(goodType)
	}
}
