import type { ScopedCallback } from 'mutts/src'
import { renderBorderGoods } from '$lib/game/storage/goods-renderer'
import { SlottedStorage } from '$lib/game/storage/slotted-storage'
import { tileSize } from '$lib/utils'
import { toAxialCoord, toWorldCoord } from '$lib/utils/position'
import type { Alveolus } from '../content/alveolus'
import { type TileBorder, TileBorderContent } from './border'

// A storage gate placed on a border between two tiles/alveoli.
export class AlveolusGate extends TileBorderContent {
	readonly storage: SlottedStorage

	get alveolusA() {
		return this.border.tile.a.content as Alveolus
	}
	get alveolusB() {
		return this.border.tile.b.content as Alveolus
	}

	get hive() {
		return this.alveolusA!.hive
	}

	readonly debugInfo = {
		type: 'AlveolusGate',
		storage: 'SlottedStorage',
	}

	constructor(readonly border: TileBorder) {
		const axialPos = toAxialCoord(border.position)
		super(border.game, `gate:${axialPos.q},${axialPos.r}`)
		this.storage = new SlottedStorage(2, 1) // 2 slots, max quantity 1 per slot
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

	render(): ScopedCallback | undefined {
		// Get world coordinates of both tiles
		const tileAWorld = toWorldCoord(this.border.tile.a.position)
		const tileBWorld = toWorldCoord(this.border.tile.b.position)

		// Calculate border center position
		const borderCenter = {
			x: (tileAWorld.x + tileBWorld.x) / 2,
			y: (tileBWorld.y + tileBWorld.y) / 2,
		}

		// Calculate relative position of tile A from the border center
		const alveolusCenter = {
			x: tileAWorld.x - borderCenter.x,
			y: tileAWorld.y - borderCenter.y,
		}

		// Render border goods using the storage
		return renderBorderGoods(
			this.game,
			tileSize,
			() => this.storage.renderedGoods(),
			borderCenter,
			alveolusCenter,
		)
	}
}
