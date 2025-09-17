import { effect } from 'mutts'
import { Container, type ContainerChild, Sprite } from 'pixi.js'
import { deposits, goods } from '$assets/game-content'
import type { GoodType, TerrainType } from '$lib/arktype'
import { tileSize } from '$lib/utils'
import type { Tile, TileContent } from './index'
import { NoConstructor, GcClasses } from './utils'

export class Deposit extends NoConstructor<Ssh.DepositDefinition>() {
	static class = GcClasses(Deposit, deposits)
	constructor(public amount: number) {
		super()
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
