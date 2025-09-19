import { computed, reactive, ReactiveBase } from 'mutts'
import type { GoodType } from '$lib/arktype'
import type { Storage } from './index'

export class SpecificStorage extends ReactiveBase implements Storage {
	private _goods: { [k in GoodType]?: number } = {}
	public readonly maxAmounts: { [k in GoodType]?: number }

	constructor(maxAmounts: { [k in GoodType]?: number }) {
		super()
		this.maxAmounts = { ...maxAmounts }
	}

	canStoreGood(goodType: GoodType): number {
		const maxAmount = this.maxAmounts[goodType] || 0
		const currentAmount = this._goods[goodType] || 0
		return Math.max(0, maxAmount - currentAmount)
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


	get debugInfo(): Record<string, any> {
		return {
			type: 'SpecificStorage',
			maxAmounts: this.maxAmounts,
			currentGoods: this.goods,
		}
	}
}
