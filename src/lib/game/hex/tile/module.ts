import { Container, type ContainerChild, Sprite } from 'pixi.js'
import { goods, modules } from '$assets/game-content'
import type { GoodType } from '$lib/arktype'
import type { Character } from '$lib/game/character'
import type { Game } from '$lib/game/game'
import type { Job } from '$lib/game/job'
import { gameIsaTypes } from '$lib/game/npcs/utils'
import { tileSize } from '$lib/utils'
import type { Tile, TileContent } from './index'
import { GcClassed, GcClasses } from './utils'

//#region  Content

export class Module extends GcClassed<Ssh.ModuleDefinition>() implements TileContent {
	static class = GcClasses(Module, modules)
	public assignedWorker: Character | undefined
	public goods: { [k in GoodType]?: number } = {}

	// Configurable properties
	public walkway: boolean = true
	public conveyor: boolean = true

	constructor(public tile: Tile) {
		super()
	}

	canStoreGood(goodType: GoodType): number {
		const inputs = this.action.type === 'transform' ? this.action.inputs[goodType] || 0 : 0
		if (inputs <= 0) return 0
		return inputs - (this.goods[goodType] || 0)
	}
	addGood(goodType: GoodType, qty: number) {
		const stored = Math.min(qty, this.canStoreGood(goodType))
		if (stored <= 0) return 0
		this.goods[goodType] = (this.goods[goodType] || 0) + stored
		return stored
	}
	removeGood(goodType: GoodType, qty: number) {
		const taken = Math.min(qty, this.goods[goodType] || 0)
		if (taken <= 0) return 0
		this.goods[goodType] = this.goods[goodType]! - taken
		if (this.goods[goodType] === 0) delete this.goods[goodType]
		return taken
	}
	get debugInfo() {
		return {
			outputs: this.output,
			goods: this.goods,
		}
	}
	get walkTime() {
		return this.walkway ? 1 : Number.POSITIVE_INFINITY
	}
	get background() {
		return 'concrete'
	}

	// Render module sprite + a vertical goods bar on the right side of the tile
	render({ game }: Tile): ContainerChild {
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

		// Render individual good sprites
		this.renderGoodSprites(root, game, size)
		return root
	}
	// TODO: render side goods
	private renderGoodSprites(root: Container, game: Game, size: number) {
		// Use the imported goods definitions

		if (this.action.type === 'harvest') {
			// Harvesters: show output goods on the right
			this.renderOutputGoods(root, game, size, goods)
		} else if (this.action.type === 'transform') {
			// Transformers: show input goods on left, output goods on right
			this.renderInputGoods(root, game, size, goods)
			this.renderOutputGoods(root, game, size, goods)
		}
	}

	private renderInputGoods(root: Container, game: Game, size: number, goods: any) {
		if (this.action.type !== 'transform' || !this.action.inputs) return

		// Get all input good types and their required quantities
		const inputEntries = Object.entries(this.action.inputs) as [GoodType, number][]

		let spriteIndex = 0
		for (const [goodType, requiredQty] of inputEntries) {
			const storedQty = this.goods[goodType] || 0

			// Render sprites for this input good type
			for (let i = 0; i < requiredQty; i++) {
				const sprite = new Sprite(game.getTexture(goods[goodType].sprites[0]))

				// Scale sprite to fit nicely
				const spriteSize = size * 0.15
				const scale = Math.max(sprite.width, sprite.height) / spriteSize
				sprite.scale.set(1 / scale)
				sprite.anchor.set(0.5)

				// Position sprites on the left side in a grid
				const cols = 2
				const col = spriteIndex % cols
				const row = Math.floor(spriteIndex / cols)
				const spacing = size * 0.2
				const startX = -size * 0.4
				const startY = -size * 0.3

				sprite.position.set(startX + col * spacing, startY + row * spacing)

				// Color: filled sprites are normal, empty slots are grayed
				if (i < storedQty) {
					sprite.tint = 0xffffff // Normal color
				} else {
					sprite.tint = 0x666666 // Grayed out
				}

				root.addChild(sprite)
				spriteIndex++
			}
		}
	}

	private renderOutputGoods(root: Container, game: Game, size: number, goods: any) {
		// Get the first output good type and its quantity
		const outputEntries = Object.entries(this.output) as [string, number][]
		if (outputEntries.length === 0) return
		const [outputGoodType, outputQty] = outputEntries[0]
		const storedQty = this.goods[outputGoodType as GoodType] || 0
		if (storedQty <= 0) return

		// Render output goods on the right side
		const maxDisplay = 6 // Maximum number of sprites to show
		const spritesToShow = Math.min(outputQty, maxDisplay)

		for (let i = 0; i < spritesToShow; i++) {
			const sprite = new Sprite(game.getTexture(goods[outputGoodType].sprites[0]))

			// Scale sprite to fit nicely
			const spriteSize = size * 0.15
			const scale = Math.max(sprite.width, sprite.height) / spriteSize
			sprite.scale.set(1 / scale)
			sprite.anchor.set(0.5)

			// Position sprites on the right side in a grid
			const cols = 2
			const col = i % cols
			const row = Math.floor(i / cols)
			const spacing = size * 0.2
			const startX = size * 0.4
			const startY = -size * 0.3

			sprite.position.set(startX + col * spacing, startY + row * spacing)

			// Output goods are always colored normally
			sprite.tint = 0xffffff

			root.addChild(sprite)
		}

		// If there are more goods than we can display, show a "+" indicator
		if (storedQty > maxDisplay) {
			const plusSprite = new Sprite(game.getTexture(goods[outputGoodType].sprites[0]))
			const spriteSize = size * 0.15
			const scale = Math.max(plusSprite.width, plusSprite.height) / spriteSize
			plusSprite.scale.set(1 / scale)
			plusSprite.anchor.set(0.5)

			// Position the "+" indicator
			const cols = 2
			const col = maxDisplay % cols
			const row = Math.floor(maxDisplay / cols)
			const spacing = size * 0.2
			const startX = size * 0.4
			const startY = -size * 0.3

			plusSprite.position.set(startX + col * spacing, startY + row * spacing)

			// Make it semi-transparent to indicate "more"
			plusSprite.tint = 0x888888
			plusSprite.alpha = 0.7

			root.addChild(plusSprite)
		}
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
