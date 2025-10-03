import { effect } from 'mutts/src'
import { contract, type Goods, type GoodType } from '$lib/arktype'
import { assert } from '$lib/debug'
import { type Alveolus, type HexBoard, isTileCoord } from '$lib/game/board'
import type { Character } from '$lib/game/population/character'
import type { AllocationBase } from '$lib/game/storage'
import { type AxialCoord, type Positioned, toAxialCoord } from '$lib/utils'
import { subject } from '../scripts'
// plans should be unreactive
export interface TransferPlan<T extends AllocationBase = AllocationBase> {
	readonly type: 'transfer'
	readonly description: 'grab' | 'drop'
	vehicleAllocation?: T // Will be created in begin(), cleared in finalize()
	allocation?: T // Will be created in begin(), cleared in finalize()
	readonly goods: Goods
	// Additional metadata needed for plan creation
	readonly target?: Positioned
}

export interface PickupPlan<T extends AllocationBase = AllocationBase> {
	readonly type: 'pickup'
	vehicleAllocation?: T // Will be created in begin(), cleared in finalize()
	allocation?: T // Will be created in begin(), cleared in finalize()
	readonly goodType: GoodType
	readonly target: Positioned
	releaseStopper?: () => void
}

export interface WorkPlan {
	readonly type: 'work'
	readonly jobType: string
	readonly alveolus: Alveolus
	readonly path: AxialCoord[]
}

function getContentFromPosition(hex: HexBoard, position: Positioned) {
	const coord = toAxialCoord(position)
	return isTileCoord(coord) ? hex.getTileContent(coord) : hex.getBorderContent(coord)
}
export type Plan = TransferPlan | PickupPlan | WorkPlan
class PlanFunctions {
	declare [subject]: Character

	@contract('object')
	begin(plan: Plan) {
		const character = this[subject]
		const hex = character.game.hex

		if (plan.type === 'transfer') {
			// Begin the transfer plan - create the allocations
			const { goods, description, target } = plan
			const vehicle = character.vehicle

			assert(vehicle, 'vehicle must be set')

			// Create allocations based on plan type
			let vehicleAllocation: any
			let allocation: any

			if (description === 'drop') {
				// Drop plan: allocate vehicle space and destination storage
				assert(target, 'target must be set for drop plan')
				const content = getContentFromPosition(hex, target)
				assert(content, 'target content must be set')
				assert('storage' in content, 'planDropStored only works with TileContent that has storage')

				vehicleAllocation = vehicle.reserve(goods, `planDropStored`)
				allocation = content.storage?.allocate(goods, `planDropStored`)
			} else if (description === 'grab') {
				// Grab plan: allocate vehicle space and reserve source storage
				assert(target, 'target must be set for storage grab')
				const content = getContentFromPosition(hex, target)
				assert(content, 'target content must be set')
				assert('storage' in content, 'planGrabStored only works with TileContent that has storage')

				vehicleAllocation = vehicle.allocate(goods, `planGrab`)
				allocation = content.storage?.reserve(goods, `planGrabStored`)
			}

			// Return the plan with allocations set
			Object.assign(plan, {
				vehicleAllocation,
				allocation,
			})
		} else if (plan.type === 'pickup') {
			// Begin the gather plan - create the allocations
			const { goodType, target } = plan
			const vehicle = character.vehicle

			assert(vehicle, 'vehicle must be set')

			// Find and allocate the free good
			const coord = toAxialCoord(target)
			const freeGoods = character.game.hex.freeGoods.getGoodsAt(coord)
			const matchingFreeGoods = freeGoods.filter(
				(good) => good.goodType === goodType && !good.allocated,
			)

			if (matchingFreeGoods.length === 0) {
				throw new Error(`No FreeGoods to grab for ${goodType}`)
			}

			const freeGoodToGrab = matchingFreeGoods[0]
			const vehicleAllocation = vehicle.allocate({ [goodType]: 1 }, `planGrabFree.${goodType}`)
			const allocation = freeGoodToGrab.allocate(`planGrabFree.${goodType}`)
			plan.releaseStopper = effect(() => {
				if (freeGoodToGrab.removed) this[subject].cancelPlan(plan)
			})
			// Return the plan with allocations set
			Object.assign(plan, {
				vehicleAllocation,
				allocation,
			})
		} else if (plan.type === 'work') {
			// Begin the work plan - assign worker and alveolus
			const { alveolus } = plan

			// Assign worker to alveolus
			alveolus.assignedWorker = character
			character.assignedAlveolus = alveolus

			// Set the assigned worker in the plan
			Object.assign(plan, {
				assignedWorker: character,
			})
		}

		return plan
	}

	@contract('object')
	conclude(plan: Plan) {
		if ('releaseStopper' in plan) plan.releaseStopper?.()
		if (plan.type === 'transfer' || plan.type === 'pickup') {
			// Fulfill the allocations
			plan.allocation?.fulfill()
			plan.vehicleAllocation?.fulfill()
		}

		return plan
	}

	@contract('object')
	cancel(plan: Plan) {
		if (plan.type === 'transfer' || plan.type === 'pickup') {
			// Cancel the allocations
			plan.allocation?.cancel()
			plan.vehicleAllocation?.cancel()
		}

		return plan
	}

	@contract('object')
	finally(plan: Plan) {
		if (plan.type === 'transfer' || plan.type === 'pickup') {
			// Clear allocations back to undefined
			delete plan.vehicleAllocation
			delete plan.allocation
		} else if (plan.type === 'work') {
			plan.alveolus.assignedWorker = undefined
			this[subject].assignedAlveolus = undefined
		}
		if ('releaseStopper' in plan) plan.releaseStopper?.()
	}
}

export { PlanFunctions }
