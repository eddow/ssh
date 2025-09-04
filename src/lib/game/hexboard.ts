import D from "flat-diamond"
import { effect, Reactive, unwrap } from "mutts"
import { Container, Graphics, Point, Sprite, TilingSprite } from "pixi.js"
import { deposits } from "$assets/game-content"
import {
	GeneratorObject,
	HittableGameObject,
	InteractiveGameObject,
	RenderableContainer,
} from "$lib/game/object"
import {
	type Axial,
	type AxialCoord,
	type AxialRef,
	axial,
	cartesian,
	fromCartesian,
	type WorldCoord,
} from "../axial"
import { AxialKeyMap } from "../mem"
import { LCG } from "../numbers"
import type { Game } from "./game"
import { mrg } from "$lib/globals.svelte"

export interface Deposit extends Ssh.DepositDefinition {
	amount: number
}

export type TerrainType = 'water' | 'grass' | 'forest' | 'rocky'

export class HexTile extends Reactive(D(InteractiveGameObject, GeneratorObject)) {
	constructor(
		public readonly hex: HexBoard,
		public deposit: Deposit | undefined,
		readonly coord: AxialCoord,

		public terrain: TerrainType,
	) {
		super(hex.game, `hex-tile-${coord.q}-${coord.r}`)
	}

	get title(): string {
		return `Tile ${this.coord.q}, ${this.coord.r}`
	}

	get debugInfo(): Record<string, any> {
		const info: any = {
			terrain: this.terrain,
		}
		if (this.deposit) {
			info[this.deposit.name] = this.deposit.amount
		}
		return info
	}

	get walkable(): number {
		return this.terrain === 'water' ? 0 : 1
	}

	get worldPosition(): WorldCoord {
		return this.hex.axial2world(this.coord)
	}

	render = () => {
		const { terrain } = this
		const { hex, worldPosition, game } = this
		const { x: wpx, y: wpy } = worldPosition

		// Container for this tile
		const tileContainer = new Container()
		tileContainer.position.set(wpx, wpy)

		// Create tiling sprite from terrain texture
		const size = hex.tileSize
		const texture = this.game.getTexture(`terrain-${terrain}`)
		const tileSprite = new TilingSprite({ texture, width: size * 2, height: size * 2 })
		tileSprite.anchor.set(0.5)
		// Align tile offset so it scrolls seamlessly with world
		tileSprite.tilePosition.set(-wpx % (texture.width || size), -wpy % (texture.height || size))

		// Hex mask
		const mask = new Graphics()
		const points = Array.from({ length: 6 }, (_, i) => {
			const angle = (Math.PI / 3) * (i + 0.5)
			return new Point(Math.cos(angle) * size, Math.sin(angle) * size)
		})
		mask.poly(points).fill(0xffffff)
		tileSprite.mask = mask

		tileContainer.addChild(tileSprite, mask)
		game.backgroundLayer.addChild(tileContainer)
		const depositEffect = effect(() => {
			if (this.deposit) {
				const depositSprite = new Sprite(game.getTexture(this.deposit.sprites[0]))
				depositSprite.position.set(wpx, wpy)
				game.objectLayer.addChild(depositSprite)
			}
		})
		const mouseoverEffect = effect(() => {
			if (mrg.hoveredObject === this) {
				tileSprite.tint = 0xaaaaff
			} else {
				tileSprite.tint = 0xffffff
			}
		})
		this.game.backgroundLayer.addChild(tileContainer)
		return () => {
			depositEffect()
			mouseoverEffect()
			for (const child of [...tileContainer.children]) child.destroy({ children: true })
			this.game.backgroundLayer.removeChild(tileContainer)
			tileContainer.destroy({ children: true })
		}
	}
}

export class HexBoard extends D(RenderableContainer, HittableGameObject) {
	private tiles: AxialKeyMap<HexTile>

	axial2world(coord: AxialRef): WorldCoord {
		return cartesian(coord, this.tileSize)
	}

	world2axial(world: WorldCoord): AxialCoord {
		return axial.round(fromCartesian(world, this.tileSize))
	}

