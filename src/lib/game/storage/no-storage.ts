import { computed, reactive } from 'mutts'
import type { GoodType } from '$lib/arktype'
import type { Storage } from './index'

export class NoStorage implements Storage {
	canStoreGood(_goodType?: GoodType): number {
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


	get debugInfo(): Record<string, any> {
		return {
			type: 'NoStorage',
		}
	}
}
