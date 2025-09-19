import { Container, type ContainerChild, Sprite } from 'pixi.js'
import { transformModuleStorageMultiplier } from '$assets/constants'
import { modules } from '$assets/game-content'
import type { GoodType } from '$lib/arktype'
import type { Game } from '$lib/game/game'
import type { Job } from '$lib/game/job'
import { gameIsaTypes } from '$lib/game/npcs/utils'
import type { Character } from '$lib/game/population'
import { tileSize } from '$lib/utils'
import { type Storage, withStorageForwarder } from '../../storage'
import { NoStorage } from '../../storage/no-storage'
import { SpecificStorage } from '../../storage/specific-storage'
import type { Tile } from '../tile'
import type { TileContent } from './index'
import { GcClassed, GcClasses } from './utils'

export class Module
	extends withStorageForwarder(GcClassed<Ssh.ModuleDefinition>())
	implements TileContent
{
	static class = GcClasses(Module, modules)
	public assignedWorker: Character | undefined

	// Configurable properties
	public walkway: boolean = true
	public conveyor: boolean = true

	constructor(public tile: Tile) {
		let storage: Storage<any>
		if (new.target.prototype.action.type === 'transform') {
			const maxAmounts: { [k in GoodType]?: number } = {}
			for (const [goodType, inputAmount] of Object.entries(new.target.prototype.action.inputs)) {
				maxAmounts[goodType as GoodType] =
					(inputAmount as number) * transformModuleStorageMultiplier
			}
			storage = new SpecificStorage(maxAmounts)
		} else {
			storage = new NoStorage()
		}
		super(storage)
	}

	// Delegate storage methods to the appropriate storage type
	hasRoom(goodType: GoodType): number {
		return this.storage.hasRoom(goodType)
	}

	addGood(goodType: GoodType, qty: number): number {
		return this.storage.addGood(goodType, qty)
	}

	removeGood(goodType: GoodType, qty: number): number {
		return this.storage.removeGood(goodType, qty)
	}

	allocate(goodType: GoodType, qty: number, reason: any) {
		return this.storage.allocate(goodType, qty, reason)
	}
	reserve(goodType: GoodType, qty: number, reason: any) {
		return this.storage.reserve(goodType, qty, reason)
	}
	fulfill(allocation: any) {
		this.storage.fulfill(allocation)
	}
	cancel(allocation: any) {
		this.storage.cancel(allocation)
	}

	get goods(): { [k in GoodType]?: number } {
		return this.storage.goods
	}

	get debugInfo() {
		return {
			outputs: this.output,
			storage: (this.storage as any).debugInfo,
		}
	}

	renderGoods(game: any, size: number) {
		return this.storage.renderGoods(game, size)
	}
	get walkTime() {
		return this.walkway ? 1 : Number.POSITIVE_INFINITY
	}
	get background() {
		return 'concrete'
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

	// JobProvider implementation
	getJob(): Job | undefined {
		// If already assigned to a worker, no job available
		if (this.assignedWorker) return undefined

		// Check if module can perform its action based on available resources
		if (this.action.type === 'harvest') {
			// For harvesters, check if there are resources to harvest
			// For now, assume there are always resources available
			// TODO: check there is a deposit available in the working zone
			// (for now: around the module to a certain distance, 6?))
			// Use that information to calculate the fatigue
			return {
				type: this.action.type,
				fatigue: this.getFatigueCost(),
				urgency: 1,
			}
		} else if (this.action.type === 'transform') {
			// For transformers, check if we have required inputs
			const hasInputs = Object.entries(this.action.inputs || {}).every(([goodType, required]) => {
				return (this.goods[goodType as GoodType] || 0) >= (required as number)
			})

			if (hasInputs) {
				return {
					type: this.action.type,
					fatigue: this.getFatigueCost(),
					urgency: 1,
				}
			}
		}

		return undefined
	}

	private getFatigueCost(): number {
		// Base fatigue based on action type
		const baseFatigue = this.action.type === 'harvest' ? this.workTime + 2 : this.workTime

		// Add time-based fatigue (if module has time configuration)
		// For now, just return base fatigue
		return baseFatigue
	}
}
gameIsaTypes.module = (value: any) => {
	return value instanceof Module
}
