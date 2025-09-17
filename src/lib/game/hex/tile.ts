import { type } from 'arktype'
import { effect, reactive, watch } from 'mutts'
import {
	ColorMatrixFilter,
	Container,
	type ContainerChild,
	Graphics,
	Point,
	Sprite,
	TilingSprite,
} from 'pixi.js'
import { deposits, goods, modules } from '$assets/game-content'
import type { GoodType, ModuleType, TerrainType } from '$lib/arktype'
import { mrg } from '$lib/globals.svelte'
import type { AxialCoord } from '$lib/hex'
import { tileSize } from '$lib/utils'
import type { Character } from '../character'
import type { Game } from '../game'
import { GameObject, withGenerator, withInteractive } from '../object'
import { type Position, toAxialCoord, toWorldCoord } from '../position'
import type { HexBoard } from './board'
import { gameIsaTypes } from '../npcs/scripts'

export interface TileContent {
	readonly tile: Tile
	// TODO: translate-> name = translation set on load
	readonly name?: string
	readonly debugInfo: Record<string, any>
	readonly walkTime: number
	readonly background: string
	/**
	 *
	 * @param goodType - The type of good to add
	 * @param qty - The quantity of good to add
	 * @returns The quantity of good that was added
	 */
	addGood(goodType: GoodType, qty: number): number
	/**
	 * Remove a good from the tile
	 * @param goodType - The type of good to remove
	 * @param qty - The quantity of good to remove
	 * @returns The quantity of good that was removed
	 */
	removeGood(goodType: GoodType, qty: number): number
	/**
	 * List the goods on the tile
	 * @returns A record of goods and their quantities
	 */
	get goods(): { [k in GoodType]?: number }
	/**
	 * Check if the tile can store a good
	 * @param goodType - The type of good to check
	 * @returns The quantity of good that can be stored
	 */
	canStoreGood(goodType: GoodType): number
	/**
	 * Render the tile
	 * @param tile - The tile to render
	 * @returns The container child to render
	 */
	render(tile: Tile): ContainerChild
	/**
	 * Check if this tile content can perform the given action
	 * @param action - The action to check
	 * @returns true if the action can be performed
	 */
	canInteract?(action: string): boolean
}

@reactive
export class Tile extends withInteractive(withGenerator(GameObject)) {
	get content(): TileContent | undefined {
		return this.hex.getTileContent(toAxialCoord(this.position))
	}
	set content(content: TileContent | undefined) {
		this.hex.setTileContent(toAxialCoord(this.position), content)
	}
	constructor(
		public readonly hex: HexBoard,
		coord: AxialCoord,
	) {
		super(hex.game, `hex-tile:${coord.q},${coord.r}`)
		this.position = coord
		// Set tile reference on content
	}
	readonly position: Position
	get tile(): Tile {
		return this
	}

	get title(): string {
		const axial = toAxialCoord(this.position)
		return `Tile ${axial.q}, ${axial.r}`
	}

	get debugInfo(): Record<string, any> {
		return {
			position: this.position,
			content: this.content?.debugInfo,
		}
	}

	canInteract(action: string): boolean {
		return this.content?.canInteract?.(action) ?? false
	}

	build(moduleType: ModuleType): boolean {
		if (!this.canInteract(`build:${moduleType}`)) {
			return false
		}
		const ModuleClass = Module.class[moduleType]
		if (!ModuleClass) return false
		const newModule = new ModuleClass(this)
		// Set tile reference on new content
		this.content = newModule
		return true
	}

	render() {
		if (!this.content) return
		const { background } = this.content
		const { position, game } = this
		const { x: wpx, y: wpy } = toWorldCoord(position)

		const tileContainer = new Container()
		tileContainer.position.set(wpx, wpy)

		const size = tileSize
		const texture = this.game.getTexture(background)
		const tileSprite = new TilingSprite({ texture, width: size * 2, height: size * 2 })
		tileSprite.anchor.set(0.5)
		tileSprite.tilePosition.set(-wpx % (texture.width || size), -wpy % (texture.height || size))

		const mask = new Graphics()
		const points = Array.from({ length: 6 }, (_, i) => {
			const angle = (Math.PI / 3) * (i + 0.5)
			return new Point(Math.cos(angle) * size, Math.sin(angle) * size)
		})
		mask.poly(points).fill(0xffffff)
		tileSprite.mask = mask
		const brightnessFilter = new ColorMatrixFilter()
		tileSprite.filters = [brightnessFilter]

		tileContainer.addChild(tileSprite, mask)
		game.backgroundLayer.addChild(tileContainer)
		watch(
			() => this.content,
			(content) => {
				if (!content) return
				const fg = content.render(this)
				const { x, y } = toWorldCoord(position)
				fg.position.set(x, y)
				game.objectLayer.addChild(fg as any)
				return () => {
					fg.destroy()
				}
			},
			{ immediate: true },
		)
		const mouseoverEffect = effect(() => {
			if (mrg.hoveredObject === this) {
				tileSprite.tint = 0xaaaaff
				brightnessFilter.brightness(1.2, false)
			} else {
				tileSprite.tint = 0xffffff
				brightnessFilter.brightness(1, false)
			}
		})
		this.game.backgroundLayer.addChild(tileContainer)
		return () => {
			mouseoverEffect()
			tileContainer.destroy({ children: false })
			this.game.backgroundLayer.removeChild(tileContainer)
		}
	}
}
export const TileType = type.instanceOf(Tile)
gameIsaTypes.tile = (value: any) => {
	return value instanceof Tile
}


