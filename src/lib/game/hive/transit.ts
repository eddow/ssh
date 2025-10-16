import type { GoodType } from '$lib/types'
import type { GoodsRelations } from '$lib/utils/advertisement'
import { Alveolus } from '../board'

export class TransitAlveolus extends Alveolus {
	get workingGoodsRelations(): GoodsRelations {
		return Object.fromEntries(
			Object.keys(this.storage.stock)
				.filter((goodType) => this.storage.available(goodType as GoodType) > 0)
				.map((goodType) => [goodType as GoodType, { advertisement: 'provide', priority: '2-use' }]),
		)
	}
}
