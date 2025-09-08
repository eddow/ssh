import { deposits, modules, goods, terrain } from "$assets/game-content"
import { Container, Graphics, Sprite, type ContainerChild } from "pixi.js"
import type { HexBoard, HexTile } from "./hexboard"
import type { Character } from "./character"
import type { Game } from "./game"
import { effect } from "mutts"

type Ctor<T extends object = any> = abstract new (...args: any[]) => T

export type TerrainType = keyof typeof terrain
export type GoodType = keyof typeof goods
export type DepositType = keyof typeof deposits
export type ModuleType = keyof typeof modules
export interface TileContent {
	name: string
	readonly debugInfo: Record<string, any>
	readonly walkTime: number
	readonly background: string
	addGood(goodType: GoodType, qty: number): number
	removeGood(goodType: GoodType, qty: number): number
	listGoods(): {[k in GoodType]?: number} 
	canStoreGood(goodType: GoodType): number
	render(tile: HexTile): ContainerChild
}

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

function GcClasses<BaseCtor extends Ctor<any>>(
	Base: BaseCtor,
	entries: Record<string, any>
) {
	return Object.fromEntries(Object.entries(entries).map(([name, def]) => [name, GcClass(Base, name, def)]))
}

export class Deposit implements Ssh.DepositDefinition {
	static class = GcClasses(Deposit, deposits)
	declare name: DepositType
	declare maxAmount: number
	declare sprites: string[]
	declare regenerate?: number
	declare terrain: string
	constructor(public amount: number) {}
}

export class Module implements Ssh.ModuleDefinition, TileContent {
	static class = GcClasses(Module, modules)
	declare name: ModuleType
	declare maxWorkers: number
	declare carryingCapacity: number
	declare restEase: number
	declare goodsCapacity: number
	declare action: Ssh.Action
	declare output: GoodType
	declare time: number
	declare sprites: string[]
	declare icon: string
	public assignedWorker: Character | undefined
	public goodsQty: number = 0
	constructor() {}

	listGoods(): {[k in GoodType]?: number} {
		return this.goodsQty <= 0 ? {} : { [this.output]: this.goodsQty }
	}
	canStoreGood(goodType: GoodType): number {
		return goodType === this.output ? this.goodsCapacity - this.goodsQty : 0
	}
	addGood(goodType: GoodType, qty: number) {
		if(goodType !== this.output) return qty
		const stored = this.canStoreGood(goodType)
		this.goodsQty += stored
		return qty - stored
	}
	removeGood(goodType: GoodType, qty: number) {
		if(goodType !== this.output) return qty
		const taken = Math.min(qty, this.goodsQty)
		this.goodsQty -= taken
		return qty - taken
	}
	get debugInfo() {
		return {
			outputs: this.output,
			goodsQty: this.goodsQty,
		}
	}
	get walkTime() {
		return Number.POSITIVE_INFINITY
	}
	get background() {
		return 'concrete'
	}

	// Render module sprite + a vertical goods bar on the right side of the tile
	render({ game, position }: HexTile): ContainerChild {
		const root = new Container()
		root.position.set(position.x, position.y)
		const size = game.hex.tileSize
		// Module sprite (centered)
		if (this.sprites && this.sprites[0]) {
			const sprite = new Sprite(game.getTexture(this.sprites[0]))
			// approximate size scaling similar to hexboard
			const scale = Math.max(sprite.width, sprite.height) / (size * 1.5)
			sprite.scale.set(1 / scale)
			sprite.anchor.set(0.5)
			root.addChild(sprite)
		}

		const g = new Graphics()
		const capacity = Math.max(1, this.goodsCapacity)
		const ratio = Math.min(1, Math.max(0, this.goodsQty / capacity))
		const height = (size * 0.9) * ratio
		const colorByGood: Partial<Record<GoodType, number>> = {
			wood: 0x8b5a2b,
			stone: 0x7a7a7a,
			planks: 0xc49a6c,
			berries: 0xb03060,
			mushrooms: 0x8a6f4e,
		}
		const color = colorByGood[this.output] ?? 0x4a90e2
		// Bar background (on the right side)
		const barX = size * 0.55
		const barW = Math.max(3, size * 0.12)
		const barH = size * 0.9
		g.rect(barX, -barH / 2, barW, barH).fill(0x222222)
		// Bar fill from bottom up
		if (height > 0) g.rect(barX, -barH / 2 + (barH - height), barW, height).fill(color)
		root.addChild(g)
		return root
	}
}

export class UnBuiltLand implements TileContent {
	public goods: (GoodType | undefined)[]
	get name() {
		return this.terrain
	}
	constructor(goodsSlots: number = 3, public terrain: TerrainType, public deposit?: Deposit) {
		this.goods = new Array(goodsSlots).fill(undefined)
	}
	listGoods() {
		return this.goods.reduce((acc, good) => {
			if (good)
				acc[good] = (acc[good] || 0) + 1
			return acc
		}, {} as {[k in GoodType]?: number} )
	}
	canStoreGood(goodType: GoodType): number {
		return this.goods.filter((good) => good === undefined).length
	}
	addGood(goodType: GoodType, qty: number) {
		for(let i = 0; i < this.goods.length; i++) {
			if(this.goods[i] === undefined) {
				this.goods[i] = goodType
				if(!--qty) return 0
			}
		}
		return qty
	}
	removeGood(goodType: GoodType, qty: number) {
		for(let i = 0; i < this.goods.length; i++) {
			if(this.goods[i] === goodType) {
				this.goods[i] = undefined
				if(!--qty) return 0
			}
		}
		return qty
	}
	get debugInfo() {
		return {
			goods: this.goods.filter((good) => good !== undefined),
			terrain: this.terrain,
		}
	}
	get walkTime() {
		return this.terrain === "water" ? Number.POSITIVE_INFINITY : 1
	}
	get background() {
		return `terrain-${this.terrain}`
	}

	render({ game, position }: HexTile): ContainerChild {
		const size = game.hex.tileSize
		const root = new Container()
		const { x: wpx, y: wpy } = position
		root.position.set(wpx, wpy)

		effect(() => {
			// Deposit sprite if any
			if (this.deposit && this.deposit.sprites && this.deposit.sprites[0]) {
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
			for (let i = 0; i < this.goods.length; i++) {
				const good = this.goods[i]
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
			return () => { for(const sprite of goodsSprites) sprite.destroy() }
		})

		return root
	}
}
