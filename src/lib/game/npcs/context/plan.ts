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

// Plan handler interface
interface PlanHandler<T extends Plan> {
	begin(plan: T, character: Character): void
	conclude?(plan: T, character: Character): void
	cancel?(plan: T, character: Character): void
	finally?(plan: T, character: Character): void
}

// Transfer plan handler
const transferPlanHandler: PlanHandler<TransferPlan> = {
	begin(plan: TransferPlan, character: Character) {
		const hex = character.game.hex
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

		// Set allocations on the plan
		Object.assign(plan, {
			vehicleAllocation,
			allocation,
		})
	},

	conclude(plan: TransferPlan, _character: Character) {
		// Fulfill the allocations
		plan.allocation?.fulfill()
		plan.vehicleAllocation?.fulfill()
	},

	cancel(plan: TransferPlan, _character: Character) {
		// Cancel the allocations
		plan.allocation?.cancel()
		plan.vehicleAllocation?.cancel()
	},

	finally(plan: TransferPlan, _character: Character) {
		// Clear allocations back to undefined
		delete plan.vehicleAllocation
		delete plan.allocation
	},
}

// Pickup plan handler
const pickupPlanHandler: PlanHandler<PickupPlan> = {
	begin(plan: PickupPlan, character: Character) {
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
			if (freeGoodToGrab.isRemoved) character.cancelPlan(plan)
		})

		// Set allocations on the plan
		Object.assign(plan, {
			vehicleAllocation,
			allocation,
		})
	},

	conclude(plan: PickupPlan, _character: Character) {
		// Fulfill the allocations
		plan.allocation?.fulfill()
		plan.vehicleAllocation?.fulfill()
	},

	cancel(plan: PickupPlan, _character: Character) {
		// Cancel the allocations
		plan.allocation?.cancel()
		plan.vehicleAllocation?.cancel()
	},

	finally(plan: PickupPlan, _character: Character) {
		// Clear allocations back to undefined
		delete plan.vehicleAllocation
		delete plan.allocation
		plan.releaseStopper?.()
	},
}

// Work plan handler
const workPlanHandler: PlanHandler<WorkPlan> = {
	begin(plan: WorkPlan, character: Character) {
		const { alveolus } = plan

		// Assign worker to alveolus
		alveolus.assignedWorker = character
		character.assignedAlveolus = alveolus

		// Set the assigned worker in the plan
		Object.assign(plan, {
			assignedWorker: character,
		})
	},

	finally(plan: WorkPlan, character: Character) {
		plan.alveolus.assignedWorker = undefined
		character.assignedAlveolus = undefined
	},
}

// Handler registry
const planHandlers: Record<Plan['type'], PlanHandler<any>> = {
	transfer: transferPlanHandler,
	pickup: pickupPlanHandler,
	work: workPlanHandler,
}

class PlanFunctions {
	declare [subject]: Character

	@contract('object')
	begin(plan: Plan) {
		planHandlers[plan.type].begin(plan, this[subject])
	}

	@contract('object')
	conclude(plan: Plan) {
		if ('releaseStopper' in plan) plan.releaseStopper?.()
		planHandlers[plan.type].conclude?.(plan, this[subject])
	}

	@contract('object')
	cancel(plan: Plan) {
		planHandlers[plan.type].cancel?.(plan, this[subject])
	}

	@contract('object')
	finally(plan: Plan) {
		planHandlers[plan.type].finally?.(plan, this[subject])
		if ('releaseStopper' in plan) plan.releaseStopper?.()
	}
}

export { PlanFunctions }
