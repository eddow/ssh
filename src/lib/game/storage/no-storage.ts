import { computed } from 'mutts/src'
import type { GoodType } from '$lib/arktype'
import type { Goods } from '.'
import type { RenderedGoodSlots } from './goods-renderer'
import { AllocationError } from './guard'
import { Storage } from './storage'

export class NoStorage extends Storage<any> {
	hasRoom(_goodType?: GoodType): number {
		return 0
	}

	get allocatedSlots(): boolean {
		return false
	}

	addGood(_goodType: GoodType, _qty: number): number {
		return 0
	}

	removeGood(_goodType: GoodType, _qty: number): number {
		return 0
	}

	@computed
	get stock(): { [k in GoodType]?: number } {
		return {}
	}

	available(_goodType: GoodType): number {
		return 0
	}

	allocate(_goodType: GoodType, qty: number, reason: any): never {
		throw new AllocationError(
			`Cannot allocate ${qty} of ${_goodType} - no storage available`,
			reason,
		)
	}

	reserve(_goodType: GoodType, qty: number, reason: any): never {
		throw new AllocationError(
			`Cannot reserve ${qty} of ${_goodType} - no storage available`,
			reason,
		)
	}

	renderedGoods(): RenderedGoodSlots {
		return { slots: [] }
	}

	get debugInfo(): Record<string, any> {
		return {
			type: 'NoStorage',
		}
	}
	canStoreAll(_goods: Goods): boolean {
		return false
	}
}

export const noStorage = new NoStorage()
