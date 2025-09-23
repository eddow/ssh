import { computed, effect, ReactiveBase, reactive } from 'mutts'
import { ColorMatrixFilter, Container, Sprite } from 'pixi.js'
import { goods as goodsCatalog } from '$assets/game-content'
import type { GoodType } from '$lib/arktype'
import { assert } from '$lib/debug'
import {
	AllocationError,
	allocationEnded,
	guardAllocation,
	invalidateAllocation,
	isAllocationValid,
} from './guard'
import type { Storage } from './index'

export interface Slot {
	goodType: GoodType
	quantity: number
	allocated: number
	reserved: number
}

@reactive
export class SlottedStorage extends ReactiveBase implements Storage<number[]> {
	public slots: (Slot | undefined)[]

	constructor(
		public readonly maxSlots: number,
		public readonly maxQuantityPerSlot: number = 1,
	) {
		super()
		this.slots = Array(maxSlots).fill(undefined)
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

	allocate(goodType: GoodType, qty: number, reason: any): number[] {
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

		// Register GC guard
		guardAllocation(alloc, reason)
		return alloc
	}

	reserve(goodType: GoodType, qty: number, reason: any): number[] {
		assert(qty > 0, 'Cannot reserve non-positive quantity')
		const alloc: number[] = Array(this.slots.length).fill(0)
		let remaining = Math.min(qty, this.available(goodType))
		if (remaining <= 0)
			throw new AllocationError(`Insufficient goods to reserve ${qty} of ${goodType}`, reason)

		// Reserve removal from present goods
		for (let i = 0; i < this.slots.length && remaining > 0; i++) {
			const slot = this.slots[i]
			if (!slot || slot.goodType !== goodType) continue
			const freeRemovable = Math.max(0, slot.quantity - slot.reserved)
			if (freeRemovable <= 0) continue
			const take = Math.min(remaining, freeRemovable)
			slot.reserved += take
			alloc[i] -= take // negative marks removal reservation
			remaining -= take
		}

		// Register GC guard
		guardAllocation(alloc, reason)
		return alloc
	}

	fulfill(allocation: number[]): void {
		if (!isAllocationValid(allocation)) return
		allocationEnded(allocation)
		invalidateAllocation(allocation)
		for (let i = 0; i < allocation.length; i++) {
			const amount = allocation[i]
			if (amount === 0) continue
			const slot = this.slots[i]
			if (!slot) continue
			if (amount > 0) {
				const use = Math.min(amount, slot.allocated)
				const roomHere = this.maxQuantityPerSlot - slot.quantity
				const toPresent = Math.min(use, roomHere)
				slot.quantity += toPresent
				slot.allocated -= toPresent
				if (slot.quantity + slot.allocated === 0) this.slots[i] = undefined
			} else {
				const want = -amount
				const use = Math.min(want, slot.reserved, slot.quantity)
				slot.quantity -= use
				slot.reserved -= use
				if (slot.quantity + slot.allocated === 0) this.slots[i] = undefined
			}
		}
	}

	cancel(allocation: number[]): void {
		if (!isAllocationValid(allocation)) return
		allocationEnded(allocation)
		invalidateAllocation(allocation)
		for (let i = 0; i < allocation.length; i++) {
			const amount = allocation[i]
			if (amount === 0) continue
			const slot = this.slots[i]
			if (!slot) continue
			if (amount > 0) {
				const reduce = Math.min(amount, slot.allocated)
				slot.allocated -= reduce
				if (slot.quantity + slot.allocated === 0) this.slots[i] = undefined
			} else {
				const reduce = Math.min(-amount, slot.reserved)
				slot.reserved -= reduce
				// quantity unchanged on cancel of negative allocation
				if (slot.quantity + slot.allocated === 0) this.slots[i] = undefined
			}
		}
	}

	// presentAmount replaced by available()
	renderGoods(game: any, size: number) {
		const root = new Container()
		effect(() => {
			const sprites: Sprite[] = []
			const n = this.slots.length
			const [centerIndex, around] = n === 1 || n === 5 ? [0, n - 1] : [-1, n]
			for (let i = 0; i < n; i++) {
				const slot = this.slots[i]
				if (!slot || (slot.quantity === 0 && slot.allocated === 0 && slot.reserved === 0)) continue

				// Render present goods (normal colors) - one sprite per quantity
				for (let q = 0; q < slot.quantity; q++) {
					const sprite = new Sprite(game.getTexture(goodsCatalog[slot.goodType].sprites[0]))
					const spriteSize = size * 0.5
					const scale = Math.max(sprite.width, sprite.height) / spriteSize
					sprite.scale.set(1 / scale)
					sprite.anchor.set(0.5)
					let [x, y] = [0, 0]
					if (centerIndex !== i) {
						const angle = (i * 2 * Math.PI) / around
						const radius = size * 0.4
						x = Math.cos(angle) * radius
						y = Math.sin(angle) * radius
					}
					sprite.position.set(x, y)
					root.addChild(sprite)
					sprites.push(sprite)
				}

				// Render reserved goods (reddish tint) - one sprite per reserved quantity
				for (let r = 0; r < slot.reserved; r++) {
					const sprite = new Sprite(game.getTexture(goodsCatalog[slot.goodType].sprites[0]))
					const spriteSize = size * 0.5
					const scale = Math.max(sprite.width, sprite.height) / spriteSize
					sprite.scale.set(1 / scale)
					sprite.anchor.set(0.5)
					// Apply reddish tint
					sprite.tint = 0xff6666 // Light red tint
					let [x, y] = [0, 0]
					if (centerIndex !== i) {
						const angle = (i * 2 * Math.PI) / around
						const radius = size * 0.4
						x = Math.cos(angle) * radius
						y = Math.sin(angle) * radius
					}
					sprite.position.set(x, y)
					root.addChild(sprite)
					sprites.push(sprite)
				}

				// Render allocated goods (black & white) - one sprite per allocated quantity
				for (let a = 0; a < slot.allocated; a++) {
					const sprite = new Sprite(game.getTexture(goodsCatalog[slot.goodType].sprites[0]))
					const spriteSize = size * 0.5
					const scale = Math.max(sprite.width, sprite.height) / spriteSize
					sprite.scale.set(1 / scale)
					sprite.anchor.set(0.5)
					// Apply grayscale filter (black & white)
					const grayscaleFilter = new ColorMatrixFilter()
					grayscaleFilter.desaturate()
					sprite.filters = [grayscaleFilter]
					let [x, y] = [0, 0]
					if (centerIndex !== i) {
						const angle = (i * 2 * Math.PI) / around
						const radius = size * 0.4
						x = Math.cos(angle) * radius
						y = Math.sin(angle) * radius
					}
					sprite.position.set(x, y)
					root.addChild(sprite)
					sprites.push(sprite)
				}
			}
			return () => {
				for (const s of sprites) s.destroy()
			}
		})
		return root
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
				allocated: slot?.allocated || 0,
				reserved: slot?.reserved || 0,
			})),
		}
	}
}
