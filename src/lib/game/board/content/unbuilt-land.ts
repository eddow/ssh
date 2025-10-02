import { effect, unreactive } from 'mutts/src'
import { Container, type ContainerChild, Sprite } from 'pixi.js'
import { deposits } from '$assets/game-content'
import type { TerrainType } from '$lib/arktype'
import type { Game } from '$lib/game/game'
import { tileSize } from '$lib/utils'
import { fastPoissonRandom } from '$lib/utils/poisson'
import { toAxialCoord } from '$lib/utils/position'
import { GameObject, withTicked } from '../../object'
import type { Tile } from '../tile'
import type { TileContent } from './content'
import { GcClassed, GcClasses } from './utils'

export class Deposit extends GcClassed<Ssh.DepositDefinition>() {
	static class = GcClasses(() => Deposit, deposits)
	constructor(public amount: number) {
		super()
	}
}

@unreactive('tile')
export class UnBuiltLand extends withTicked(GameObject) implements TileContent {
	get name() {
		return this.terrain
	}

	constructor(
		public readonly tile: Tile,
		public terrain: TerrainType,
		public deposit?: Deposit,
	) {
		const tileCoord = toAxialCoord(tile.position)
		super(tile.board.game, `unbuilt-${tileCoord.q}-${tileCoord.r}`)
	}

	update(deltaTime: number) {
		// Generate goods if this tile has a deposit with generation configuration
		if (!this.deposit) return

		const generation = this.deposit.generation
		if (!generation) return

		// Generate each good type based on its rate and deposit amount
		for (const [goodType, rate] of Object.entries(generation)) {
			const totalRate = (rate as number) * this.deposit.amount
			const lambda = totalRate * deltaTime

			// Use proper Poisson distribution for bursty generation
			const goodsToSpawn = fastPoissonRandom(lambda)

			// Spawn the calculated number of goods
			for (let i = 0; i < goodsToSpawn; i++) {
				this.generateGoodAtTile(goodType as any)
			}
		}
	}

	private generateGoodAtTile(goodType: string) {
		const tileCoord = toAxialCoord(this.tile.position)

		// Generate random point using triangular distribution
		const u = Math.random()
		const v = Math.random()

		const q = (u - v) * 0.5
		const r = v - 0.5

		const randomPos = {
			q: tileCoord.q + q,
			r: tileCoord.r + r,
		}

		// Create the free good
		this.tile.board.freeGoods.add(this.tile, goodType as any, randomPos)
	}

	get debugInfo() {
		return {
			type: 'UnBuiltLand',
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

		return root
	}

	canInteract(action: string): boolean {
		// UnBuiltLand can accept building actions
		if (action.startsWith('build:')) {
			// Can't build if there's a deposit
			if (this.deposit) return false

			// Can't build if there are FreeGoods on the tile (burdened tile)
			const coord = toAxialCoord(this.tile.position)
			const freeGoods = this.tile.board.freeGoods.getGoodsAt(coord)
			if (freeGoods.length > 0) return false

			return true
		}
		// Can also accept other actions if they make sense
		return false
	}
}
