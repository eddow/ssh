import type { Character } from '$lib/game/population/character'
import { SlottedStorage } from '$lib/game/storage'
import type { ConstructJob } from '$lib/types/base'
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

	nextJob(character?: Character): ConstructJob | undefined {
		const hex = this.tile.game.hex
		const startPos = character ? toAxialCoord(character.position) : toAxialCoord(this.tile.position)

		const path = hex.findNearest(
			startPos,
			(coord) => {
				const tile = hex.getTile(coord)
				return (
					tile?.content instanceof BuildAlveolus && tile.content.isReady && !tile.content.destroyed
				)
			},
			this.action.radius,
			true,
		)

		if (!path) return undefined

		return {
			job: 'construct',
			path: character ? path : undefined,
			urgency: 2,
			fatigue: this.getFatigueCost(),
		}
	}

	advertise(): void {}
}
