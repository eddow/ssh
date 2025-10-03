import type { Goods, GoodType } from '$lib/arktype'
import type { RenderedGoodSlots } from './goods-renderer'

export interface AllocationBase {
	cancel(): void
	fulfill(): void
}
export abstract class Storage<Allocation extends AllocationBase> {
	/**
	 * Check how much of a good can be stored
	 * @param goodType - The type of good to check
	 * @returns The maximum quantity that can be stored
	 */
	abstract hasRoom(goodType?: GoodType): number
	abstract get isEmpty(): boolean
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
	 * Allocate room for goods and return an opaque allocation token
	 * @throws Error if allocation fails (insufficient room)
	 */
	abstract allocate(goods: Goods, reason: any): Allocation
	/**
	 * Reserve existing goods for removal and return an opaque allocation token
	 * @throws Error if reservation fails (insufficient goods)
	 */
	abstract reserve(goods: Goods, reason: any): Allocation

	/**
	 * Get all goods currently stored (stock totals, includes reserved)
	 */
	abstract get stock(): Goods

	/**
	 * Get currently available (unreserved) quantity for a good type
	 */
	abstract available(goodType: GoodType): number

	/** Render a visualization of stored goods */
	abstract renderedGoods(): RenderedGoodSlots
	abstract get allocatedSlots(): boolean
}

/**
 * Mixin that adds Storage forwarding functionality to a base class.
 * The resulting class will forward all Storage interface methods to a provided Storage instance.
 */
export function withStorageForwarder<
	Allocation extends AllocationBase,
	TBase extends new (
		...args: any[]
	) => any,
>(Base: TBase) {
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

		get isEmpty(): boolean {
			return this.storage.isEmpty
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

		allocate(goods: Goods, reason: any): Allocation {
			return this.storage.allocate(goods, reason)
		}

		reserve(goods: Goods, reason: any): Allocation {
			return this.storage.reserve(goods, reason)
		}

		get stock() {
			return this.storage.stock
		}

		available(goodType: GoodType): number {
			return this.storage.available(goodType)
		}

		renderedGoods() {
			return this.storage.renderedGoods()
		}

		get allocatedSlots() {
			return this.storage.allocatedSlots
		}
	}
}
