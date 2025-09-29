import { computed, reactive, unreactive } from 'mutts/src'
import type { GoodType } from '$lib/arktype'
import { assert } from '$lib/debug'
import type { RenderedGoodSlot, RenderedGoodSlots } from './goods-renderer'
import {
	AllocationError,
	allocationEnded,
	guardAllocation,
	invalidateAllocation,
	isAllocationValid,
} from './guard'
import type { Goods } from './index'
import { type AllocationBase, Storage } from './storage'

@unreactive
class SlottedAllocation implements AllocationBase {
	constructor(
		private storage: SlottedStorage,
		public readonly allocation: number[],
		reason: any,
	) {
		guardAllocation(this, reason)
	}

	cancel(): void {
		if (!isAllocationValid(this)) return
		allocationEnded(this)
		invalidateAllocation(this)
		for (let i = 0; i < this.allocation.length; i++) {
			const amount = this.allocation[i]
			if (amount === 0) continue
			const slot = this.storage.slots[i]
			if (!slot) continue
			if (amount > 0) {
				const reduce = Math.min(amount, slot.allocated)
				slot.allocated -= reduce
				if (slot.quantity + slot.allocated === 0) this.storage.slots[i] = undefined
			} else {
				const reduce = Math.min(-amount, slot.reserved)
				slot.reserved -= reduce
				// quantity unchanged on cancel of negative allocation
				if (slot.quantity + slot.allocated === 0) this.storage.slots[i] = undefined
			}
		}
	}

	fulfill(): void {
		if (!isAllocationValid(this)) return
		allocationEnded(this)
		invalidateAllocation(this)
		for (let i = 0; i < this.allocation.length; i++) {
			const amount = this.allocation[i]
			if (amount === 0) continue
			const slot = this.storage.slots[i]
			if (!slot) continue
			if (amount > 0) {
				const use = Math.min(amount, slot.allocated)
				const roomHere = this.storage.maxQuantityPerSlot - slot.quantity
				const toPresent = Math.min(use, roomHere)
				slot.quantity += toPresent
				slot.allocated -= toPresent
				if (slot.quantity + slot.allocated === 0) this.storage.slots[i] = undefined
			} else {
				const want = -amount
				const use = Math.min(want, slot.reserved, slot.quantity)
				slot.quantity -= use
				slot.reserved -= use
				if (slot.quantity + slot.allocated === 0) this.storage.slots[i] = undefined
			}
		}
	}
}

export interface Slot {
	goodType: GoodType
	quantity: number
	allocated: number
	reserved: number
}

export class SlottedStorage extends Storage<SlottedAllocation> {
	public slots: (Slot | undefined)[]

	constructor(
		maxSlots: number,
		public readonly maxQuantityPerSlot: number = 1,
	) {
		super()
		this.slots = reactive(Array(maxSlots).fill(undefined))
	}

	hasRoom(goodType?: GoodType): number {
		let totalCapacity = 0
		for (const slot of this.slots) {
			if (!slot) {
				totalCapacity += this.maxQuantityPerSlot
				continue
			}
			if (!goodType || slot.goodType === goodType) {
				const freeInSlot = this.maxQuantityPerSlot - slot.quantity - slot.allocated
				totalCapacity += Math.max(0, freeInSlot)
			}
		}
		return totalCapacity
	}

	addGood(goodType: GoodType, qty: number): number {
		let remaining = qty

		// First, try to fill existing slots with the same good type
		for (let i = 0; i < this.slots.length; i++) {
			if (remaining <= 0) break
			const slot = this.slots[i]
			if (slot && slot.goodType === goodType && slot.quantity < this.maxQuantityPerSlot) {
				const free = this.maxQuantityPerSlot - slot.quantity
				const canAdd = Math.min(remaining, free)
				slot.quantity += canAdd
				remaining -= canAdd
			}
		}

		// Then, try to fill empty slots
		for (let i = 0; i < this.slots.length; i++) {
			if (remaining <= 0) break
			if (this.slots[i] === undefined) {
				const canAdd = Math.min(remaining, this.maxQuantityPerSlot)
				this.slots[i] = { goodType, quantity: canAdd, allocated: 0, reserved: 0 }
				remaining -= canAdd
			}
		}

		return qty - remaining
	}

	removeGood(goodType: GoodType, qty: number): number {
		let remaining = qty

		// Remove from slots containing this good type
		for (let i = 0; i < this.slots.length; i++) {
			if (remaining <= 0) break
			const slot = this.slots[i]
			if (slot && slot.goodType === goodType) {
				const canRemove = Math.min(remaining, Math.max(0, slot.quantity - slot.reserved))
				slot.quantity -= canRemove
				remaining -= canRemove

				// Clear slot if empty
				if (slot.quantity + slot.allocated === 0) this.slots[i] = undefined
			}
		}

		return qty - remaining
	}

