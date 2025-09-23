import { effect } from 'mutts'
import { Container, type ContainerChild, Sprite } from 'pixi.js'
import { deposits } from '$assets/game-content'
import type { TerrainType } from '$lib/arktype'
import type { Game } from '$lib/game/game'
import { tileSize } from '$lib/utils'
import { SlottedStorage } from '../../storage/slotted-storage'
import type { Tile } from '../tile'
import type { TileContent } from './index'
import { GcClassed, GcClasses } from './utils'

export class Deposit extends GcClassed<Ssh.DepositDefinition>() {
	static class = GcClasses(() => Deposit, deposits)
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
	// TODO: effects should have a deallocation moment - manage the `destroy` chain
	render(game: Game): ContainerChild {
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

		root.addChild(this.renderGoods(game, size))

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
