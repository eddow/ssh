import { computed, effect } from 'mutts'
import { Container, type ContainerChild, Sprite } from 'pixi.js'
import { deposits, goods } from '$assets/game-content'
import type { GoodType, TerrainType } from '$lib/arktype'
import { tileSize } from '$lib/utils'
import type { TileContent } from './index'
import type { Tile } from '../tile'
import { GcClassed, GcClasses } from './utils'
import { SlottedStorage } from '../../storage/slotted-storage'

export class Deposit extends GcClassed<Ssh.DepositDefinition>() {
	static class = GcClasses(Deposit, deposits)
	constructor(public amount: number) {
		super()
	}
}

export class UnBuiltLand extends SlottedStorage implements TileContent {
	get name() {
		return this.terrain
	}
	constructor(
		public tile: Tile,
		goodsSlots: number = 3,
		public terrain: TerrainType,
		public deposit?: Deposit,
	) {
		super(goodsSlots, 1) // goodsSlots slots, 1 good per slot
	}
	get debugInfo() {
		return {
			...super.debugInfo,
			terrain: this.terrain,
			deposit: this.deposit?.amount,
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
			for (let i = 0; i < this.slots.length; i++) {
				const slot = this.slots[i]
				if (!slot || slot.quantity === 0) continue
				const goodsSprite = new Sprite(game.getTexture(goods[slot.goodType].sprites[0]))
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
