import { type } from 'arktype'
import { computed, effect, type ScopedCallback, unreactive } from 'mutts/src'
import { Container, type ContainerChild, Sprite } from 'pixi.js'
import type { GoodType } from '$lib/arktype'
import type { Game } from '$lib/game/game'
import type { MovingGood } from '$lib/game/hive/hive'
import { Hive } from '$lib/game/hive/hive'
import type { Job } from '$lib/game/job'
import { gameIsaTypes } from '$lib/game/npcs/utils'
import type { Character } from '$lib/game/population/character'
import { type AxialCoord, axial, epsilon, tileSize } from '$lib/utils'
import { toAxialCoord } from '$lib/utils/position'
import { renderTileGoods, type Storage } from '../../storage'
import { AlveolusGate } from '../border/alveolus-gate'
import type { Tile } from '../tile'
import type { TileContent } from './content'
import { UnBuiltLand } from './unbuilt-land'
import { GcClassed } from './utils'

//reactiveOptions.maxEffectChain = 1000
interface LocalMovingGood extends MovingGood {
	from: AxialCoord
}

@unreactive
export abstract class Alveolus extends GcClassed<Ssh.AlveolusDefinition>() implements TileContent {
	public assignedWorker: Character | undefined
	public tile: Tile
	public declare hive: Hive
	public storage: Storage<any>
	// Configurable properties
	public walkway: boolean = true
	public conveyor: boolean = true
	private advertisingEffect: ScopedCallback

	constructor(tile: Tile, storage: Storage<any>) {
		super()
		this.storage = storage
		this.tile = tile

		const hive = Hive.for(tile)
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
		// Attach (and poke) *after* creating gates
		hive.attach(this)
		this.advertisingEffect = effect(() => {
			this.hive.campaign(this)
		})
	}

	get debugInfo() {
		return {}
	}
	get walkTime() {
		return this.walkway ? 1 : Number.POSITIVE_INFINITY
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
	render(game: Game): ContainerChild {
		const root = new Container()
		const size = tileSize
		// Alveolus sprite (centered)
		if (this.sprites?.[0]) {
			const sprite = new Sprite(game.getTexture(this.sprites[0]))
			// approximate size scaling similar to hexboard
			const scale = Math.max(sprite.width, sprite.height) / (size * 1.5)
			sprite.scale.set(1 / scale)
			sprite.anchor.set(0.5)
			root.addChild(sprite)
		}
		root.addChild(renderTileGoods(game, size, () => this.storage.renderedGoods()))

		return root
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
		return this.goodMovements.length > 0
			? ({ type: 'convey', fatigue: this.getFatigueCost(), urgency: 2 } as Job)
			: undefined
	}

	deconstruct() {
		this.advertisingEffect()
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
export function multiplyGoodsQty(record: Partial<Record<GoodType, number>>, multiplier: number) {
	return Object.fromEntries(
		Object.entries(record).map(([goodType, quantity]) => [goodType, quantity * multiplier]),
	)
}

export const AlveolusArkType = type.instanceOf(Alveolus)
