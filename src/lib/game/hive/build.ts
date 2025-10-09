import { type } from 'arktype'
import { computed } from 'mutts/src'
import { alveoli as alveoliDefs } from '$assets/game-content'
import type { AlveolusType, GoodType } from '$lib/arktype'
import { assert, namedEffect } from '$lib/debug'
import { SpecificStorage } from '$lib/game/storage'
import { UnBuiltLand } from '../board'
import { Alveolus } from '../board/content/alveolus'
import type { Tile } from '../board/tile'
import { alveolusClass } from './index'

export class BuildAlveolus extends Alveolus {
	public underlyingLand?: UnBuiltLand // Store the UnBuiltLand that was here before
	public readonly target: AlveolusType

	constructor(tile: Tile, target: AlveolusType) {
		const targetDef = alveoliDefs[target]
		const cost = 'constructionCost' in targetDef ? targetDef.constructionCost : {}

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
		// TODO: Once the build has begun, the underlying land should be destroyed

		// Watch for completion and replace with target alveolus
		const once = namedEffect('construction.complete', () => {
			if (this.isReady) {
				// Construction is complete, replace with the target alveolus
				const TargetClass = alveolusClass[this.target]
				if (TargetClass) {
					// Destroy this build alveolus
					this.destroy()
					// Create the target alveolus and set as tile content
					this.tile.content = new TargetClass(this.tile)
				}
				once()
			}
		})
	}

	@computed
	get remainingNeeds(): Record<string, number> {
		const targetDef = alveoliDefs[this.target]
		const cost: Partial<Record<GoodType, number>> =
			'constructionCost' in targetDef ? targetDef.constructionCost : {}
		const needs: Record<string, number> = {}
		for (const [good, qty] of Object.entries(cost)) {
			const have = this.storage.available(good as GoodType) || 0
			if (have < qty) needs[good] = qty - have
		}
		return needs
	}

	@computed
	get isReady(): boolean {
		return Object.keys(this.remainingNeeds).length === 0
	}

	advertise(): void {
		// Only demand goods if tile is clear
		if (!this.tile.isClear) return

		// Demand each missing good
		for (const good of Object.keys(this.remainingNeeds) as GoodType[]) {
			if (this.storage.hasRoom(good)) this.hive.demand(good, this)
		}
	}
}

export const BuildAlveolusArkType = type.instanceOf(BuildAlveolus)
