import { type ScopedCallback, unreactive } from 'mutts/src'
import { Sprite } from 'pixi.js'
import { deposits } from '$assets/game-content'
import { namedEffect } from '$lib/debug'
import type { TerrainType } from '$lib/types'
import { tileSize } from '$lib/utils'
import { fastPoissonRandom } from '$lib/utils/poisson'
import { toAxialCoord, toWorldCoord } from '$lib/utils/position'
import { withTicked } from '../../object'
import type { Tile } from '../tile'
import { TileContent } from './content'
import { GcClassed, GcClasses } from './utils'

export class Deposit extends GcClassed<Ssh.DepositDefinition>() {
	static class = GcClasses(() => Deposit, deposits)
	constructor(public amount: number) {
		super()
	}
}

@unreactive('tile')
export class UnBuiltLand extends withTicked(TileContent) {
	/** Project identifier (e.g., "build:sawmill") indicating pending construction */
	public project?: string

	get name() {
		return this.terrain
	}
	get storage() {
		return undefined
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

	/**
	 * Provide jobs for construction project
	 */
	getJob(): any {
		if (!this.project) return undefined

		// If there are free goods on the tile, provide offload job
		if (this.tile.availableGoods.length > 0) {
			return {
				job: 'offload',
				fatigue: 1,
				urgency: 15,
			}
		}

		// Note: Foundation jobs are provided by engineer alveolus, not by UnBuiltLand
		return undefined
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

	/**
	 * Override colorCode to show pink tint/border when there's a project
	 */
	colorCode(): { tint: number; borderColor?: number } {
		return this.project
			? { tint: 0xffb4d9, borderColor: 0xff1493 } // pinkish tint, deep pink border
			: super.colorCode()
	}

	render(): ScopedCallback | undefined {
		const size = tileSize
		const worldPos = toWorldCoord(this.tile.position)
		const cleanups: ScopedCallback[] = []

		// Render the tile background first
		cleanups.push(this.renderBackground())

		// Deposit sprite if any (reactive effect)
		const depositCleanup = namedEffect('unbuilt.render', () => {
			// Deposit sprite only if deposit exists, has sprites, and has resources remaining
			if (this.deposit?.sprites?.[0] && this.deposit.amount > 0) {
				const sprite = new Sprite(this.game.getTexture(this.deposit.sprites[0]))
				// match previous hex resize: scale to tile size
				const scale = Math.max(sprite.width, sprite.height) / (size * 1)
				sprite.scale.set(1 / scale)
				sprite.anchor.set(0.5)
				sprite.position.set(worldPos.x, worldPos.y)
				this.game.alveoliLayer.addChild(sprite)

				return () => {
					this.game.alveoliLayer.removeChild(sprite)
					sprite.destroy()
				}
			}
		})
		cleanups.push(depositCleanup)

		return () => {
			for (const cleanup of cleanups) cleanup()
		}
	}

	canInteract(action: string): boolean {
		// UnBuiltLand can accept building actions
		if (action.startsWith('build:')) {
			return true
		}
		// UnBuiltLand can accept zoning actions
		if (action.startsWith('zone:')) {
			return true
		}
		// Can also accept other actions if they make sense
		return false
	}
}
