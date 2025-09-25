import { computed, reactive } from 'mutts'
import { GoodType } from '$lib/arktype'
import { assert } from '$lib/debug'
import type { RenderedGoodSlot } from './goods-renderer'
import {
	AllocationError,
	allocationEnded,
	guardAllocation,
	invalidateAllocation,
	isAllocationValid,
} from './guard'
import type { Goods, RenderedGoodSlots } from './index'
import { type AllocationBase, Storage } from './storage'

class SpecificAllocation implements AllocationBase {
	constructor(
		private storage: SpecificStorage,
		public readonly goodType: GoodType,
		public readonly qty: number,
		reason: any,
	) {
		guardAllocation(this, reason)
	}

	cancel(): void {
		if (!isAllocationValid(this)) return
		allocationEnded(this)
		invalidateAllocation(this)
		const { goodType, qty } = this
		if (qty > 0) {
			const curAlloc = this.storage._allocated[goodType] || 0
			this.storage._allocated[goodType] = Math.max(0, curAlloc - qty)
		} else if (qty < 0) {
			const curRes = this.storage._reserved[goodType] || 0
			this.storage._reserved[goodType] = Math.max(0, curRes + qty)
		}
	}

	fulfill(): void {
		if (!isAllocationValid(this)) return
		allocationEnded(this)
		invalidateAllocation(this)
		const { goodType, qty } = this
		if (qty > 0) {
			const curAlloc = this.storage._allocated[goodType] || 0
			const use = Math.min(qty, curAlloc)
			if (use <= 0) return
			this.storage._allocated[goodType] = curAlloc - use
			this.storage._goods[goodType] = (this.storage._goods[goodType] || 0) + use
		} else if (qty < 0) {
			const want = -qty
			const curRes = this.storage._reserved[goodType] || 0
			const use = Math.min(want, curRes, this.storage._goods[goodType] || 0)
			if (use <= 0) return
			this.storage._reserved[goodType] = curRes - use
			this.storage._goods[goodType] = Math.max(0, (this.storage._goods[goodType] || 0) - use)
		}
	}
}

@reactive
export class SpecificStorage extends Storage<SpecificAllocation> {
	public readonly _goods: { [k in GoodType]?: number } = {}
	public readonly _allocated: { [k in GoodType]?: number } = {}
	public readonly _reserved: { [k in GoodType]?: number } = {}
	public readonly maxAmounts: { [k in GoodType]?: number }

	constructor(maxAmounts: { [k in GoodType]?: number }) {
		super()
		this.maxAmounts = { ...maxAmounts }
	}

	canStoreAll(goods: Goods): boolean {
		return Object.entries(goods).every(
			([goodType, qty]) => this.hasRoom(goodType as GoodType) >= qty,
		)
	}
	hasRoom(goodType: GoodType): number {
		const maxAmount = this.maxAmounts[goodType] || 0
		const currentAmount = this._goods[goodType] || 0
		const allocated = this._allocated[goodType] || 0
		return Math.max(0, maxAmount - currentAmount - allocated)
	}

	addGood(goodType: GoodType, qty: number): number {
		const maxAmount = this.maxAmounts[goodType] || 0
		const currentAmount = this._goods[goodType] || 0
		const canStore = Math.max(0, maxAmount - currentAmount)
		const toStore = Math.min(qty, canStore)

		if (toStore > 0) {
			this._goods[goodType] = currentAmount + toStore
		}

		return toStore
	}

	removeGood(goodType: GoodType, qty: number): number {
		const currentAmount = this._goods[goodType] || 0
		const toRemove = Math.min(qty, currentAmount)

		if (toRemove > 0) {
			this._goods[goodType] = currentAmount - toRemove
			if (this._goods[goodType] === 0) {
				delete this._goods[goodType]
			}
		}

		return toRemove
	}

	@computed
	get stock(): { [k in GoodType]?: number } {
		return { ...this._goods }
	}

	available(goodType: GoodType): number {
		return Math.max(0, (this._goods[goodType] || 0) - (this._reserved[goodType] || 0))
	}

	renderedGoods(): RenderedGoodSlots {
		const slots: RenderedGoodSlot[] = []
		for (const [goodType, maxAmount] of Object.entries(this.maxAmounts)) {
			assert(GoodType.allows(goodType), 'Good type not found in goods')
			const present = (this._goods[goodType] || 0) - (this._reserved[goodType] || 0)
			const allocated = this._allocated[goodType] || 0
			const reserved = this._reserved[goodType] || 0
			const allowed = maxAmount
			slots.push({ goodType, present, allocated, reserved, allowed })
		}
		return { slots, assumedMaxSlots: Object.keys(this.maxAmounts).length }
	}

	allocate(goodType: GoodType, qty: number, reason: any): SpecificAllocation {
		assert(qty > 0, 'Cannot allocate non-positive quantity')
		const room = this.hasRoom(goodType)
		const take = Math.min(qty, room)
		if (take <= 0)
			throw new AllocationError(`Insufficient room to allocate ${qty} of ${goodType}`, reason)
		this._allocated[goodType] = (this._allocated[goodType] || 0) + take
		return new SpecificAllocation(this, goodType, take, reason)
	}

	reserve(goodType: GoodType, qty: number, reason: any): SpecificAllocation {
		assert(qty > 0, 'Cannot reserve non-positive quantity')
		const available = Math.max(0, (this._goods[goodType] || 0) - (this._reserved[goodType] || 0))
		const take = Math.min(qty, available)
		if (take <= 0)
			throw new AllocationError(`Insufficient goods to reserve ${qty} of ${goodType}`, reason)
		this._reserved[goodType] = (this._reserved[goodType] || 0) + take
		return new SpecificAllocation(this, goodType, -take, reason)
	}

	get debugInfo(): Record<string, any> {
		return {
			type: 'SpecificStorage',
			maxAmounts: this.maxAmounts,
			currentGoods: this.stock,
		}
	}
}
