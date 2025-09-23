import { type } from 'arktype'
import { computed } from 'mutts'
import { Container, type ContainerChild, Sprite } from 'pixi.js'
import type { GoodType } from '$lib/arktype'
import { Complex } from '$lib/game/complex'
import type { Game } from '$lib/game/game'
import type { Job } from '$lib/game/job'
import { gameIsaTypes } from '$lib/game/npcs/utils'
import type { Character } from '$lib/game/population'
import { tileSize } from '$lib/utils'
import { type Storage, withStorageForwarder } from '../../../storage'
import { ModuleGate } from '../../border'
import type { Tile } from '../../tile'
import { type TileContent, UnBuiltLand } from '../index'
import { GcClassed } from '../utils'

export abstract class Module
	extends withStorageForwarder(GcClassed<Ssh.ModuleDefinition>())
	implements TileContent
{
	public assignedWorker: Character | undefined

	public declare complex: Complex
	// Configurable properties
	public walkway: boolean = true
	public conveyor: boolean = true

	constructor(
		public tile: Tile,
		storage: Storage<any>,
	) {
		super(storage)
		const complex = Complex.for(tile)
		complex.attach(this)
		for (const surrounding of this.tile.surroundings)
			surrounding.border.content = new ModuleGate(surrounding.border)
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
	get gates(): ModuleGate[] {
		return this.tile.surroundings
			.map((b) => b.border.content)
			.filter((b): b is ModuleGate => b instanceof ModuleGate)
	}

	// Render module sprite + a vertical goods bar on the right side of the tile
	render(game: Game): ContainerChild {
		const root = new Container()
		const size = tileSize
		// Module sprite (centered)
		if (this.sprites?.[0]) {
			const sprite = new Sprite(game.getTexture(this.sprites[0]))
			// approximate size scaling similar to hexboard
			const scale = Math.max(sprite.width, sprite.height) / (size * 1.5)
			sprite.scale.set(1 / scale)
			sprite.anchor.set(0.5)
			root.addChild(sprite)
		}

		return root
	}

	canInteract(_action: string): boolean {
		// Modules can't be built on (they already exist)
		return false
	}
	moduleSpecificJob?(): Job | undefined

	getJob(): Job | undefined {
		// perhaps carry/...
		return this.moduleSpecificJob?.()
	}

	protected getFatigueCost(): number {
		// Base fatigue based on action type
		const baseFatigue = this.action.type === 'harvest' ? this.workTime + 2 : this.workTime

		// Add time-based fatigue (if module has time configuration)
		// For now, just return base fatigue
		return baseFatigue
	}

	deconstruct() {
		this.tile.content = new UnBuiltLand(this.tile, 0, 'concrete')
		for (const gate of this.gates) gate.border.content = undefined
		this.complex.removeModule(this)
	}

	@computed
	get neighborModules(): Module[] {
		return this.tile.neighborTiles
			.map((neighbor) => neighbor?.content)
			.filter((c): c is Module => c instanceof Module)
	}

	pull(goodType: GoodType, target: Module): any {
		return goodType in this.output && this.storage.available(goodType) > 0
			? this.storage.reserve(goodType, 1, {
					type: 'pull',
					target,
				})
			: 0
	}
}
gameIsaTypes.module = (value: any) => {
	return value instanceof Module
}

export const inputBufferSize = 3
export const outputBufferSize = 2
export function multiplyGoodsQty(record: Partial<Record<GoodType, number>>, multiplier: number) {
	return Object.fromEntries(
		Object.entries(record).map(([goodType, quantity]) => [goodType, quantity * multiplier]),
	)
}

export const ModuleArkType = type.instanceOf(Module)
