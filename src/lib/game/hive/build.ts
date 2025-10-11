import { computed } from 'mutts/src'
import { alveoli as alveoliDefs } from '$assets/game-content'
import { assert } from '$lib/debug'
import { SpecificStorage } from '$lib/game/storage'
import type { AlveolusType, GoodType } from '$lib/types'
import { UnBuiltLand } from '../board'
import { Alveolus } from '../board/content/alveolus'
import type { Tile } from '../board/tile'

export class BuildAlveolus extends Alveolus {
	public underlyingLand?: UnBuiltLand // Store the UnBuiltLand that was here before
	public readonly target: AlveolusType

	constructor(tile: Tile, target: AlveolusType) {
		const targetDef = alveoliDefs[target]
		const cost = (targetDef.construction?.goods || {}) as Record<GoodType, number>

		// Preserve the underlying UnBuiltLand (for background and deposit checking) before calling super
		const underlyingLand = tile.content
		assert(
			underlyingLand instanceof UnBuiltLand,
			'Underlying land of construction site must be an UnBuiltLand',
		)

		super(tile, new SpecificStorage(cost))

		// Now assign properties after super
		this.target = target
		this.underlyingLand = underlyingLand
		// TODO: Once the resource collection has begun, the underlying land should be destroyed
	}

	@computed
	get remainingNeeds(): Record<string, number> {
		const targetDef = alveoliDefs[this.target]
		const cost = targetDef.construction?.goods || {}
		const needs: Record<string, number> = {}
		for (const [good, qty] of Object.entries(cost)) {
			const have = this.storage.available(good as GoodType) || 0
			if (have < qty) needs[good] = qty - have
		}
		return needs
	}

	@computed
	get isReady(): boolean {
		return Object.keys(this.remainingNeeds).length === 0 && !this.destroyed
	}

	advertise(): void {
		// Only demand goods if tile is clear
		if (!this.tile.isClear || this.destroyed) return

		// Demand each missing good
		for (const good of Object.keys(this.remainingNeeds) as GoodType[]) {
			if (this.storage.hasRoom(good)) this.hive.demand(good, this)
		}
	}
}
