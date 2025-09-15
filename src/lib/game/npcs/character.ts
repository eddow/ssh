import type { CharacterScripts } from '$assets/scripts/globals'
import { axial } from '$lib/hex'
import { objectMap } from '$lib/utils'
import type { Character } from '../character'
import type { HexTile } from '../hexboard'
import type { Position } from '../position'
import { toAxialCoord, isPosition, positionRoughlyEquals } from '../position'
import { GameUtils, loadNpcScripts } from './scripts'
import { MoveToStep } from './steps'


const maxWalkTime = 10

class CharacterContext extends GameUtils {
	#subject: Character
	constructor(subject: Character) {
		super(subject)
		this.#subject = subject
	}
	get tile() {
		return this.#subject.tile
	}
	set tile(value: HexTile) {
		// TODO: super-duper-validate (even with position)
		
		this.#subject.tile = value
	}
	log(...args: any[]) {
		this.#subject.log(...args)
	}

	moveTo(to: Position) {
		// TODO: hyper-validate, should be in the same tile
		if(!positionRoughlyEquals(this.#subject.tile.position, to))
			return new MoveToStep(this.#subject.tile.content.walkTime, this.#subject, to)
	}
	findPath(to: Position) {
		return this.#subject.game.hex.findPath(
			axial.round(toAxialCoord(this.#subject.tile.position)),
			axial.round(toAxialCoord(to)),
			maxWalkTime
		)
	}
	canWalkIn(tile: HexTile) {
		return Number.isFinite(this.#subject.tile.content.walkTime)
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
