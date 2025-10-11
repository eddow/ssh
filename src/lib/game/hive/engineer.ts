import { computed } from 'mutts/src'
import { SlottedStorage } from '$lib/game/storage'
import type { Job } from '$lib/types/base'
import { toAxialCoord } from '$lib/utils/position'
import { Alveolus } from '../board/content/alveolus'
import type { Tile } from '../board/tile'
import { BuildAlveolus } from './build'

export class EngineerAlveolus extends Alveolus {
	declare action: Ssh.EngineerAction
	constructor(tile: Tile) {
		const def: Ssh.AlveolusDefinition = new.target.prototype
		if (def.action.type !== 'engineer') {
			throw new Error('EngineerAlveolus can only be created from an engineer action')
		}
		super(tile, new SlottedStorage(0, 0))
	}

	@computed // Returns a path to the nearest ready site, or false
	get nextSite() {
		const hex = this.tile.game.hex
		const start = toAxialCoord(this.tile.position)
		const path = hex.findNearest(
			start,
			(coord) => {
				const tile = hex.getTile(coord)
				return (
					tile?.content instanceof BuildAlveolus && tile.content.isReady && !tile.content.destroyed
				)
			},
			this.action.radius,
			true,
		)
		return path || false
	}

	alveolusSpecificJob(): Job | undefined {
		if (this.nextSite) {
			return { type: 'construct', fatigue: this.getFatigueCost(), urgency: 2 } as Job
		}
	}

	advertise(): void {}
}