	constructor(
		public game: Game,
		public readonly boardSize: number = 12,
		public readonly tileSize: number = 30,
	) {
		super(game, "hexboard")
		this.tiles = new AxialKeyMap()
		this.generateBoard()
	}

	hitTest = (worldX: number, worldY: number): InteractiveGameObject | false => {
		const coord = this.world2axial({ x: worldX, y: worldY })
		if (axial.distance(coord, { q: 0, r: 0 }) > this.boardSize) return false
		return this.getTile(coord) ?? false
	}

	private generateBoard(): void {
		// Generate all tiles within the board radius
		for (const coord of axial.enum(this.boardSize - 1)) {
			const seed = axial.access(coord).key
			const terrain = this.generateRandomTerrain(seed, coord)
			const deposit = this.generateRandomDeposit(seed, terrain)
			const tile = new HexTile(this, deposit, coord, terrain)
			this.tiles.set(coord, tile)
		}
	}
	private generateRandomDeposit(seed: number, terrain: TerrainType): Deposit | undefined {
		const rnd = LCG(`deposit+${seed}`)
		function genDeposit(type: Ssh.DepositDefinition, chance: number) {
			if (rnd() < chance)
				return Object.setPrototypeOf(
					{
						amount: Math.floor(((1 + rnd() * 2) * type.maxAmount) / 3),
					},
					type,
				)
		}
		switch (terrain) {
			case 'water':
				return undefined
			case 'forest':
				return genDeposit(deposits.tree, 0.7)
			case 'rocky': {
				return genDeposit(deposits.rock, 0.6)
			}
			case 'grass':
				return genDeposit(deposits.berry_bush, 0.1)
		}
	}

	private generateRandomTerrain(seed: number, coord: AxialCoord): TerrainType {
		const rnd = LCG(`deposit-${seed}`)
		// Create some randomness based on position for more interesting generation
		const distance = axial.distance(coord)
		const angle = Math.atan2(coord.r, coord.q)

		// Use the reproducible random generator for consistent randomness
		const random = rnd()

		// Adjust probabilities based on distance from center
		let waterChance = 0.15
		let grassChance = 0.45
		let forestChance = 0.25
		let rockyChance = 0.15

		// More water near edges
		if (distance > this.boardSize * 0.7) {
			waterChance += 0.2
			grassChance -= 0.1
			forestChance -= 0.05
			rockyChance -= 0.05
		}

		// More rocky terrain in certain angular regions
		if (Math.abs(angle) < Math.PI / 6 || Math.abs(angle - Math.PI) < Math.PI / 6) {
			rockyChance += 0.1
			grassChance -= 0.05
			forestChance -= 0.05
		}

		// Normalize probabilities
		const total = waterChance + grassChance + forestChance + rockyChance
		waterChance /= total
		grassChance /= total
		forestChance /= total
		rockyChance /= total

		// Determine terrain based on random value and probabilities
		if (random < waterChance) {
			return 'water'
		} else if (random < waterChance + grassChance) {
			return 'grass'
		} else if (random < waterChance + grassChance + forestChance) {
			return 'forest'
		} else {
			return 'rocky'
		}
	}

	// Public methods
	getTile(coord: AxialRef): HexTile | undefined {
		return this.tiles.get(coord)
	}

	setTile(coord: AxialRef, tile: HexTile): void {
		this.tiles.set(coord, tile)
	}

	hasTile(coord: AxialRef): boolean {
		return this.tiles.has(coord)
	}

	getTileCount(): number {
		return this.tiles.size
	}

	*getAllTiles(): Iterable<[Axial, HexTile]> {
		for (const [key, tile] of this.tiles) {
			const coord = axial.keyAccess(key)
			yield [coord, tile]
		}
	}

	// Get neighbors of a tile
	getNeighbors(coord: AxialRef): Array<[AxialRef, HexTile | undefined]> {
		const neighbors = axial.neighbors(coord)
		return neighbors.map((neighbor: AxialRef) => [neighbor, this.getTile(neighbor)])
	}

	// Check if a coordinate is within the board bounds
	isWithinBounds(coord: AxialRef): boolean {
		const { q, r } = axial.coord(coord)
		return axial.distance({ q, r }) < this.boardSize
	}
}
