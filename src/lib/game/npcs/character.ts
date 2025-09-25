import { type } from 'arktype'
import { maxWalkTime } from '$assets/constants'
import * as gameContent from '$assets/game-content'
import { goods as goodsCatalog } from '$assets/game-content'
import type { CharacterContract } from '$assets/scripts/contracts'
import { contract, DepositType, GoodType } from '$lib/arktype'
import { assert } from '$lib/debug'
import { type AxialCoord, type AxialRef, axial } from '$lib/hex'
import { objectMap } from '$lib/utils'
import { type TileBorder, TileBorderArkType } from '../board/border/border'
import { UnBuiltLand } from '../board/content/unbuilt-land'
import { type Tile, TileArkType } from '../board/tile'
import type { Character } from '../population/character'
import { Positioned, positionRoughlyEquals, toAxialCoord } from '../position'
import { InteractiveContext, loadNpcScripts, protoCtx, subject } from './scripts'
import { EatStep, MoveToStep, PonderingStep, WaitStep } from './steps'
import { AlveolusArkType } from '../board'

export interface Action<T = any> {
	readonly description: 'grab' | 'drop'
	readonly tileAllocation: T
	readonly vehicleAllocation: T
	readonly amount: number
}

class FindFunctions {
	declare [subject]: Character
	@contract(Positioned, 'boolean')
	path(to: Positioned, punctual: boolean = true) {
		return this[subject].game.hex.findPathForCharacter(
			toAxialCoord(this[subject].tile.position),
			axial.round(toAxialCoord(to)),
			this[subject],
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
			const goodsMap = tile.content!.stock
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
		const path = hex.findNearestForCharacter(
			start,
			this[subject],
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
		const path = hex.findNearestForCharacter(
			start,
			this[subject],
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
		let qty = 0
		const path = hex.findNearestForCharacter(
			start,
			this[subject],
			(coord) => {
				const tile = hex.getTile(coord)
				if (!tile) return false
				qty = tile.content!.hasRoom(goodType)
				return qty > 0
			},
			maxWalkTime,
			true,
		)
		if (!path || path.length === 0) return false as const
		const targetCoord = path[path.length - 1]
		const targetTile = hex.getTile(targetCoord)!
		return { tile: targetTile, path, qty }
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
			path: this[subject].game.hex.findPathForCharacter(
				toAxialCoord(this[subject].tile.position),
				targetCoord,
				this[subject],
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
		const {
			vehicle,
			tile: { content },
		} = character
		assert(content, 'tile.content must be set')
		assert(vehicle, 'tile.vehicle must be set')

		const canGrab = vehicle.hasRoom(goodType)
		const amount = Math.min(canGrab, maxAmount)

		if (amount <= 0) throw new Error('No goods to grab')
		const vehicleTransfer = vehicle.allocate(goodType, amount, `grab.${goodType}`)
		const tileTransfer = content.reserve(goodType, amount, `grab.${goodType}`)
		return new WaitStep(amount * vehicle.transferTime, 'convey', `grab.${goodType}`)
			.finished(() => {
				vehicleTransfer.fulfill()
				tileTransfer.fulfill()
			})
			.canceled(() => {
				vehicleTransfer.cancel()
				tileTransfer.cancel()
			})
	}
	@contract(GoodType, 'number?')
	drop(goodType: GoodType, maxAmount: number = 1) {
		const character = this[subject]
		const {
			vehicle,
			tile: { content },
		} = character
		assert(vehicle, 'tile.vehicle must be set')
		assert(content, 'tile.content must be set')

		const available = vehicle.available(goodType) ?? 0
		const canStore = content.hasRoom(goodType)
		const amount = Math.min(available, canStore, maxAmount)
		if (amount <= 0) throw new Error('No goods to drop')
		const tileTransfer = content.allocate(goodType, amount, `drop.${goodType}`)
		const vehicleTransfer = vehicle.reserve(goodType, amount, `drop.${goodType}`)
		return new WaitStep(amount * vehicle.transferTime, 'convey', `drop.${goodType}`)
			.finished(() => {
				tileTransfer.fulfill()
				vehicleTransfer.fulfill()
			})
			.canceled(() => {
				tileTransfer.cancel()
				vehicleTransfer.cancel()
			})
	}
	@contract(GoodType, 'number', type.or(TileArkType, TileBorderArkType))
	planDrop(goodType: GoodType, quantity: number, destination: Tile | TileBorder) {
		const character = this[subject]
		const content = destination.content
		const vehicle = character.vehicle
		assert(vehicle, 'tile.vehicle must be set')
		assert(content, 'destination.content must be set')

		const available = vehicle.available(goodType) ?? 0
		const canStore = content.hasRoom(goodType)
		const amount = Math.min(available, canStore, quantity)
		if (amount <= 0) throw new Error('No goods to drop')

		const tileAllocation = content.allocate(goodType, amount, `planDrop.${goodType}`)
		const vehicleAllocation = vehicle.reserve(goodType, amount, `planDrop.${goodType}`)

		// Register final callback to cancel allocations when script ends
		assert(character.runningScript, 'character.runningScript must be set')
		character.runningScript.final(() => {
			tileAllocation.cancel()
			vehicleAllocation.cancel()
		})

		return { description: 'drop' as const, tileAllocation, vehicleAllocation, amount }
	}
	@contract(GoodType, 'number', type.or(TileArkType, TileBorderArkType))
	planGrab(goodType: GoodType, quantity: number, source: Tile | TileBorder) {
		const character = this[subject]
		const vehicle = character.vehicle
		assert(vehicle, 'tile.vehicle must be set')
		const content = source.content
		assert(content, 'source.content must be set')

		const canGrab = vehicle.hasRoom(goodType)
		const available = content.available(goodType) ?? 0
		const amount = Math.min(canGrab, available, quantity)
		if (amount <= 0) throw new Error('No goods to grab')

		const vehicleAllocation = vehicle.allocate(goodType, amount, `planGrab.${goodType}`)
		const tileAllocation = content.reserve(goodType, amount, `planGrab.${goodType}`)

		// Register final callback to cancel allocations when script ends
		assert(character.runningScript, 'character.runningScript must be set')
		character.runningScript.final(() => {
			vehicleAllocation.cancel()
			tileAllocation.cancel()
		})

		return { description: 'grab' as const, tileAllocation, vehicleAllocation, amount }
	}
	@contract('object')
	effectuate(action: Action) {
		const character = this[subject]
		const { tileAllocation, vehicleAllocation, amount, description } = action
		const {
			tile: { content },
			vehicle,
		} = character
		assert(content, 'tile.content must be set')
		assert(vehicle, 'tile.vehicle must be set')

		return new WaitStep(amount * vehicle.transferTime, 'convey', description)
			.finished(() => {
				tileAllocation.fulfill()
				vehicleAllocation.fulfill()
			})
			.canceled(() => {
				tileAllocation.cancel()
				vehicleAllocation.cancel()
			})
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
	@contract(TileArkType)
	stepOn(tile: Tile) {
		return this[subject].stepOn(tile)
	}
	@contract(TileArkType)
	can(_tile: Tile) {
		return Number.isFinite(this[subject].tile.content!.walkTime)
	}
}

class SelfCareFunctions {
	declare [subject]: Character
	@contract(GoodType)
	eat(food: GoodType) {
		return new EatStep(this[subject], food)
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
			this[subject].assignedAlveolus!.preparationTime,
			'work',
			`prepare.${this[subject].assignedAlveolus!.name}`,
		)
	}
	@contract(AlveolusArkType.optional())
	convey() {
		const character = this[subject]
		const alveolus = character.assignedAlveolus!
		assert(
			alveolus.tile === character.tile,
			'Character must be assigned to the alveolus on the same tile',
		)
		// Pick one movement that passes through this alveolus
		const movements = alveolus.goodMovements
		if (movements.length === 0) return
		const mg = movements[0]
		const hive = alveolus.hive

		// Advance one hop along the path
		const hop = mg.hop()!
		// If moving from tile -> border, allocate on border and fulfill provider reservation
		const nextStorage = hive.storageAt(hop)
		const hopAlloc = mg.path.length ?
			nextStorage!.allocate(mg.goodType, 1, { type: 'convey.hop', movement: mg }) :
			undefined
		mg.allocations.provider.fulfill()
		const moving = character.game.hex.freeGoods.add(alveolus.tile, mg.goodType, mg.from)
		const time = character.vehicle.transferTime * axial.distance(mg.from, hop)

		return new MoveToStep(time, moving, hop, 'convey')
			.canceled(() => {
				hopAlloc?.cancel()
				mg.allocations.demander.cancel()
				mg.demander.poke()
				mg.finish()
			}).finished(() => {
				moving.remove()
				if(!mg.path.length) {
					mg.allocations.demander.fulfill()
				} else {
					hopAlloc!.fulfill()
					mg.allocations.provider = nextStorage!.reserve(mg.goodType, 1, { type: 'convey.path', movement: mg })
				}
			})
	}
	@contract()
	harvestStep() {
		const unbuiltLand = this[subject].tile.content as UnBuiltLand
		assert(unbuiltLand instanceof UnBuiltLand, 'tile.content must be an UnBuiltLand')
		const alveolus = this[subject].assignedAlveolus as Ssh.AlveolusDefinition<Ssh.HarvestingAction>
		assert(alveolus, 'assignedAlveolus must be set')
		assert(alveolus.action.type === 'harvest', 'assignedAlveolus.action must be a harvest')
		const action = alveolus.action as Ssh.HarvestingAction
		assert(
			action.deposit === unbuiltLand.deposit?.name,
			'assignedAlveolus.action.deposit must be the same as tile.content.deposit.name',
		)
		const deposit = unbuiltLand.deposit!
		// Check if character can store any of the output goods
		const outputGoods = alveolus.action.output
		const canStoreAny = Object.keys(outputGoods).some(
			(goodType) => this[subject].vehicle.hasRoom(goodType as GoodType) > 0,
		)
		if (!canStoreAny) return
		deposit.amount -= 1
		if (deposit.amount <= 0) {
			unbuiltLand.deposit = undefined
		}
		return new WaitStep(
			this[subject].assignedAlveolus!.workTime,
			'work',
			`harvest.${this[subject].assignedAlveolus!.name}`,
		).finished(() => {
			// Add all output goods to character inventory
			Object.entries(alveolus.action.output).forEach(([goodType, qty]) => {
				this[subject].vehicle.addGood(goodType as GoodType, qty)
			})
		})
	}
}

class CharacterContext extends InteractiveContext<Character> {
	get I() {
		return this[subject]
	}
	get hunger() {
		return this[subject].hunger
	}
	get triggerLevels() {
		return this[subject].triggerLevels
	}

	get carriedFood() {
		return this[subject].carriedFood
	}
	get aCarriedGood() {
		return this[subject].aCarriedGood
	}
	get vehicle() {
		return this[subject].vehicle
	}
	@contract(GoodType.optional())
	haveRoom(goodType?: GoodType): number {
		return this[subject].vehicle.hasRoom(goodType)
	}
	@contract()
	pokeAlveolus() {
		return this[subject].assignedAlveolus!.poke()
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

const alveoli = import.meta.glob('$assets/scripts/**/*.npcs', {
	query: '?raw',
	eager: true,
})
loadNpcScripts(
	objectMap(alveoli, (v: any) => v.default) as Record<string, string>,
	characterContext,
)
export default function aCharacterContext(character: Character) {
	return Object.create(characterContext, {
		[subject]: { value: character },
	}) as CharacterContract & typeof characterContext
}
