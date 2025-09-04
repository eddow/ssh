import D from "flat-diamond"
import type { ScopedCallback } from "mutts"
import { Container, Graphics, Point, TilingSprite } from "pixi.js"
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
import { LCG, type RandGenerator } from "../numbers"
import type { Game } from "./game"

export interface Deposit extends Ssh.DepositDefinition {
	amount: number
}

export enum TerrainType {
	WATER = "water",
	GRASS = "grass",
	FOREST = "forest",
	ROCKY = "rocky",
}

export class HexTile extends D(InteractiveGameObject, GeneratorObject) {
	constructor(
		public readonly hex: HexBoard,
		//declare deposit?: Ssh.Deposit
		readonly coord: AxialCoord,

		public terrain: TerrainType,
	) {
		super(hex.game, `hex-tile-${coord.q}-${coord.r}`)
	}

	highlight(highlighted: boolean) {
		// TODO: Implement highlighting logic
		// This could change the tile's appearance, add a border, etc.
	}

	get worldPosition(): WorldCoord {
		return this.hex.axial2world(this.coord)
	}

	render(): Container[] {
		const { terrain } = this
		const { hex, worldPosition, game } = this
		const { x: wpx, y: wpy } = worldPosition

		// Container for this tile
		const tileContainer = new Container()
		tileContainer.position.set(wpx, wpy)

		// Create tiling sprite from terrain texture
		const size = hex.tileSize
		const texture = this.game.resources[`terrain-${terrain}`]
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

		return [tileContainer]
	}
	manage([tileContainer]: [Container]): ScopedCallback {
		this.game.backgroundLayer.addChild(tileContainer)
		return () => {
			// Cleanup
			for (const child of [...tileContainer.children]) child.destroy({ children: true })
			this.game.backgroundLayer.removeChild(tileContainer)
			tileContainer.destroy({ children: true })
		}
	}
}

export class HexBoard extends D(RenderableContainer, HittableGameObject) {
	private tiles: AxialKeyMap<HexTile>
	private rnd: RandGenerator

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
		this.rnd = LCG("hexboard-seed") // Use a constant seed for reproducibility
		this.generateBoard()
	}

	hitTest(worldX: number, worldY: number): InteractiveGameObject | false {
		const coord = this.world2axial({ x: worldX, y: worldY })
		if (axial.distance(coord, { q: 0, r: 0 }) > this.boardSize) return false
		return this.getTile(coord) ?? false
	}

	private generateBoard(): void {
		// Generate all tiles within the board radius
		for (const coord of axial.enum(this.boardSize - 1)) {
			const terrain = this.generateRandomTerrain(coord)
			const tile = new HexTile(this, coord, terrain)
			this.tiles.set(coord, tile)
		}
	}

	private generateRandomTerrain(coord: { q: number; r: number }): TerrainType {
		// Create some randomness based on position for more interesting generation
		const distance = axial.distance(coord)
		const angle = Math.atan2(coord.r, coord.q)

		// Use the reproducible random generator for consistent randomness
		const random = this.rnd()

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
			return TerrainType.WATER
		} else if (random < waterChance + grassChance) {
			return TerrainType.GRASS
		} else if (random < waterChance + grassChance + forestChance) {
			return TerrainType.FOREST
		} else {
			return TerrainType.ROCKY
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
