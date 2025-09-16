import * as gameContent from '$assets/game-content'
import { goods as goodsCatalog } from '$assets/game-content'
import type { CharacterScripts } from '$assets/scripts/globals'
import { type AxialCoord, type AxialRef, axial } from '$lib/hex'
import { objectMap } from '$lib/utils'
import type { Character } from '../character'
import type { HexTile } from '../hexboard'
import type { Position } from '../position'
import { positionRoughlyEquals, toAxialCoord } from '../position'
import type { GoodType } from '../tile'
import { InteractiveContext, loadNpcScripts, protoCtx, subject } from './scripts'
import { DropStep, EatStep, GrabStep, MoveToStep, PonderingStep } from './steps'

const maxWalkTime = 24

class FindFunctions {
	declare [subject]: Character
	path(to: Position, punctual: boolean = true) {
		return this[subject].game.hex.findPath(
			toAxialCoord(this[subject].tile.position),
			axial.round(toAxialCoord(to)),
			maxWalkTime,
			punctual,
		)
	}
	food() {
		const { hex } = this[subject].game
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
		const start = toAxialCoord(this[subject].tile.position)
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
	}
	freeSpot(goodType: GoodType) {
		const { hex } = this[subject].game
		const start = toAxialCoord(this[subject].tile.position)
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
	}
	wanderingTile() {
		const { hex } = this[subject].game
		const start = toAxialCoord(this[subject].tile.position)
		const distance = 2 + Math.random() * 3 // 2-5 tiles away

		// Find all walkable tiles within the distance range
		const walkableTiles: { coord: AxialCoord; tile: HexTile }[] = []

		for (let q = -Math.ceil(distance); q <= Math.ceil(distance); q++) {
			for (let r = -Math.ceil(distance); r <= Math.ceil(distance); r++) {
				const coord = axial.linear({ q, r }, start)
				const actualDistance = axial.distance(start, coord)
				if (actualDistance >= 2) {
					const tile = hex.getTile(coord)
					if (tile && Number.isFinite(tile.content.walkTime)) {
						walkableTiles.push({ coord, tile })
					}
				}
			}
		}

		if (walkableTiles.length === 0) return false

		// Pick a random walkable tile
		const randomIndex = Math.floor(Math.random() * walkableTiles.length)
		const { coord: targetCoord, tile: targetTile } = walkableTiles[randomIndex]

		return { tile: targetTile, coord: targetCoord }
	}
}

class InventoryFunctions {
	declare [subject]: Character
	grab(goodType: GoodType, maxAmount: number = 1) {
		return new GrabStep(this[subject], goodType, maxAmount)
	}
	drop(goodType: GoodType, maxAmount: number = 1) {
		return new DropStep(this[subject], goodType, maxAmount)
	}
}

class WalkFunctions {
	declare [subject]: Character
	moveTo(to: Position) {
		const toAxial = toAxialCoord(to)
		const fromAxial = toAxialCoord(this[subject])
		// TODO: hyper-validate, should be in the same tile
		if (!positionRoughlyEquals(fromAxial, toAxial))
			return new MoveToStep(
				this[subject].tile.content.walkTime * axial.distance(fromAxial, toAxial),
				this[subject],
				to,
			)
	}
	can(tile: HexTile) {
		return Number.isFinite(this[subject].tile.content.walkTime)
	}
}

class SelfCareFunctions {
	declare [subject]: Character
	eat() {
		return new EatStep(this[subject])
	}
	pondering() {
		return new PonderingStep(this[subject])
	}
}

class CharacterContext extends InteractiveContext<Character> {
	get tile() {
		return this[subject].tile
	}
	set tile(value: HexTile) {
		// TODO: super-duper-validate (even with position)

		this[subject].tile = value
	}
	get carriedType() {
		return this[subject].carriedType
	}
	get carriedAmount() {
		return this[subject].carriedAmount
	}
	get hunger() {
		return this[subject].hunger
	}
	get satisfiedHunger() {
		return this[subject].triggerLevels.hunger.satisfied
	}
	get triggerLevels() {
		return this[subject].triggerLevels
	}
}

const characterContext = protoCtx(CharacterContext, {
	find: protoCtx(FindFunctions),
	inventory: protoCtx(InventoryFunctions),
	walk: protoCtx(WalkFunctions),
	selfCare: protoCtx(SelfCareFunctions),
	...gameContent,
})

const modules = import.meta.glob('$assets/scripts/**/*.npcs', {
	query: '?raw',
	eager: true,
})
loadNpcScripts(
	objectMap(modules, (v: any) => v.default) as Record<string, string>,
	characterContext,
)
export default function aCharacterContext(character: Character) {
	return Object.create(characterContext, {
		[subject]: { value: character },
	}) as CharacterScripts & typeof characterContext
}
