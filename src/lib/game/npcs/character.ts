import type { CharacterScripts } from '$assets/scripts/globals'
import { axial } from '$lib/hex'
import { objectMap } from '$lib/utils'
import type { Character } from '../character'
import type { HexTile } from '../hexboard'
import type { Position } from '../position'
import { toAxialCoord, positionRoughlyEquals, xyDistance } from '../position'
import { InteractiveContext, loadNpcScripts } from './scripts'
import { MoveToStep } from './steps'


const maxWalkTime = 24

class CharacterContext extends InteractiveContext {
	#character: Character
	constructor(character: Character) {
		super(character)
		this.#character = character
	}
	get tile() {
		return this.#character.tile
	}
	set tile(value: HexTile) {
		// TODO: super-duper-validate (even with position)

		this.#character.tile = value
	}

	moveTo(to: Position) {
		const toAxial = toAxialCoord(to)
		const fromAxial = toAxialCoord(this.#character)
		// TODO: hyper-validate, should be in the same tile
		if(!positionRoughlyEquals(fromAxial, toAxial))
			return new MoveToStep(
				this.#character.tile.content.walkTime * axial.distance(fromAxial, toAxial),
				this.#character, to)
	}
	find = {
		path(this: CharacterContext, to: Position, punctual: boolean = true) {
			return this.#character.game.hex.findPath(
				toAxialCoord(this.#character.tile.position),
				axial.round(toAxialCoord(to)),
				maxWalkTime,
				punctual
			)
		},
		food(this: CharacterContext) {
			// TODO: implement
		},
		
	}
	canWalkIn(tile: HexTile) {
		return Number.isFinite(this.#character.tile.content.walkTime)
	}
}

const modules = import.meta.glob('$assets/scripts/**/*.npcs', {
		query: '?raw',
		eager: true,
	})
loadNpcScripts(objectMap(modules, (v: any) => v.default) as Record<string, string>, CharacterContext.prototype)
export default CharacterContext as new (
	character: Character,
) => CharacterContext & CharacterScripts
