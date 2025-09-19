import { computed, ReactiveBase, reactive } from 'mutts'
import { Container } from 'pixi.js'
import type { GoodType } from '$lib/arktype'
import { assert } from '$lib/debug'
import { AllocationError, allocationEnded, guardAllocation, invalidateAllocation, isAllocationValid } from './guard'
import type { Storage } from './index'

@reactive
export class SpecificStorage
	extends ReactiveBase
	implements Storage<{ goodType: GoodType; qty: number }>
{
	private _goods: { [k in GoodType]?: number } = {}
	private _allocated: { [k in GoodType]?: number } = {}
	private _reserved: { [k in GoodType]?: number } = {}
	public readonly maxAmounts: { [k in GoodType]?: number }

	constructor(maxAmounts: { [k in GoodType]?: number }) {
		super()
		this.maxAmounts = { ...maxAmounts }
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
	get goods(): { [k in GoodType]?: number } {
		return { ...this._goods }
	}

	renderGoods(_game: any, _size: number) {
		// No visual for specific storage for now: TODO
		return new Container()
	}

	allocate(goodType: GoodType, qty: number, reason: any): { goodType: GoodType; qty: number } {
		assert(qty > 0, 'Cannot allocate non-positive quantity')
		const room = this.hasRoom(goodType)
		const take = Math.min(qty, room)
		if (take <= 0)
			throw new AllocationError(`Insufficient room to allocate ${qty} of ${goodType}`, reason)
		this._allocated[goodType] = (this._allocated[goodType] || 0) + take
		const token = { goodType, qty: take }
		guardAllocation(token, reason)
		return token
	}

	reserve(goodType: GoodType, qty: number, reason: any): { goodType: GoodType; qty: number } {
		assert(qty > 0, 'Cannot reserve non-positive quantity')
		const available = Math.max(0, (this._goods[goodType] || 0) - (this._reserved[goodType] || 0))
		const take = Math.min(qty, available)
		if (take <= 0)
			throw new AllocationError(`Insufficient goods to reserve ${qty} of ${goodType}`, reason)
		this._reserved[goodType] = (this._reserved[goodType] || 0) + take
		const token = { goodType, qty: -take }
		guardAllocation(token, reason)
		return token
	}

	fulfill(allocation: { goodType: GoodType; qty: number }): void {
		if (!isAllocationValid(allocation)) return
		allocationEnded(allocation)
		invalidateAllocation(allocation)
		const { goodType, qty } = allocation
		if (qty > 0) {
			const curAlloc = this._allocated[goodType] || 0
			const use = Math.min(qty, curAlloc)
			if (use <= 0) return
			this._allocated[goodType] = curAlloc - use
			this._goods[goodType] = (this._goods[goodType] || 0) + use
		} else if (qty < 0) {
			const want = -qty
			const curRes = this._reserved[goodType] || 0
			const use = Math.min(want, curRes, this._goods[goodType] || 0)
			if (use <= 0) return
			this._reserved[goodType] = curRes - use
			this._goods[goodType] = Math.max(0, (this._goods[goodType] || 0) - use)
		}
	}

	cancel(allocation: { goodType: GoodType; qty: number }): void {
		if (!isAllocationValid(allocation)) return
		allocationEnded(allocation)
		invalidateAllocation(allocation)
		const { goodType, qty } = allocation
		if (qty > 0) {
			const curAlloc = this._allocated[goodType] || 0
			this._allocated[goodType] = Math.max(0, curAlloc - qty)
		} else if (qty < 0) {
			const curRes = this._reserved[goodType] || 0
			this._reserved[goodType] = Math.max(0, curRes + qty)
		}
	}

	get debugInfo(): Record<string, any> {
		return {
			type: 'SpecificStorage',
			maxAmounts: this.maxAmounts,
			currentGoods: this.goods,
		}
	}
}
