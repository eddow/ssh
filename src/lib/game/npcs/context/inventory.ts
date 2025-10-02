import { type } from 'arktype'
import { contract, GoodType } from '$lib/arktype'
import { assert } from '$lib/debug'
import { type TileBorder, TileBorderArkType } from '$lib/game/board/border/border'
import { type Tile, TileArkType } from '$lib/game/board/tile'
import type { Character } from '$lib/game/population/character'
import type { AllocationBase } from '$lib/game/storage'
import { toAxialCoord } from '$lib/utils'
import { subject } from '../scripts'
import { DurationStep } from '../steps'

export interface TransferPlan<T extends AllocationBase = AllocationBase> {
	readonly description: 'grab' | 'drop'
	vehicleAllocation?: T // Will be created in begin(), cleared in finalize()
	allocation?: T // Will be created in begin(), cleared in finalize()
	readonly amount: number
	readonly source?: 'freeGoods' | 'storage'
	// Additional metadata needed for plan creation
	readonly goodType: GoodType
	readonly destination?: Tile | TileBorder
	readonly sourceTile?: Tile | TileBorder
}

class InventoryFunctions {
	declare [subject]: Character
	@contract(GoodType, 'number?')
	grab(goodType: GoodType, maxAmount: number = 1) {
		const character = this[subject]
		const {
			vehicle,
			tile: { content },
		} = character
		assert(content, 'tile.content must be set')
		assert(vehicle, 'tile.vehicle must be set')

		const canGrab = vehicle.hasRoom(goodType)
		const amount = Math.min(canGrab, maxAmount)

		if (amount <= 0) throw new Error('No goods to grab')
		const vehicleTransfer = vehicle.allocate(goodType, amount, `grab.${goodType}`)
		const tileTransfer = content.storage?.reserve(goodType, amount, `grab.${goodType}`)
		return new DurationStep(amount * vehicle.transferTime, 'convey', `grab.${goodType}`)
			.finished(() => {
				vehicleTransfer.fulfill()
				tileTransfer.fulfill()
			})
			.canceled(() => {
				vehicleTransfer.cancel()
				tileTransfer.cancel()
			})
	}

	@contract(GoodType, 'number?')
	dropAsFreeGood(goodType: GoodType, maxAmount: number = 1) {
		const character = this[subject]
		const { vehicle } = character
		assert(vehicle, 'tile.vehicle must be set')

		const available = vehicle.available(goodType) ?? 0
		let amount = Math.min(available, maxAmount)
		if (amount <= 0) throw new Error('No goods to drop')
		const vehicleTransfer = vehicle.reserve(goodType, amount, `drop.${goodType}`)
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
	@contract(GoodType, 'number', type.or(TileArkType, TileBorderArkType))
	planDrop(goodType: GoodType, quantity: number, destination: Tile | TileBorder) {
		const character = this[subject]
		const content = destination.content
		const vehicle = character.vehicle
		assert(vehicle, 'tile.vehicle must be set')
		assert(content, 'destination.content must be set')
		assert('storage' in content, 'planDrop only works with TileContent that has storage')

		const available = vehicle.available(goodType) ?? 0
		const canStore = content.storage?.hasRoom(goodType) || 0
		const amount = Math.min(available, canStore, quantity)
		if (amount <= 0) throw new Error('No goods to drop')

		// Return plan without allocations - they will be created in plan.begin()
		return {
			description: 'drop' as const,
			amount,
			goodType,
			destination,
		}
	}
	@contract(GoodType, 'number', type.or(TileArkType, TileBorderArkType))
	planGrabStored(goodType: GoodType, quantity: number, source: Tile | TileBorder) {
		const character = this[subject]
		const vehicle = character.vehicle
		assert(vehicle, 'tile.vehicle must be set')
		const content = source.content
		assert(content, 'source.content must be set')
		assert('storage' in content, 'planGrabStored only works with TileContent that has storage')

		const canGrab = vehicle.hasRoom(goodType)
		if (canGrab <= 0) throw new Error('No room in vehicle to grab goods')

		const available = content.storage?.available(goodType) ?? 0
		const amount = Math.min(canGrab, available, quantity)
		if (amount <= 0) throw new Error('No goods to grab from storage')

		// Return plan without allocations - they will be created in plan.begin()
		return {
			description: 'grab' as const,
			amount,
			source: 'storage',
			goodType,
			sourceTile: source,
		}
	}

	@contract(GoodType, type.or(TileArkType, TileBorderArkType))
	planGrabFree(goodType: GoodType, source: Tile | TileBorder): TransferPlan {
		const character = this[subject]
		const vehicle = character.vehicle
		assert(vehicle, 'tile.vehicle must be set')

		const canGrab = vehicle.hasRoom(goodType)
		if (canGrab <= 0) throw new Error('No room in vehicle to grab goods')

		// Check for FreeGoods on the tile - always grab exactly 1
		const coord = toAxialCoord(source.position)
		const freeGoods = character.game.hex.freeGoods.getGoodsAt(coord)
		const matchingFreeGoods = freeGoods.filter(
			(good) => good.goodType === goodType && !good.removed && !good.allocated,
		)

		if (matchingFreeGoods.length === 0) {
			debugger
			throw new Error('No FreeGoods to grab')
		}

		const amount = 1 // Always grab exactly 1 FreeGood

		// Return plan without allocations - they will be created in plan.begin()
		return {
			description: 'grab' as const,
			amount,
			source: 'freeGoods',
			goodType,
			sourceTile: source,
		}
	}
	@contract('object')
	effectuate(action: TransferPlan) {
		const character = this[subject]
		const { vehicleAllocation, amount, description } = action
		const {
			tile: { content },
			vehicle,
		} = character
		assert(content, 'tile.content must be set')
		assert(vehicle, 'tile.vehicle must be set')
		assert(vehicleAllocation, 'vehicleAllocation must be set - plan should be in begin() state')

		return new DurationStep(amount * vehicle.transferTime, 'convey', description)
	}
}

export { InventoryFunctions }
