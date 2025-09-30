import type { GoodType } from '$lib/arktype'
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
	 * Check if this storage has a specific good in stock
	 */
	canGive(goodType: GoodType): number {
		return this.storage.available(goodType)
	}

	/**
	 * Check if this storage can store a specific good
	 */
	canTake(goodType: GoodType): number {
		return this.storage.hasRoom(goodType)
	}
}
