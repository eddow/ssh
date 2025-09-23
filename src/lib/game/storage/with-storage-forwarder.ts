import type { GoodType } from '$lib/arktype'
import type { Storage } from './index'

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
