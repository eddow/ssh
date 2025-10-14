import { traces } from '$lib/debug'
import type { GoodType } from '$lib/types'
import { Alveolus } from '../board'

export class TransitAlveolus extends Alveolus {
	canGive(goodType: GoodType): number {
		// Only provide goods if working is enabled
		return this.storage.available(goodType)
	}
	advertise(): void {
		traces.advertising?.groupCollapsed(`Advertising ${this.name}`)

		const stock = this.storage.stock
		const goods = Object.keys(stock) as GoodType[]
		for (const good of goods) while (this.storage.available(good) && this.hive.provide(good, this));
		traces.advertising?.groupEnd()
	}
}
