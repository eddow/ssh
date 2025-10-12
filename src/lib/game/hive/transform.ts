import { computed } from 'mutts/src'
import { inputBufferSize, outputBufferSize } from '$assets/constants'
import { traces } from '$lib/debug'
import type { Character } from '$lib/game/population/character'
import { SpecificStorage } from '$lib/game/storage'
import type { GoodType, TransformJob } from '$lib/types/base'
import { Alveolus } from '../board/content/alveolus'
import { multiplyGoodsQty } from '../board/content/utils'
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
				return (this.storage.available(goodType as GoodType) || 0) >= (required as number)
			}) &&
			// If we have all the room for the outputs
			this.storage.canStoreAll(this.action.output)
		)
	}
	// nextJob() replaces both alveolusSpecificJob() and keepWorking
	nextJob(_character?: Character): TransformJob | undefined {
		if (!this.canWork) return undefined

		return {
			job: 'transform',
			urgency: 1,
			fatigue: this.getFatigueCost(),
		}
	}

	advertise(): void {
		traces.advertising?.groupCollapsed(`Advertising ${this.name}`)
		const action = this.action
		for (const [gt] of Object.entries(action.inputs))
			while (this.storage?.hasRoom(gt as GoodType) && this.hive.demand(gt as GoodType, this));
		for (const [gt] of Object.entries(action.output))
			while (this.storage?.available(gt as GoodType) && this.hive.provide(gt as GoodType, this));
		traces.advertising?.groupEnd()
	}
	canGive(goodType: GoodType): number {
		return goodType in this.action.output ? this.storage.available(goodType) : 0
	}
	canTake(goodType: GoodType): number {
		return goodType in this.action.inputs ? this.storage.hasRoom(goodType) : 0
	}
}
