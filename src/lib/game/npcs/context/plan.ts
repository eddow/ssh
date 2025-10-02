import { contract } from '$lib/arktype'
import { assert } from '$lib/debug'
import type { Character } from '$lib/game/population/character'
import { toAxialCoord } from '$lib/utils'
import { subject } from '../scripts'
import type { TransferPlan } from './inventory'

class PlanFunctions {
	declare [subject]: Character

	@contract('object')
	begin(transferPlan: TransferPlan) {
		// Begin the transfer plan - create the allocations
		const character = this[subject]
		const { goodType, amount, description, destination, sourceTile, source } = transferPlan
		const vehicle = character.vehicle

		assert(vehicle, 'vehicle must be set')

		// Create allocations based on plan type
		let vehicleAllocation: any
		let allocation: any

		if (description === 'drop') {
			// Drop plan: allocate vehicle space and destination storage
			assert(destination, 'destination must be set for drop plan')
			const content = destination.content
			assert(content, 'destination.content must be set')
			assert('storage' in content, 'planDrop only works with TileContent that has storage')

			vehicleAllocation = vehicle.reserve(goodType, amount, `planDrop.${goodType}`)
			allocation = content.storage?.allocate(goodType, amount, `planDrop.${goodType}`)
		} else if (description === 'grab') {
			// Grab plan: allocate vehicle space and reserve source
			vehicleAllocation = vehicle.allocate(goodType, amount, `planGrab.${goodType}`)

			if (source === 'storage') {
				assert(sourceTile, 'sourceTile must be set for storage grab')
				const content = sourceTile.content
				assert(content, 'sourceTile.content must be set')
				assert('storage' in content, 'planGrabStored only works with TileContent that has storage')

				allocation = content.storage?.reserve(goodType, amount, `planGrabStored.${goodType}`)
			} else if (source === 'freeGoods') {
				assert(sourceTile, 'sourceTile must be set for free goods grab')

				// Find and allocate the free good
				const coord = toAxialCoord(sourceTile.position)
				const freeGoods = character.game.hex.freeGoods.getGoodsAt(coord)
				const matchingFreeGoods = freeGoods.filter(
					(good) => good.goodType === goodType && !good.removed && !good.allocated,
				)

				if (matchingFreeGoods.length === 0) {
					throw new Error('No FreeGoods to grab')
				}

				const freeGoodToGrab = matchingFreeGoods[0]
				allocation = freeGoodToGrab.allocate(`planGrabFree.${goodType}`)
			}
		}

		// Return the plan with allocations set
		Object.assign(transferPlan, {
			vehicleAllocation,
			allocation,
		})
	}

	@contract('object')
	conclude(transferPlan: TransferPlan) {
		// Conclude the transfer plan - complete the transfer successfully

		// Fulfill the allocations
		transferPlan.allocation?.fulfill()
		transferPlan.vehicleAllocation?.fulfill()

		return transferPlan
	}

	@contract('object')
	cancel(transferPlan: TransferPlan) {
		// Cancel the transfer plan - abort the transfer

		// Cancel the allocations
		transferPlan.allocation?.cancel()
		transferPlan.vehicleAllocation?.cancel()
	}

	@contract('object')
	finalize(transferPlan: TransferPlan) {
		// Finalize the transfer plan - cleanup after completion or cancellation

		// Clear allocations back to undefined
		delete transferPlan.vehicleAllocation
		delete transferPlan.allocation
	}
}

export { PlanFunctions }
