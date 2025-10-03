import { type } from 'arktype'
import { contract, Goods, GoodType } from '$lib/arktype'
import { assert } from '$lib/debug'
import { type TileBorder, TileBorderArkType } from '$lib/game/board/border/border'
import { type Tile, TileArkType } from '$lib/game/board/tile'
import type { Character } from '$lib/game/population/character'
import { Positioned, toAxialCoord } from '$lib/utils'
import { subject } from '../scripts'
import { DurationStep } from '../steps'
import type { GatherPlan, TransferPlan } from './plan'

class InventoryFunctions {
	declare [subject]: Character

	@contract(GoodType, 'number?')
	dropAsFreeGood(goodType: GoodType, maxAmount: number = 1) {
		const character = this[subject]
		const { vehicle } = character
		assert(vehicle, 'tile.vehicle must be set')

		const available = vehicle.available(goodType) ?? 0
		let amount = Math.min(available, maxAmount)
		if (amount <= 0) throw new Error('No goods to drop')
		const vehicleTransfer = vehicle.reserve({ [goodType]: amount }, `drop.${goodType}`)
		return new DurationStep(amount * vehicle.transferTime, 'convey', `drop.${goodType}`)
			.finished(() => {
				while (amount--)
					character.game.hex.freeGoods.add(character.tile, goodType, character.position)
				vehicleTransfer.fulfill()
			})
			.canceled(() => {
				vehicleTransfer.cancel()
			})
	}
	@contract(Goods, type.or(TileArkType, TileBorderArkType))
	planDropStored(goods: Goods, destination: Tile | TileBorder): TransferPlan {
		const character = this[subject]
		const content = destination.content
		const vehicle = character.vehicle
		assert(vehicle, 'tile.vehicle must be set')
		assert(content, 'destination.content must be set')
		assert('storage' in content, 'planDropStored only works with TileContent that has storage')

		// Calculate actual amounts for each good type
		const actualGoods: Goods = {}
		let totalAmount = 0

		for (const [goodType, requestedQuantity] of Object.entries(goods) as [GoodType, number][]) {
			if (!requestedQuantity || requestedQuantity <= 0) continue

			const available = vehicle.available(goodType) ?? 0
			const canStore = content.storage?.hasRoom(goodType) || 0
			const amount = Math.min(available, canStore, requestedQuantity)

			if (amount > 0) {
				actualGoods[goodType] = amount
				totalAmount += amount
			}
		}

		if (totalAmount <= 0) throw new Error('No goods to drop')

		// Return plan without allocations - they will be created in plan.begin()
		return {
			type: 'transfer' as const,
			description: 'drop' as const,
			goods: actualGoods,
			target: destination,
		}
	}
	@contract(Goods, type.or(TileArkType, TileBorderArkType))
	planGrabStored(goods: Goods, source: Tile | TileBorder) {
		const character = this[subject]
		const vehicle = character.vehicle
		assert(vehicle, 'tile.vehicle must be set')
		const content = source.content
		assert(content, 'source.content must be set')
		assert('storage' in content, 'planGrabStored only works with TileContent that has storage')

		// Calculate actual amounts for each good type
		const actualGoods: Goods = {}
		let totalAmount = 0

		for (const [goodType, requestedQuantity] of Object.entries(goods) as [GoodType, number][]) {
			if (!requestedQuantity || requestedQuantity <= 0) continue

			const canGrab = vehicle.hasRoom(goodType)
			if (canGrab <= 0) continue // Skip this good type if no room

			const available = content.storage?.available(goodType) ?? 0
			const amount = Math.min(canGrab, available, requestedQuantity)

			if (amount > 0) {
				actualGoods[goodType] = amount
				totalAmount += amount
			}
		}

		if (totalAmount <= 0) throw new Error('No goods to grab from storage')

		// Return plan without allocations - they will be created in plan.begin()
		return {
			type: 'transfer' as const,
			description: 'grab' as const,
			goods: actualGoods,
			sourceTile: source,
		}
	}

	@contract(GoodType, Positioned)
	planGrabFree(goodType: GoodType, source: Positioned): GatherPlan {
		const character = this[subject]
		const vehicle = character.vehicle
		assert(vehicle, 'tile.vehicle must be set')

		const canGrab = vehicle.hasRoom(goodType)
		if (canGrab <= 0) throw new Error('No room in vehicle to grab goods')

		// Check for FreeGoods on the tile - always grab exactly 1
		const coord = toAxialCoord(source)
		const freeGoods = character.game.hex.freeGoods.getGoodsAt(coord)
		const matchingFreeGoods = freeGoods.filter(
			(good) => good.goodType === goodType && !good.removed && !good.allocated,
		)

		if (matchingFreeGoods.length === 0) {
			debugger
			throw new Error('No FreeGoods to grab')
		}

		// Return plan without allocations - they will be created in plan.begin()
		return {
			type: 'gather' as const,
			goodType,
			target: source,
		}
	}
	@contract('object')
	effectuate(action: TransferPlan | GatherPlan) {
		const character = this[subject]
		const { vehicleAllocation } = action
		const {
			tile: { content },
			vehicle,
		} = character
		assert(content, 'tile.content must be set')
		assert(vehicle, 'tile.vehicle must be set')
		assert(vehicleAllocation, 'vehicleAllocation must be set - plan should be in begin() state')

		// Calculate total transfer time based on plan type
		let totalAmount: number
		let description: string

		if (action.type === 'transfer') {
			totalAmount = Object.values(action.goods).reduce((sum, qty) => sum + qty, 0)
			description = action.description
		} else if (action.type === 'gather') {
			totalAmount = 1 // Always grab exactly 1 FreeGood
			description = 'gather'
		} else {
			throw new Error('Unknown plan type')
		}

		return new DurationStep(totalAmount * vehicle.transferTime, 'convey', description)
	}
}

export { InventoryFunctions }
