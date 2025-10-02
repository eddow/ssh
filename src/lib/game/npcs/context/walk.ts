import { contract } from '$lib/arktype'
import type { Character } from '$lib/game/population/character'
import { axial } from '$lib/utils'
import { type Positioned, positionRoughlyEquals, toAxialCoord } from '../../../utils/position'
import { type Tile, TileArkType } from '../../board/tile'
import { subject } from '../scripts'
import { MoveToStep } from '../steps'

class WalkFunctions {
	declare [subject]: Character
	@contract('object')
	moveTo(to: Positioned) {
		const toAxial = toAxialCoord(to)
		const fromAxial = toAxialCoord(this[subject])
		// ArkType validation now handles argument validation
		if (!positionRoughlyEquals(fromAxial, toAxial))
			return new MoveToStep(
				this[subject].tile.content!.walkTime * axial.distance(fromAxial, toAxial),
				this[subject],
				to,
			)
	}
	/**
	 * Enters in the tile even if it's not walkable
	 */
	@contract()
	enter() {
		const toAxial = toAxialCoord(this[subject].tile)
		const fromAxial = toAxialCoord(this[subject])
		if (!positionRoughlyEquals(fromAxial, toAxial))
			return new MoveToStep(axial.distance(fromAxial, toAxial), this[subject], toAxial)
	}
	@contract(TileArkType)
	stepOn(tile: Tile) {
		return this[subject].stepOn(tile)
	}
	@contract(TileArkType)
	can(_tile: Tile) {
		return Number.isFinite(this[subject].tile.content!.walkTime)
	}
}

export { WalkFunctions }
