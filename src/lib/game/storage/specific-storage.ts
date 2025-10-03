import { computed, reactive, unreactive } from 'mutts/src'
import type { Goods } from '$lib/arktype'
import { GoodType } from '$lib/arktype'
import { assert } from '$lib/debug'
import type { RenderedGoodSlots } from '.'
import type { RenderedGoodSlot } from './goods-renderer'
import {
	AllocationError,
	allocationEnded,
	guardAllocation,
	invalidateAllocation,
	isAllocationValid,
} from './guard'
import { type AllocationBase, Storage } from './storage'

@unreactive
class SpecificAllocation implements AllocationBase {
	constructor(
		private storage: SpecificStorage,
		public readonly goods: Goods,
		reason: any,
	) {
		guardAllocation(this, reason)
	}

	cancel(): void {
		if (!isAllocationValid(this)) return
		allocationEnded(this)
		invalidateAllocation(this)

		for (const [goodType, qty] of Object.entries(this.goods) as [GoodType, number][]) {
			assert(qty, 'qty must be set')

			if (qty > 0) {
				const curAlloc = this.storage._allocated[goodType] || 0
				this.storage._allocated[goodType] = Math.max(0, curAlloc - qty)
			} else if (qty < 0) {
				const curRes = this.storage._reserved[goodType] || 0
				this.storage._reserved[goodType] = Math.max(0, curRes + qty)
			}
		}
	}

	fulfill(): void {
		if (!isAllocationValid(this)) return
		allocationEnded(this)
		invalidateAllocation(this)

		for (const [goodType, qty] of Object.entries(this.goods) as [GoodType, number][]) {
			assert(qty, 'qty must be set')

			if (qty > 0) {
				const curAlloc = this.storage._allocated[goodType] || 0
				const use = Math.min(qty, curAlloc)
				if (use <= 0) continue
				this.storage._allocated[goodType] = curAlloc - use
				this.storage._goods[goodType] = (this.storage._goods[goodType] || 0) + use
			} else if (qty < 0) {
				const want = -qty
				const curRes = this.storage._reserved[goodType] || 0
				const use = Math.min(want, curRes, this.storage._goods[goodType] || 0)
				if (use <= 0) continue
				this.storage._reserved[goodType] = curRes - use
				this.storage._goods[goodType] = Math.max(0, (this.storage._goods[goodType] || 0) - use)
			}
		}
	}
}

@reactive
export class SpecificStorage extends Storage<SpecificAllocation> {
	public readonly _goods: { [k in GoodType]?: number } = reactive({})
	public readonly _allocated: { [k in GoodType]?: number } = reactive({})
	public readonly _reserved: { [k in GoodType]?: number } = reactive({})
	public readonly maxAmounts: { [k in GoodType]?: number }

	constructor(maxAmounts: { [k in GoodType]?: number }) {
		super()
		this.maxAmounts = { ...maxAmounts }
	}

	get allocatedSlots(): boolean {
		return Object.values(this._allocated).some((qty) => qty > 0)
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

	get isEmpty(): boolean {
		return Object.values(this._goods).every((qty) => qty === 0)
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

	allocate(goods: Goods, reason: any): SpecificAllocation {
		const actualGoods: Goods = {}
		let hasAnyAllocation = false

		for (const [goodType, qty] of Object.entries(goods) as [GoodType, number][]) {
			if (!qty || qty <= 0) continue

			const room = this.hasRoom(goodType)
			const take = Math.min(qty, room)
			if (take > 0) {
				this._allocated[goodType] = (this._allocated[goodType] || 0) + take
				actualGoods[goodType] = take
				hasAnyAllocation = true
			}
		}

		if (!hasAnyAllocation) {
			throw new AllocationError(`Insufficient room to allocate any goods`, reason)
		}

		return new SpecificAllocation(this, actualGoods, reason)
	}

	reserve(goods: Goods, reason: any): SpecificAllocation {
		const actualGoods: Goods = {}
		let hasAnyReservation = false

		for (const [goodType, qty] of Object.entries(goods) as [GoodType, number][]) {
			if (!qty || qty <= 0) continue

			const available = Math.max(0, (this._goods[goodType] || 0) - (this._reserved[goodType] || 0))
			const take = Math.min(qty, available)
			if (take > 0) {
				this._reserved[goodType] = (this._reserved[goodType] || 0) + take
				actualGoods[goodType] = -take // Negative for reservations
				hasAnyReservation = true
			}
		}

		if (!hasAnyReservation) {
			throw new AllocationError(`Insufficient goods to reserve any goods`, reason)
		}

		return new SpecificAllocation(this, actualGoods, reason)
	}

	get debugInfo(): Record<string, any> {
		return {
			type: 'SpecificStorage',
			maxAmounts: this.maxAmounts,
			currentGoods: this.stock,
		}
	}
}
