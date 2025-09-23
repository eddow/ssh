export * from './no-storage'
export * from './slotted-storage'
export * from './specific-storage'
export * from './with-storage-forwarder'

import type { ContainerChild } from 'pixi.js'
import type { GoodType } from '$lib/arktype'

export type Goods = { [k in GoodType]?: number }

export abstract class Storage<Allocation> {
	/**
	 * Check how much of a good can be stored
	 * @param goodType - The type of good to check
	 * @returns The maximum quantity that can be stored
	 */
	abstract hasRoom(goodType?: GoodType): number

	/**
	 * Add goods to storage
	 * @param goodType - The type of good to add
	 * @param qty - The quantity to add
	 * @returns The actual quantity that was stored
	 */
	abstract addGood(goodType: GoodType, qty: number): number

	/**
	 * Remove goods from storage
	 * @param goodType - The type of good to remove
	 * @param qty - The quantity to remove
	 * @returns The actual quantity that was removed
	 */
	abstract removeGood(goodType: GoodType, qty: number): number

	/**
	 * Allocate room for a good and return an opaque allocation token
	 * @throws Error if allocation fails (insufficient room)
	 */
	abstract allocate(goodType: GoodType, qty: number, reason: any): Allocation
	/**
	 * Reserve existing goods for removal and return an opaque allocation token
	 * @throws Error if reservation fails (insufficient goods)
	 */
	abstract reserve(goodType: GoodType, qty: number, reason: any): Allocation
	/**
	 * Fulfill an allocation: convert allocation into present goods
	 */
	abstract fulfill(allocation: Allocation): void
	/**
	 * Free an allocation without adding goods
	 */
	abstract cancel(allocation: Allocation): void

	/**
	 * Get all goods currently stored (stock totals, includes reserved)
	 */
	abstract get stock(): Goods

	/**
	 * Get currently available (unreserved) quantity for a good type
	 */
	abstract available(goodType: GoodType): number

	/** Render a visualization of stored goods */
	abstract renderGoods(game: any, size: number): ContainerChild
}
