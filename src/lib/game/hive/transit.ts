import type { GoodType } from '$lib/arktype'
import { Alveolus } from '../board'

export class TransitAlveolus extends Alveolus {
	canGive(goodType: GoodType): number {
		return this.storage.available(goodType)
	}
	advertise(): void {
		const stock = this.storage.stock
		const goods = Object.keys(stock) as GoodType[]
		for (const good of goods) while (this.storage.available(good) && this.hive.provide(good, this));
	}
}
