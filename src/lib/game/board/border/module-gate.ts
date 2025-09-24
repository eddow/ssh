import { SlottedStorage } from '$lib/game/storage/slotted-storage'
import { Module } from '../content/module'
import type { TileBorder, TileBorderContent } from './border'

// A storage gate placed on a border between two tiles/modules.
export class ModuleGate extends SlottedStorage implements TileBorderContent {
	// TODO: It seems gates appear now only between modules, so testing contents might not be needed
	// Or, indeed, we have to decide one way to do
	get moduleA() {
		const content = this.border.tile.a.content
		return content instanceof Module ? content : undefined
	}
	get moduleB() {
		const content = this.border.tile.b.content
		return content instanceof Module ? content : undefined
	}

	get complex() {
		return this.moduleA?.complex ?? this.moduleB!.complex!
	}

	constructor(readonly border: TileBorder) {
		super(2, 3) // 2 slots, max quantity 3 per slot
	}

	attach(): void {
		this.border.content = this
	}

	// Remove the gate if no modules are connected anymore.
	validateOrRemove(): void {
		if (!this.moduleA && !this.moduleB) {
			this.border.content = undefined
		}
	}

	// Storage methods are inherited from SlottedStorage
}
