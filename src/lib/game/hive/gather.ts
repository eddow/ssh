import { computed } from 'mutts/src'
import type { GoodType } from '$lib/arktype'
import type { Job } from '$lib/game/job'
import { noStorage } from '$lib/game/storage'
import { Alveolus } from '../board/content/alveolus'
import type { Tile } from '../board/tile'

export class GatherAlveolus extends Alveolus {
	declare action: Ssh.GatherAction
	constructor(tile: Tile) {
		const def: Ssh.AlveolusDefinition = new.target.prototype
		if (def.action.type !== 'gather') {
			throw new Error('GatherAlveolus can only be created from a gather action')
		}
		super(tile, noStorage)
	}

	@computed
	get hasFreeGoodsToGather(): boolean {
		// Check if there are any free goods in the world that the hive needs
		const hiveNeeds = this.hive.needs
		for (const goodType in hiveNeeds) {
			if (hiveNeeds[goodType as GoodType]?.size) {
				// Check if there are any free goods of this type available
				const allFreeGoods = Array.from(this.tile.game.hex.freeGoods.goods.entries())
				for (const [, goodsList] of allFreeGoods) {
					if (goodsList.some((g) => g.goodType === goodType && !g.allocated && !g.removed)) {
						return true
					}
				}
			}
		}
		return false
	}

	get keepWorking(): boolean {
		return this.hasFreeGoodsToGather
	}

	alveolusSpecificJob(): Job | undefined {
		if (this.hasFreeGoodsToGather) {
			return {
				type: 'gather',
				fatigue: this.getFatigueCost(),
				urgency: 1.5, // Moderate-high urgency to keep goods flowing
			}
		}
	}
}
