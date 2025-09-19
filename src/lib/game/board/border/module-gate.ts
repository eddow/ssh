import type { GoodType } from '$lib/arktype'
import type { Storage } from '$lib/game/storage'
import { Module } from '../content'
import type { TileBorder, TileBorderContent } from './index'

/** A storage gate placed on a border between two tiles/modules. */
export class ModuleGate implements TileBorderContent, Storage {
	readonly border: TileBorder

	/** Connected modules on each side of the border (optional). */
	get moduleA() {
		const content = this.border.tile.a.content
		return content instanceof Module ? content : undefined
	}
	get moduleB() {
		const content = this.border.tile.b.content
		return content instanceof Module ? content : undefined
	}

	/** Simple per-gate storage (single-type buffer). */
	private storedType?: GoodType
	private storedAmount: number = 0
	private readonly capacity: number = 1

	constructor(border: TileBorder) {
		this.border = border
	}

	attach(): void {
		this.border.content = this
	}

	/** Remove the gate if no modules are connected anymore. */
	validateOrRemove(): void {
		if (!this.moduleA && !this.moduleB) {
			this.border.content = undefined
		}
	}

	canStoreGood(goodType: GoodType): number {
		if (this.storedType && this.storedType !== goodType) return 0
		return this.capacity - this.storedAmount
	}

	addGood(goodType: GoodType, qty: number): number {
		const can = this.canStoreGood(goodType)
		const stored = Math.min(qty, can)
		if (stored <= 0) return 0
		this.storedType = goodType
		this.storedAmount += stored
		return stored
	}

	removeGood(goodType: GoodType, qty: number): number {
		if (this.storedType !== goodType) return 0
		const taken = Math.min(qty, this.storedAmount)
		if (taken <= 0) return 0
		this.storedAmount -= taken
		if (this.storedAmount === 0) this.storedType = undefined
		return taken
	}

	get goods(): { [k in GoodType]?: number } {
		return this.storedType ? { [this.storedType]: this.storedAmount } : {}
	}
}
