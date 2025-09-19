import { activityDurations, maxWalkTime } from '$assets/constants'
import * as gameContent from '$assets/game-content'
import { goods as goodsCatalog } from '$assets/game-content'
import type { CharacterContract } from '$assets/scripts/contracts'
import { contract, DepositType, GoodType } from '$lib/arktype'
import { assert } from '$lib/debug'
import { type AxialCoord, type AxialRef, axial } from '$lib/hex'
import { objectMap } from '$lib/utils'
import type { Character } from '../character'
import { type Tile, TileType, UnBuiltLand } from '../hex'
import { Positioned, positionRoughlyEquals, toAxialCoord } from '../position'
import { InteractiveContext, loadNpcScripts, protoCtx, subject } from './scripts'
import { EatStep, MoveToStep, PonderingStep, WaitStep } from './steps'

class FindFunctions {
	declare [subject]: Character
	@contract(Positioned, 'boolean')
	path(to: Positioned, punctual: boolean = true) {
		return this[subject].game.hex.findPath(
			toAxialCoord(this[subject].tile.position),
			axial.round(toAxialCoord(to)),
			maxWalkTime,
			punctual,
		)
	}
	@contract()
	food() {
		const { hex } = this[subject].game
		function bestFoodOnTile(coord: AxialRef): GoodType | null {
			const tile = hex.getTile(coord)
			if (!tile) return null
			const goodsMap = tile.content!.goods
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
	@contract(DepositType)
	deposit(deposit: DepositType) {
		const { hex } = this[subject].game
		const start = toAxialCoord(this[subject].tile.position)
		const path = hex.findNearest(
			start,
			(coord) => {
				const tile = hex.getTile(coord)
				return tile?.content instanceof UnBuiltLand && tile.content.deposit?.name === deposit
			},
			maxWalkTime,
			false,
		)
		if (!path || path.length === 0) return false as const
		return path
	}
	@contract(GoodType)
	freeSpot(goodType: GoodType) {
		const { hex } = this[subject].game
		const start = toAxialCoord(this[subject].tile.position)
		const path = hex.findNearest(
			start,
			(coord) => {
				const tile = hex.getTile(coord)
				if (!tile) return false
				return tile.content!.canStoreGood(goodType) > 0
			},
			maxWalkTime,
			true,
		)
		if (!path || path.length === 0) return false as const
		const targetCoord = path[path.length - 1]
		const targetTile = hex.getTile(targetCoord)!
		return { tile: targetTile, path }
	}
	@contract()
	wanderingTile() {
		const { hex } = this[subject].game
		const start = toAxialCoord(this[subject].tile.position)
		const distance = 2 + Math.random() * 3 // 2-5 tiles away

		// Find all walkable tiles within the distance range
		const walkableTiles: { coord: AxialCoord; tile: Tile }[] = []

		for (let q = -Math.ceil(distance); q <= Math.ceil(distance); q++) {
			for (let r = -Math.ceil(distance); r <= Math.ceil(distance); r++) {
				const coord = axial.linear({ q, r }, start)
				const actualDistance = axial.distance(start, coord)
				if (actualDistance >= 2) {
					const tile = hex.getTile(coord)
					if (tile && Number.isFinite(tile.content!.walkTime)) {
						walkableTiles.push({ coord, tile })
					}
				}
			}
		}

		if (walkableTiles.length === 0) return false

		// Pick a random walkable tile
		const randomIndex = Math.floor(Math.random() * walkableTiles.length)
		const { coord: targetCoord, tile: targetTile } = walkableTiles[randomIndex]

		return {
			tile: targetTile,
			path: this[subject].game.hex.findPath(
				toAxialCoord(this[subject].tile.position),
				targetCoord,
				maxWalkTime,
				true,
			),
		}
	}
}

class InventoryFunctions {
	declare [subject]: Character
	@contract(GoodType, 'number?')
	grab(goodType: GoodType, maxAmount: number = 1) {
		const character = this[subject]
		const tile = character.tile

		const canGrab = character.carryingCapacity - (character.carriedAmount || 0)
		const amount = Math.min(canGrab, maxAmount)

		const taken = amount <= 0 ? 0 : tile.content!.removeGood(goodType, amount)
		if (taken > 0) {
			character.carriedType = goodType
			character.carriedAmount = (character.carriedAmount || 0) + taken
		}
		return new WaitStep(taken * activityDurations.transfer, 'convey', `grab.${goodType}`)
	}
	@contract(GoodType, 'number?')
	drop(goodType: GoodType, maxAmount: number = 1) {
		const character = this[subject]
		const tile = character.tile

		const amount = Math.min(character.carriedAmount, maxAmount)
		const dropped = tile.content!.addGood(goodType, amount)
		character.carriedAmount -= dropped
		if (character.carriedAmount <= 0) character.carriedType = undefined
		return new WaitStep(amount * activityDurations.transfer, 'convey', `drop.${goodType}`)
	}
}

class WalkFunctions {
	declare [subject]: Character
	@contract(Positioned)
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
	@contract(TileType)
	stepOn(tile: Tile) {
		return this[subject].stepOn(tile)
	}
	@contract(TileType)
	can(tile: Tile) {
		return Number.isFinite(this[subject].tile.content!.walkTime)
	}
}

class SelfCareFunctions {
	declare [subject]: Character
	@contract()
	eat() {
		return new EatStep(this[subject])
	}
	@contract()
	pondering() {
		return new PonderingStep(this[subject])
	}
}

class WorkFunctions {
	declare [subject]: Character
	@contract()
	prepare() {
		return new WaitStep(
			this[subject].assignedModule!.preparationTime,
			'work',
			`prepare.${this[subject].assignedModule!.name}`,
		)
	}
	@contract()
	harvestStep() {
		const unbuiltLand = this[subject].tile.content as UnBuiltLand
		assert(unbuiltLand instanceof UnBuiltLand, 'tile.content must be an UnBuiltLand')
		const module = this[subject].assignedModule
		assert(module, 'assignedModule must be set')
		assert(module.action.type === 'harvest', 'assignedModule.action must be a harvest')
		const action = module.action as Ssh.HarvestingAction
		assert(
			action.deposit === unbuiltLand.deposit?.name,
			'assignedModule.action.deposit must be the same as tile.content.deposit.name',
		)
		const deposit = unbuiltLand.deposit!
		// Check if character can store any of the output goods
		const outputGoods = module.output
		const canStoreAny = Object.keys(outputGoods).some(goodType => 
			this[subject].canStoreGood(goodType as GoodType) > 0
		)
		if (!canStoreAny) return
		deposit.amount -= 1
		if (deposit.amount <= 0) {
			unbuiltLand.deposit = undefined
		}
		return new WaitStep(
			this[subject].assignedModule!.workTime,
			'work',
			`harvest.${this[subject].assignedModule!.name}`,
		).finished(() => {
			// Add all output goods to character inventory
			Object.entries(module.output).forEach(([goodType, qty]) => {
				this[subject].addGood(goodType as GoodType, qty)
			})
		})
	}
}

class CharacterContext extends InteractiveContext<Character> {
	// TODO: use the `Storage` interface
	get carriedType() {
		return this[subject].carriedType
	}
	get carriedAmount() {
		return this[subject].carriedAmount
	}
	get hunger() {
		return this[subject].hunger
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
	work: protoCtx(WorkFunctions),
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
	}) as CharacterContract & typeof characterContext
}