	@computed
	get stock(): { [k in GoodType]?: number } {
		const result: { [k in GoodType]?: number } = {}

		for (const slot of this.slots) {
			if (slot && slot.quantity > 0) {
				result[slot.goodType] = (result[slot.goodType] || 0) + slot.quantity
			}
		}

		return result
	}

	available(goodType: GoodType): number {
		let total = 0
		for (const slot of this.slots) {
			if (slot?.goodType === goodType) total += Math.max(0, slot.quantity - slot.reserved)
		}
		return total
	}

	allocate(goodType: GoodType, qty: number, reason: any): SlottedAllocation {
		assert(qty > 0, 'Cannot allocate non-positive quantity')
		const alloc: number[] = Array(this.slots.length).fill(0)
		let remaining = Math.min(qty, this.hasRoom(goodType))
		if (remaining <= 0)
			throw new AllocationError(`Insufficient room to allocate ${qty} of ${goodType}`, reason)

		// Allocate in existing slots first
		for (let i = 0; i < this.slots.length && remaining > 0; i++) {
			const slot = this.slots[i]
			if (!slot || slot.goodType !== goodType) continue
			const free = this.maxQuantityPerSlot - slot.quantity - slot.allocated
			if (free <= 0) continue
			const take = Math.min(remaining, free)
			slot.allocated += take
			alloc[i] += take
			remaining -= take
		}

		// Allocate in empty slots
		for (let i = 0; i < this.slots.length && remaining > 0; i++) {
			if (this.slots[i] !== undefined) continue
			const take = Math.min(remaining, this.maxQuantityPerSlot)
			this.slots[i] = { goodType, quantity: 0, allocated: take, reserved: 0 }
			alloc[i] += take
			remaining -= take
		}

		return new SlottedAllocation(this, alloc, reason)
	}

	reserve(goodType: GoodType, qty: number, reason: any): SlottedAllocation {
		assert(qty > 0, 'Cannot reserve non-positive quantity')
		const alloc: number[] = Array(this.slots.length).fill(0)
		let remaining = Math.min(qty, this.available(goodType))
		if (remaining <= 0)
			throw new AllocationError(`Insufficient goods to reserve ${qty} of ${goodType}`, reason)

		// Reserve goods that are present but not yet reserved
		for (let i = 0; i < this.slots.length && remaining > 0; i++) {
			const slot = this.slots[i]
			if (!slot || slot.goodType !== goodType) continue
			const freeReservable = Math.max(0, slot.quantity - slot.reserved)
			if (freeReservable <= 0) continue
			const take = Math.min(remaining, freeReservable)
			slot.reserved += take
			alloc[i] -= take // negative marks reservation
			remaining -= take
		}

		return new SlottedAllocation(this, alloc, reason)
	}

	canStoreAll(_goods: Goods): boolean {
		// Prepare remaining requirements per good type
		const remaining: { [k: string]: number } = {}
		for (const [t, q] of Object.entries(_goods)) {
			if (!q || q <= 0) continue
			remaining[t] = q
		}

		// Try to fit into existing slots of the same type first; count empty slots
		let emptySlots = 0
		for (const slot of this.slots) {
			if (!slot) {
				emptySlots++
				continue
			}
			const key = String(slot.goodType)
			const need = remaining[key] || 0
			if (need <= 0) continue
			const freeHere = Math.max(0, this.maxQuantityPerSlot - slot.quantity - slot.allocated)
			if (freeHere <= 0) continue
			const used = Math.min(need, freeHere)
			remaining[key] = need - used
		}

		const slotsNeeded = Object.values(remaining)
			.map((q) => Math.ceil(q / this.maxQuantityPerSlot))
			.reduce((acc, q) => acc + q, 0)
		return slotsNeeded <= emptySlots
	}

	// presentAmount replaced by available()
	renderedGoods(): RenderedGoodSlots {
		const slots: RenderedGoodSlot[] = []
		for (const slot of this.slots) {
			if (!slot) continue
			slots.push({
				goodType: slot.goodType,
				present: Math.max(0, slot.quantity - slot.reserved),
				reserved: Math.max(0, slot.reserved),
				allocated: Math.max(0, slot.allocated),
				allowed: this.maxQuantityPerSlot,
			})
		}
		return { slots, assumedMaxSlots: this.slots.length }
	}

	get debugInfo(): Record<string, any> {
		return {
			type: 'SlottedStorage',
			maxSlots: this.slots.length,
			maxQuantityPerSlot: this.maxQuantityPerSlot,
			slots: this.slots.map((slot, index) => ({
				index,
				goodType: slot?.goodType,
				quantity: slot?.quantity || 0,
				allocated: slot?.allocated || 0,
				reserved: slot?.reserved || 0,
			})),
		}
	}
}
