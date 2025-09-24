import { SlottedStorage } from '$lib/game/storage/slotted-storage'
import { Alveolus } from '../content/alveolus'
import type { TileBorder, TileBorderContent } from './border'

// A storage gate placed on a border between two tiles/alveoli.
export class AlveolusGate extends SlottedStorage implements TileBorderContent {
	// TODO: It seems gates appear now only between alveoli, so testing contents might not be needed
	// Or, indeed, we have to decide one way to do
	get alveolusA() {
		const content = this.border.tile.a.content
		return content instanceof Alveolus ? content : undefined
	}
	get alveolusB() {
		const content = this.border.tile.b.content
		return content instanceof Alveolus ? content : undefined
	}

	get hive() {
		return this.alveolusA?.hive ?? this.alveolusB!.hive!
	}

	constructor(readonly border: TileBorder) {
		super(2, 3) // 2 slots, max quantity 3 per slot
	}

	attach(): void {
		this.border.content = this
	}

	// Remove the gate if no alveoli are connected anymore.
	validateOrRemove(): void {
		if (!this.alveolusA && !this.alveolusB) {
			this.border.content = undefined
		}
	}

	// Storage methods are inherited from SlottedStorage
}
