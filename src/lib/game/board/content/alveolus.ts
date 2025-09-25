import { type } from 'arktype'
import { computed } from 'mutts'
import { Container, type ContainerChild, Sprite } from 'pixi.js'
import type { GoodType } from '$lib/arktype'
import type { Game } from '$lib/game/game'
import { Hive } from '$lib/game/hive/hive'
import type { Job } from '$lib/game/job'
import { gameIsaTypes } from '$lib/game/npcs/utils'
import type { Character } from '$lib/game/population/character'
import { tileSize } from '$lib/utils'
import { type Storage, withStorageForwarder } from '../../storage'
import { AlveolusGate } from '../border/alveolus-gate'
import type { Tile } from '../tile'
import type { TileContent } from './content'
import { UnBuiltLand } from './unbuilt-land'
import { GcClassed } from './utils'

export abstract class Alveolus
	extends withStorageForwarder(GcClassed<Ssh.AlveolusDefinition>())
	implements TileContent
{
	public assignedWorker: Character | undefined

	public declare hive: Hive
	// Configurable properties
	public walkway: boolean = true
	public conveyor: boolean = true

	constructor(
		public tile: Tile,
		storage: Storage<any>,
	) {
		super(storage)
		const hive = Hive.for(tile)
		hive.attach(this)
		for (const surrounding of this.tile.surroundings)
			surrounding.border.content = new AlveolusGate(surrounding.border)
	}

	get debugInfo() {
		return {
			outputs: this.output,
			storage: (this.storage as any).debugInfo,
		}
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
		root.addChild(this.renderGoods(game, size))

		return root
	}

	canInteract(_action: string): boolean {
		// Alveoli can't be built on (they already exist)
		return false
	}
	alveolusSpecificJob?(): Job | undefined

	getJob(): Job | undefined {
		// perhaps carry/...
		return this.alveolusSpecificJob?.()
	}

	protected getFatigueCost(): number {
		// Base fatigue based on action type
		const baseFatigue = this.action.type === 'harvest' ? this.workTime + 2 : this.workTime

		// Add time-based fatigue (if alveolus has time configuration)
		// For now, just return base fatigue
		return baseFatigue
	}

	deconstruct() {
		this.tile.content = new UnBuiltLand(this.tile, 0, 'concrete')
		for (const gate of this.gates) gate.border.content = undefined
		this.hive.removeAlveolus(this)
	}

	@computed
	get neighborAlveoli(): Alveolus[] {
		return this.tile.neighborTiles
			.map((neighbor) => neighbor?.content)
			.filter((c): c is Alveolus => c instanceof Alveolus)
	}

	pull(goodType: GoodType, target: Alveolus): any {
		return goodType in this.output && this.storage.available(goodType) > 0
			? this.storage.reserve(goodType, 1, {
					type: 'pull',
					target,
				})
			: 0
	}
}
gameIsaTypes.alveolus = (value: any) => {
	return value instanceof Alveolus
}

export const inputBufferSize = 3
export const outputBufferSize = 2
export function multiplyGoodsQty(record: Partial<Record<GoodType, number>>, multiplier: number) {
	return Object.fromEntries(
		Object.entries(record).map(([goodType, quantity]) => [goodType, quantity * multiplier]),
	)
}

export const AlveolusArkType = type.instanceOf(Alveolus)
