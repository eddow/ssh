import type { GoodType } from '$lib/arktype'
import { Alveolus } from '../board'

export class TransitAlveolus extends Alveolus {
	poke(): void {
		const stock = this.storage.stock
		for (const goodType of Object.keys(stock) as GoodType[])
			if (stock[goodType]) this.hive.provide(goodType, this)
	}
}
