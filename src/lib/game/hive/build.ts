import { type } from 'arktype'
import { computed } from 'mutts/src'
import { alveoli as alveoliDefs } from '$assets/game-content'
import type { AlveolusType, GoodType } from '$lib/arktype'
import type { Job } from '$lib/game/job'
import { SpecificStorage } from '$lib/game/storage'
import { Alveolus } from '../board/content/alveolus'
import type { Tile } from '../board/tile'

export class BuildAlveolus extends Alveolus {
	declare action: Ssh.BuildAction & { target: AlveolusType }
	constructor(tile: Tile) {
		const def: Ssh.AlveolusDefinition = new.target.prototype
		if (def.action.type !== 'build') {
			throw new Error('BuildAlveolus can only be created from a build action')
		}
		const target = def.action.target as AlveolusType
		const targetDef = alveoliDefs[target]
		const cost = targetDef.constructionCost || {}
		super(tile, new SpecificStorage(cost))
	}

	@computed
	get remainingNeeds(): Record<string, number> {
		const targetDef = alveoliDefs[this.action.target]
		const cost = targetDef.constructionCost
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

	get keepWorking(): boolean {
		// Keep working while we still need any goods and we are empty to fetch next
		return Object.keys(this.remainingNeeds).length > 0 && this.storage.isEmpty
	}

	alveolusSpecificJob(): Job | undefined {
		if (Object.keys(this.remainingNeeds).length > 0 && this.storage.isEmpty) {
			return { type: 'gather', fatigue: this.getFatigueCost(), urgency: 1.5 }
		}
	}

	advertise(): void {
		// Demand each missing good
		for (const good of Object.keys(this.remainingNeeds) as GoodType[]) {
			this.hive.demand(good, this)
		}
	}
}

export const BuildAlveolusArkType = type.instanceOf(BuildAlveolus)
