import type { GoodType } from '$lib/types'
import type { ExchangePriority, GoodsRelations } from '$lib/utils/advertisement'
import { Alveolus } from '../board/content/alveolus'
import type { Tile } from '../board/tile'
import { SlottedStorage } from '../storage/slotted-storage'

export class StorageAlveolus extends Alveolus {
	declare action: Ssh.SlottedStorageAction
	constructor(tile: Tile) {
		const def: Ssh.AlveolusDefinition = new.target.prototype
		if (def.action.type !== 'storage') {
			throw new Error('StorageAlveolus can only be created from a storage action')
		}
		const storage = new SlottedStorage(def.action.slots, def.action.capacity)
		super(tile, storage)
	}

	/**
	 * Check if this storage can store a specific good
	 */
	canTake(goodType: GoodType, priority: ExchangePriority) {
		// Only accept goods if working is enabled
		return this.working && priority > '0-store' ? this.storage.hasRoom(goodType) > 0 : false
	}
	canGive(goodType: GoodType, priority: ExchangePriority) {
		return priority > '0-store' ? this.storage.available(goodType) > 0 : false
	}

	get workingGoodsRelations(): GoodsRelations {
		return Object.fromEntries(
			Object.keys(this.storage.stock)
				.filter((goodType) => this.storage.available(goodType as GoodType) > 0)
				.map((goodType) => [
					goodType as GoodType,
					{ advertisement: 'provide', priority: '0-store' },
				]),
		)
	}
}
