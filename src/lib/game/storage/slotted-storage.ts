import { computed, reactive, ReactiveBase } from 'mutts'
import type { GoodType } from '$lib/arktype'
import type { Storage } from './index'

export interface Slot {
	goodType: GoodType
	quantity: number
}

export class SlottedStorage extends ReactiveBase implements Storage {
	public slots: (Slot | undefined)[]

	constructor(
		public readonly maxSlots: number,
		public readonly maxQuantityPerSlot: number = 1,
	) {
		super()
		this.slots = Array(maxSlots).fill(undefined)
	}

	canStoreGood(goodType?: GoodType): number {
		let totalCapacity = 0
		
		// Check existing slots with the same good type
		for (const slot of this.slots) {
			if (slot?.goodType === goodType) {
				totalCapacity += this.maxQuantityPerSlot - (slot?.quantity ?? 0)
			}
		}
		
		// Check empty slots
		const emptySlots = this.slots.filter(slot => slot === undefined).length
		totalCapacity += emptySlots * this.maxQuantityPerSlot
		
		return totalCapacity
	}

	addGood(goodType: GoodType, qty: number): number {
		let remaining = qty
		
		// First, try to fill existing slots with the same good type
		for (let i = 0; i < this.slots.length; i++) {
			if (remaining <= 0) break
			const slot = this.slots[i]
			if (slot && slot.goodType === goodType && slot.quantity < this.maxQuantityPerSlot) {
				const canAdd = Math.min(remaining, this.maxQuantityPerSlot - slot.quantity)
				slot.quantity += canAdd
				remaining -= canAdd
			}
		}
		
		// Then, try to fill empty slots
		for (let i = 0; i < this.slots.length; i++) {
			if (remaining <= 0) break
			if (this.slots[i] === undefined) {
				const canAdd = Math.min(remaining, this.maxQuantityPerSlot)
				this.slots[i] = { goodType, quantity: canAdd }
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
				const canRemove = Math.min(remaining, slot.quantity)
				slot.quantity -= canRemove
				remaining -= canRemove
				
				// Clear slot if empty
				if (slot.quantity === 0) {
					this.slots[i] = undefined
				}
			}
		}
		
		return qty - remaining
	}

	@computed
	get goods(): { [k in GoodType]?: number } {
		const result: { [k in GoodType]?: number } = {}
		
		for (const slot of this.slots) {
			if (slot && slot.quantity > 0) {
				result[slot.goodType] = (result[slot.goodType] || 0) + slot.quantity
			}
		}
		
		return result
	}


	get debugInfo(): Record<string, any> {
		return {
			type: 'SlottedStorage',
			maxSlots: this.maxSlots,
			maxQuantityPerSlot: this.maxQuantityPerSlot,
			slots: this.slots.map((slot, index) => ({
				index,
				goodType: slot?.goodType,
				quantity: slot?.quantity || 0,
			})),
		}
	}
}
