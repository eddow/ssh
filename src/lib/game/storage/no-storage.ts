import { computed } from 'mutts'
import { Container } from 'pixi.js'
import type { GoodType } from '$lib/arktype'
import type { Storage } from './index'
import { AllocationError } from './guard'

export class NoStorage implements Storage<never> {
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
	get goods(): { [k in GoodType]?: number } {
		return {}
	}

	allocate(_goodType: GoodType, qty: number, reason: any): never {
		throw new AllocationError(`Cannot allocate ${qty} of ${_goodType} - no storage available`, reason)
	}

	reserve(_goodType: GoodType, qty: number, reason: any): never {
		throw new AllocationError(`Cannot reserve ${qty} of ${_goodType} - no storage available`, reason)
	}
	fulfill(_allocation: never): void {
		/* noop */
	}
	cancel(_allocation: never): void {
		/* noop */
	}

	renderGoods(_game: any, _size: number) {
		return new Container()
	}

	get debugInfo(): Record<string, any> {
		return {
			type: 'NoStorage',
		}
	}
}
