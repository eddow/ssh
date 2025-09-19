import type { GoodType } from '$lib/arktype'

export interface Storage {
	/**
	 * Check how much of a good can be stored
	 * @param goodType - The type of good to check
	 * @returns The maximum quantity that can be stored
	 */
	canStoreGood(goodType?: GoodType): number

	/**
	 * Add goods to storage
	 * @param goodType - The type of good to add
	 * @param qty - The quantity to add
	 * @returns The actual quantity that was stored
	 */
	addGood(goodType: GoodType, qty: number): number

	/**
	 * Remove goods from storage
	 * @param goodType - The type of good to remove
	 * @param qty - The quantity to remove
	 * @returns The actual quantity that was removed
	 */
	removeGood(goodType: GoodType, qty: number): number

	/**
	 * Get all goods currently stored
	 * @returns A record of goods and their quantities
	 */
	get goods(): { [k in GoodType]?: number }
}

// Storage types are exported from their individual files
// Import them directly: import { SlottedStorage } from './storage/slotted-storage'
