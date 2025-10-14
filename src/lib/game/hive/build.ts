import { alveoli as alveoliDefs } from '$assets/game-content'
import { SpecificStorage } from '$lib/game/storage'
import type { AlveolusType, GoodType } from '$lib/types'
import { Alveolus } from '../board/content/alveolus'
import type { Tile } from '../board/tile'

export class BuildAlveolus extends Alveolus {
	public readonly target: AlveolusType

	constructor(tile: Tile, target: AlveolusType) {
		const targetDef = alveoliDefs[target]
		const cost = (targetDef.construction?.goods || {}) as Record<GoodType, number>

		super(tile, new SpecificStorage(cost))

		// Store properties
		this.target = target
	}

	//-@computed
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

	//-@computed
	get isReady(): boolean {
		return Object.keys(this.remainingNeeds).length === 0 && !this.destroyed
	}

	advertise(): void {
		// Demand construction materials
		if (this.destroyed) return

		// Only participate in storage queues if working is enabled
		if (this.working) {
			// Demand each missing good
			for (const good of Object.keys(this.remainingNeeds) as GoodType[]) {
				if (this.storage.hasRoom(good)) this.hive.demand(good, this)
			}
		}
	}
}
