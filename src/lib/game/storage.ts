import type { GoodType } from '$lib/arktype'

export interface Storage {
	/** Max quantity of this good type that can still be stored. */
	canStoreGood(goodType: GoodType): number
	/** Attempt to add qty, returns actually stored quantity. */
	addGood(goodType: GoodType, qty: number): number
	/** Attempt to remove qty, returns actually removed quantity. */
	removeGood(goodType: GoodType, qty: number): number
	get goods(): { [k in GoodType]?: number }
}
