import { SlottedStorage } from '$lib/game/storage/slotted-storage'
import type { Alveolus } from '../content/alveolus'
import type { TileBorder, TileBorderContent } from './border'

// A storage gate placed on a border between two tiles/alveoli.
export class AlveolusGate extends SlottedStorage implements TileBorderContent {
	get alveolusA() {
		return this.border.tile.a.content as Alveolus
	}
	get alveolusB() {
		return this.border.tile.b.content as Alveolus
	}

	get hive() {
		return this.alveolusA!.hive
	}

	constructor(readonly border: TileBorder) {
		super(2, 1) // 2 slots, max quantity 3 per slot
	}

	attach(): void {
		this.border.content = this
	}

	// Remove the gate if not exactly two alveoli are connected.
	validateOrRemove(): void {
		if (!this.alveolusA || !this.alveolusB) {
			this.border.content = undefined
		}
	}

	// Storage methods are inherited from SlottedStorage
}
