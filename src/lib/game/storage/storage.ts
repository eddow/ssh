import { ReactiveBase } from 'mutts'
import type { ContainerChild } from 'pixi.js'
import type { GoodType } from '$lib/arktype'

export type Goods = { [k in GoodType]?: number }

export abstract class Storage<Allocation> extends ReactiveBase {
	/**
	 * Check how much of a good can be stored
	 * @param goodType - The type of good to check
	 * @returns The maximum quantity that can be stored
	 */
	abstract hasRoom(goodType?: GoodType): number

	/**
	 * Check if all goods can be stored
	 * @param goods - The goods to check
	 * @returns true if all goods can be stored
	 */
	abstract canStoreAll(goods: Goods): boolean

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

/**
 * Mixin that adds Storage forwarding functionality to a base class.
 * The resulting class will forward all Storage interface methods to a provided Storage instance.
 */
export function withStorageForwarder<Allocation, TBase extends new (...args: any[]) => any>(
	Base: TBase,
) {
	return class extends Base implements Storage<Allocation> {
		constructor(...args: any[]) {
			const [storage, ...rest] = args
			super(...rest)
			this.storage = storage as Storage<Allocation>
		}

		public readonly storage: Storage<Allocation>

		hasRoom(goodType?: GoodType): number {
			return this.storage.hasRoom(goodType)
		}

		canStoreAll(goods: Goods): boolean {
			return this.storage.canStoreAll(goods)
		}

		addGood(goodType: GoodType, qty: number): number {
			return this.storage.addGood(goodType, qty)
		}

		removeGood(goodType: GoodType, qty: number): number {
			return this.storage.removeGood(goodType, qty)
		}

		allocate(goodType: GoodType, qty: number, reason: any): Allocation {
			return this.storage.allocate(goodType, qty, reason)
		}

		reserve(goodType: GoodType, qty: number, reason: any): Allocation {
			return this.storage.reserve(goodType, qty, reason)
		}

		fulfill(allocation: Allocation): void {
			this.storage.fulfill(allocation)
		}

		cancel(allocation: Allocation): void {
			this.storage.cancel(allocation)
		}

		get stock() {
			return this.storage.stock
		}

		available(goodType: GoodType): number {
			return this.storage.available(goodType)
		}

		renderGoods(game: any, size: number) {
			return this.storage.renderGoods(game, size)
		}
	}
}
