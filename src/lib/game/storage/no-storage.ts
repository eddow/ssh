import { computed } from 'mutts'
import { Container } from 'pixi.js'
import type { GoodType } from '$lib/arktype'
import { AllocationError } from './guard'
import type { Goods } from './index'
import { Storage } from './storage'

class NoStorage extends Storage<never> {
	hasRoom(_goodType?: GoodType): number {
		return 0
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
	fulfill(_allocation: never): void {
		/* noop - allocations are never created for NoStorage */
	}
	cancel(_allocation: never): void {
		/* noop - allocations are never created for NoStorage */
	}

	renderGoods(_game: any, _size: number) {
		return new Container()
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
