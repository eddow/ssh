import { type } from 'arktype'
import { computed, type ScopedCallback, unreactive } from 'mutts/src'
import { Sprite } from 'pixi.js'
import type { GoodType } from '$lib/arktype'
import type { Game } from '$lib/game/game'
import type { Hive, MovingGood } from '$lib/game/hive/hive'
import type { Job } from '$lib/game/job'
import { gameIsaTypes } from '$lib/game/npcs/utils'
import type { Character } from '$lib/game/population/character'
import { type AxialCoord, axial, epsilon, tileSize } from '$lib/utils'
import { toAxialCoord, toWorldCoord } from '$lib/utils/position'
import { renderTileGoods, type Storage } from '../../storage'
import { AlveolusGate } from '../border/alveolus-gate'
import type { Tile } from '../tile'
import { TileContent } from './content'
import { UnBuiltLand } from './unbuilt-land'
import { GcClassed } from './utils'

//reactiveOptions.maxEffectChain = 1000
interface LocalMovingGood extends MovingGood {
	from: AxialCoord
}

@unreactive
export abstract class Alveolus extends GcClassed<Ssh.AlveolusDefinition, typeof TileContent>(
	TileContent,
) {
	public assignedWorker: Character | undefined
	public tile: Tile
	public declare hive: Hive
	public storage: Storage<any>
	// Configurable properties removed - walkway and conveyor are no longer used
	public advertisingEffect?: ScopedCallback

	constructor(tile: Tile, storage: Storage<any>) {
		super()
		this.storage = storage
		this.tile = tile

		// Only create gates between two alveoli
		for (const surrounding of this.tile.surroundings) {
			// Check if the neighboring tile also contains an alveolus
			if (surrounding.tile instanceof Alveolus) {
				// Create gate only if one doesn't already exist
				if (!(surrounding.border.content instanceof AlveolusGate)) {
					surrounding.border.content = new AlveolusGate(surrounding.border)
				}
			}
		}
	}

	get debugInfo() {
		return {}
	}
	get walkTime() {
		return 1
	}
	get background() {
		return 'concrete'
	}
	get gates(): AlveolusGate[] {
		return this.tile.surroundings
			.map((b) => b.border.content)
			.filter((b): b is AlveolusGate => b instanceof AlveolusGate)
	}

	/**
	 * Whether the worker should go on its work in this alveolus
	 * @returns true if the alveolus can keep working
	 */
	get keepWorking(): boolean {
		return true
	}

	// Render alveolus sprite + a vertical goods bar on the right side of the tile
	render(game: Game): ScopedCallback | undefined {
		const size = tileSize
		const worldPos = toWorldCoord(this.tile.position)
		const cleanups: ScopedCallback[] = []

		// Alveolus sprite (centered)
		if (this.sprites?.[0]) {
			const sprite = new Sprite(game.getTexture(this.sprites[0]))
			// approximate size scaling similar to hexboard
			const scale = Math.max(sprite.width, sprite.height) / (size * 1.5)
			sprite.scale.set(1 / scale)
			sprite.anchor.set(0.5)
			sprite.position.set(worldPos.x, worldPos.y)
			game.alveoliLayer.addChild(sprite)

			cleanups.push(() => {
				game.alveoliLayer.removeChild(sprite)
				sprite.destroy()
			})
		}

		// Render stored goods
		const goodsCleanup = renderTileGoods(game, size, () => this.storage.renderedGoods(), worldPos)
		if (goodsCleanup) cleanups.push(goodsCleanup)

		return () => {
			for (const cleanup of cleanups) cleanup()
		}
	}

	canInteract(_action: string): boolean {
		// Alveoli can't be built on (they already exist)
		return false
	}

	@computed
	get isBurdened(): boolean {
		// Check if there are FreeGoods on this tile
		const coord = toAxialCoord(this.tile.position)
		const freeGoods = this.tile.board.freeGoods.getGoodsAt(coord)
		return freeGoods.length > 0
	}

	alveolusSpecificJob?(): Job | undefined

	getJob(): Job | undefined {
		// TODO: cleaning job (also unbuild marked tile) -> unburden
		if (this.assignedWorker) return undefined
		// Don't provide jobs if the alveolus is burdened by FreeGoods
		if (this.isBurdened) return undefined
		const carry = this.conveyJob()
		if (carry) return carry
		return this.alveolusSpecificJob?.()
	}

	protected getFatigueCost(): number {
		// Base fatigue based on action type
		const baseFatigue = this.action.type === 'harvest' ? this.workTime + 2 : this.workTime

		// Add time-based fatigue (if alveolus has time configuration)
		// For now, just return base fatigue
		return baseFatigue
	}

	/**
	 * Goods movements visible at this alveolus:
	 * - from/to includes tile or its borders
	 * - next hop has room for the good
	 */
	@computed
	get goodMovements(): LocalMovingGood[] {
		const hive = this.hive
		const here = toAxialCoord(this.tile.position)
		const results: LocalMovingGood[] = []
		function canAdvance(mg: MovingGood) {
			const storage = hive.storageAt(mg.path[0])
			return storage?.hasRoom(mg.goodType) || mg.path.length === 1
		}
		// Special case: include all movements at the tile itself
		const atHere = hive.movingGoods.get(here)
		if (atHere)
			for (const mg of atHere)
				if (canAdvance(mg)) results.push(Object.setPrototypeOf({ from: here }, mg))

		// Only browse surroundings (borders)
		for (const { border } of this.tile.surroundings) {
			const from = toAxialCoord(border.position)
			const arr = hive.movingGoods.get(from)
			if (!arr) continue
			for (const mg of arr) {
				if (axial.distance(mg.path[0], here) < 0.5 + epsilon && canAdvance(mg))
					results.push(Object.setPrototypeOf({ from }, mg))
			}
		}
		return results
	}
	@computed
	get incomingGoods(): boolean {
		// Note: because borders have 2 neighbors, if a good is incoming, it's for you (you're in one of the neighbors)
		return this.tile.surroundings.some(
			(s) => s.border.content instanceof AlveolusGate && s.border.content.allocatedSlots,
		)
	}

	private conveyJob(): Job | undefined {
		// Provide a convey job only when there are pass-through movements via borders
		// TODO: 2 "queued" movement goods (one from a->B, one from B->A) or a larger circle should be untangled
		// TODO: the chosen movement should be random, not arbitrary
		// TODO: set urgency/fatigue ?
		return this.goodMovements.length > 0
			? ({ type: 'convey', fatigue: 3, urgency: 2 } as Job)
			: undefined
	}

	deconstruct() {
		this.advertisingEffect?.()
		this.tile.content = new UnBuiltLand(this.tile, 'concrete')
		for (const gate of this.gates) gate.border.content = undefined
		this.hive.removeAlveolus(this)
	}

	@computed
	get neighborAlveoli(): Alveolus[] {
		return this.tile.neighborTiles
			.map((neighbor) => neighbor?.content)
			.filter((c): c is Alveolus => c instanceof Alveolus)
	}
	abstract advertise(): void

	/**
	 * Check if this alveolus has a specific good in stock
	 * Default implementation delegates to storage
	 */
	canGive(_goodType: GoodType): number {
		return 0
	}

	/**
	 * Check if this alveolus can store a specific good
	 * Default implementation delegates to storage
	 */
	canTake(_goodType: GoodType): number {
		return 0
	}
}
gameIsaTypes.alveolus = (value: any) => {
	return value instanceof Alveolus
}

export const AlveolusArkType = type.instanceOf(Alveolus)
