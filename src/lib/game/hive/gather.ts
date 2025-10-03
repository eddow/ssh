import { type } from 'arktype'
import type { Job } from '$lib/game/job'
import { toAxialCoord } from '$lib/utils/position'
import type { Tile } from '../board/tile'
import { SlottedStorage } from '../storage'
import { TransitAlveolus } from './transit'

export class GatherAlveolus extends TransitAlveolus {
	declare action: Ssh.GatherAction
	constructor(tile: Tile) {
		const def: Ssh.AlveolusDefinition = new.target.prototype
		if (def.action.type !== 'gather') {
			throw new Error('GatherAlveolus can only be created from a gather action')
		}
		super(tile, new SlottedStorage(6, 6))
	}

	//@computed
	get hasFreeGoodsToGather(): boolean {
		// Check if there are any free goods in the world that the hive needs
		const hiveNeeds = Array.from(this.hive.needs)
		if (hiveNeeds.length === 0) return false

		// Use FreeGoods.findNearestGoods to check if there are any free goods available within radius
		const nearestGoods = this.tile.game.hex.freeGoods.findNearestGoods(
			toAxialCoord(this.tile.position),
			toAxialCoord(this.tile.position), // Center is the same as start for gather
			hiveNeeds,
			this.action.radius,
		)
		return nearestGoods !== undefined
	}

	get keepWorking(): boolean {
		return this.hasFreeGoodsToGather && this.storage.isEmpty
	}

	alveolusSpecificJob(): Job | undefined {
		if (this.hasFreeGoodsToGather && this.storage.isEmpty) {
			return {
				type: 'gather',
				fatigue: this.getFatigueCost(),
				urgency: 1.5, // Moderate-high urgency to keep goods flowing
			}
		}
	}
}

export const GatherAlveolusArkType = type.instanceOf(GatherAlveolus)
