import { SlottedStorage } from '$lib/game/storage/slotted-storage'
import { Module } from '../content'
import type { TileBorder, TileBorderContent } from './index'

/** A storage gate placed on a border between two tiles/modules. */
export class ModuleGate extends SlottedStorage implements TileBorderContent {
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

	constructor(border: TileBorder) {
		super(2, 3) // 2 slots, max quantity 3 per slot
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

	// Storage methods are inherited from SlottedStorage
}
