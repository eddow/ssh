import type { Character } from '$lib/game/population/character'
import type { GatherJob, GoodType } from '$lib/types/base'
import { type Positioned, toAxialCoord } from '$lib/utils/position'
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

	//-@computed
	get hasFreeGoodsToGather(): boolean {
		// Check if there are any free goods in the world that the hive needs
		const hiveNeeds = Array.from(this.hive.needs)
		if (hiveNeeds.length === 0) return false

		// Use FreeGoods.findNearestGoods to check if there are any free goods available within walk time
		const nearestGoods = this.tile.game.hex.freeGoods.findNearestGoods(
			toAxialCoord(this.tile.position),
			toAxialCoord(this.tile.position), // Center is the same as start for gather
			hiveNeeds,
			this.action.radius,
		)
		return nearestGoods !== undefined
	}

	// nextJob() replaces both alveolusSpecificJob() and keepWorking
	// Returns detailed job info including path when called from character
	nextJob(character?: Character): GatherJob | undefined {
		if (!this.hasFreeGoodsToGather || !this.storage.isEmpty) return undefined

		const startPos = character ? toAxialCoord(character.position) : toAxialCoord(this.tile.position)
		const hex = this.tile.game.hex

		// If called from character, find specific path to gatherable
		let path: Positioned[] | undefined
		let goodType: GoodType | undefined
		let selectableGoods = Array.from(this.hive.needs)
		if (character)
			selectableGoods = selectableGoods.filter((good) => character.vehicle.hasRoom(good))
		if (selectableGoods.length === 0) return undefined

		const goodCounts = Object.fromEntries(selectableGoods.map((good) => [good, 0])) as Partial<
			Record<GoodType, number>
		>

		// Count goods within range
		hex.findNearest(
			startPos,
			(pos: Positioned) => {
				const goodsAtTile = hex.freeGoods.getGoodsAt(pos)
				for (const good of goodsAtTile) {
					const gt = good.goodType as GoodType
					if (!good.allocated && gt in goodCounts) goodCounts[gt]!++
				}
				return false
			},
			this.action.radius,
			false,
		)

		const targetGood = Object.entries(goodCounts).reduce(
			(max, [good, count]) => (count > max.count ? { good: good as GoodType, count } : max),
			{ good: null as GoodType | null, count: 0 },
		).good

		if (!targetGood) return undefined

		const result = hex.freeGoods.findNearestGoods(
			startPos,
			startPos,
			[targetGood],
			this.action.radius,
		)
		if (result) {
			path = result.path
			goodType = targetGood
		}

		return (
			path && {
				job: 'gather',
				path,
				goodType,
				urgency: 1.5,
				fatigue: this.getFatigueCost(),
			}
		)
	}
}
