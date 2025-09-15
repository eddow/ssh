import { goods as goodsCatalog } from '$assets/game-content'
import type { CharacterScripts } from '$assets/scripts/globals'
import { type AxialRef, axial } from '$lib/hex'
import { objectMap } from '$lib/utils'
import type { Character } from '../character'
import type { HexTile } from '../hexboard'
import type { Position } from '../position'
import { positionRoughlyEquals, toAxialCoord } from '../position'
import type { GoodType } from '../tile'
import { InteractiveContext, loadNpcScripts } from './scripts'
import { DropStep, GrabStep, MoveToStep } from './steps'

const maxWalkTime = 24

type SubFunctions<T> = { [k: string]: (this: T, ...args: any[]) => any }

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
	get carriedType() {
		return this.#character.carriedType
	}
	get carriedAmount() {
		return this.#character.carriedAmount
	}

	walk: SubFunctions<CharacterContext> = {
		moveTo(to: Position) {
			const toAxial = toAxialCoord(to)
			const fromAxial = toAxialCoord(this.#character)
			// TODO: hyper-validate, should be in the same tile
			if (!positionRoughlyEquals(fromAxial, toAxial))
				return new MoveToStep(
					this.#character.tile.content.walkTime * axial.distance(fromAxial, toAxial),
					this.#character,
					to,
				)
		},
	}
	find: SubFunctions<CharacterContext> = {
		path(to: Position, punctual: boolean = true) {
			return this.#character.game.hex.findPath(
				toAxialCoord(this.#character.tile.position),
				axial.round(toAxialCoord(to)),
				maxWalkTime,
				punctual,
			)
		},
		food() {
			const { hex } = this.#character.game
			function bestFoodOnTile(coord: AxialRef): GoodType | null {
				const tile = hex.getTile(coord)
				if (!tile) return null
				const goodsMap = tile.content.goods
				let best: { type: GoodType; fv: number } | null = null
				for (const [good, count] of Object.entries(goodsMap) as [GoodType, number][]) {
					if (!count) continue
					const def = goodsCatalog[good]
					if (!def) continue
					const fv = def.feedingValue ?? 0
					if (fv > 0 && (!best || fv > best.fv)) best = { type: good, fv }
				}
				return best?.type ?? null
			}
			const start = toAxialCoord(this.#character.tile.position)
			const path = hex.findNearest(
				start,
				(coord) => bestFoodOnTile(coord) !== null,
				maxWalkTime,
				true,
			)
			if (!path || path.length === 0) return false as const
			const targetCoord = path[path.length - 1]
			const targetTile = hex.getTile(targetCoord)!
			const good = bestFoodOnTile(targetCoord)!
			return { tile: targetTile, good, path }
		},
		freeSpot(goodType: GoodType) {
			const { hex } = this.#character.game
			const start = toAxialCoord(this.#character.tile.position)
			const path = hex.findNearest(
				start,
				(coord) => {
					const tile = hex.getTile(coord)
					if (!tile) return false
					return tile.content.canStoreGood(goodType) > 0
				},
				maxWalkTime,
				true,
			)
			if (!path || path.length === 0) return false as const
			const targetCoord = path[path.length - 1]
			const targetTile = hex.getTile(targetCoord)!
			return { tile: targetTile, path }
		},
	}
	canWalkIn(tile: HexTile) {
		return Number.isFinite(this.#character.tile.content.walkTime)
	}

	inventory: SubFunctions<CharacterContext> = {
		grab(goodType: GoodType, maxAmount: number = 1) {
			return new GrabStep(this.#character, goodType, maxAmount)
		},
		drop(goodType: GoodType, maxAmount: number = 1) {
			return new DropStep(this.#character, goodType, maxAmount)
		}
	}
}

const modules = import.meta.glob('$assets/scripts/**/*.npcs', {
	query: '?raw',
	eager: true,
})
loadNpcScripts(
	objectMap(modules, (v: any) => v.default) as Record<string, string>,
	CharacterContext.prototype,
)
export default CharacterContext as new (
	character: Character,
) => CharacterContext & CharacterScripts