//#region  Content
type Ctor<T extends object = any> = abstract new (...args: any[]) => T

function GcClass<BaseCtor extends Ctor<any>, TDef extends object>(
	Base: BaseCtor,
	name: string,
	def: TDef,
): BaseCtor {
	class Sub extends (Base as Ctor) {}
	Object.defineProperties(Sub, { name: { value: `${Base.name}<${name}>` } })
	Object.assign((Sub as any).prototype, def)
	return Sub as unknown as BaseCtor
}

function GcClasses<
	BaseCtor extends Ctor<any>,
	Entries extends Record<string, any> = Record<string, any>,
>(Base: BaseCtor, entries: Entries) {
	return Object.fromEntries(
		Object.entries(entries).map(([name, def]) => [name, GcClass(Base, name, def)]),
	) as { [K in keyof Entries]: BaseCtor }
}

function NoConstructor<T extends object>() {
	return class {} as new () => T
}

export class Deposit extends NoConstructor<Ssh.DepositDefinition>() {
	static class = GcClasses(Deposit, deposits)
	constructor(public amount: number) {
		super()
	}
}

export class Module extends NoConstructor<Ssh.ModuleDefinition>() implements TileContent {
	static class = GcClasses(Module, modules)
	constructor(public tile: Tile) {
		super()
	}
	public assignedWorker: Character | undefined
	public goods: { [k in GoodType]?: number } = {}

	// Configurable properties
	public walkway: boolean = true
	public conveyor: boolean = true

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
		const outputQty = this.goods[this.output as GoodType] || 0
		if (outputQty <= 0) return

		// Render output goods on the right side
		const maxDisplay = 6 // Maximum number of sprites to show
		const spritesToShow = Math.min(outputQty, maxDisplay)

		for (let i = 0; i < spritesToShow; i++) {
			const sprite = new Sprite(game.getTexture(goods[this.output].sprites[0]))

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
		if (outputQty > maxDisplay) {
			const plusSprite = new Sprite(game.getTexture(goods[this.output].sprites[0]))
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

	canInteract(action: string): boolean {
		// Modules can't be built on (they already exist)
		return false
	}
}

export class UnBuiltLand implements TileContent {
	public goodSlots: (GoodType | undefined)[]
	get name() {
		return this.terrain
	}
	constructor(
		public tile: Tile,
		goodsSlots: number = 3,
		public terrain: TerrainType,
		public deposit?: Deposit,
	) {
		this.goodSlots = new Array(goodsSlots).fill(undefined)
	}
	get goods() {
		return this.goodSlots.reduce(
			(acc, good) => {
				if (good) acc[good] = (acc[good] || 0) + 1
				return acc
			},
			{} as { [k in GoodType]?: number },
		)
	}
	canStoreGood(goodType: GoodType): number {
		return this.goodSlots.filter((good) => good === undefined).length
	}
	addGood(goodType: GoodType, qty: number) {
		let toAdd = qty
		for (let i = 0; i < this.goodSlots.length; i++) {
			if (this.goodSlots[i] === undefined) {
				this.goodSlots[i] = goodType
				if (!--toAdd) return qty
			}
		}
		return qty - toAdd
	}
	removeGood(goodType: GoodType, qty: number) {
		let toRemove = qty
		for (let i = 0; i < this.goodSlots.length; i++) {
			if (this.goodSlots[i] === goodType) {
				this.goodSlots[i] = undefined
				if (!--toRemove) return qty
			}
		}
		return qty - toRemove
	}
	get debugInfo() {
		return {
			goods: this.goodSlots.filter((good) => good !== undefined),
			terrain: this.terrain,
		}
	}
	get walkTime() {
		return this.terrain === 'water' ? Number.POSITIVE_INFINITY : 1
	}
	get background() {
		return `terrain-${this.terrain}`
	}

	render({ game }: Tile): ContainerChild {
		const size = tileSize
		const root = new Container()

		effect(() => {
			// Deposit sprite if any
			if (this.deposit?.sprites?.[0]) {
				const sprite = new Sprite(game.getTexture(this.deposit.sprites[0]))
				// match previous hex resize: scale to tile size
				const scale = Math.max(sprite.width, sprite.height) / (size * 1)
				sprite.scale.set(1 / scale)
				sprite.anchor.set(0.5)
				root.addChild(sprite)
				return () => sprite.destroy()
			}
		})

		effect(() => {
			// Goods rendering in triangular pattern
			const goodsSprites: Sprite[] = []
			for (let i = 0; i < this.goodSlots.length; i++) {
				const good = this.goodSlots[i]
				if (!good) continue
				const goodsSprite = new Sprite(game.getTexture(goods[good].sprites[0]))
				// scale small
				const scale = Math.max(goodsSprite.width, goodsSprite.height) / (size * 0.5)
				goodsSprite.scale.set(1 / scale)
				goodsSprite.anchor.set(0.5)
				// Position in triangular pattern (de-centered)
				const angle = (i * 2 * Math.PI) / 3
				const radius = size * 0.4
				const offsetX = Math.cos(angle) * radius
				const offsetY = Math.sin(angle) * radius
				goodsSprite.position.set(offsetX, offsetY)
				root.addChild(goodsSprite)
				goodsSprites.push(goodsSprite)
			}
			return () => {
				for (const sprite of goodsSprites) sprite.destroy()
			}
		})

		return root
	}

	canInteract(action: string): boolean {
		// UnBuiltLand can accept building actions
		if (action.startsWith('build:')) {
			return !this.deposit
		}
		// Can also accept other actions if they make sense
		return false
	}
}

//#endregion
