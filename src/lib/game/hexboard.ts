import { resources } from "$assets/game-content"
import { ContainerClass, renderEffect, SelectableGameObject } from "$lib/game/object"
import {
	type Axial,
	type AxialCoord,
	type AxialRef,
	axial,
	cartesian,
	fromCartesian,
	pointInHex,
	type WorldCoord,
} from "../axial"
import { AxialKeyMap } from "../mem"
import { LCG, type RandGenerator } from "../numbers"
import type { Game, LevelScene } from "./game"

export enum TerrainType {
	WATER = "water",
	GRASS = "grass",
	FOREST = "forest",
	ROCKY = "rocky",
}

function prototyped<T extends object, U extends object>(object: T, prototype: U): T & U {
	return Object.setPrototypeOf(object, prototype)
}
export class HexTile extends SelectableGameObject {
	constructor(public readonly hex: HexBoard) {
		super(hex.game)
	}

	highlight(highlighted: boolean) {
		// TODO: Implement highlighting logic
		// This could change the tile's appearance, add a border, etc.
	}

	/**
	 * Test if a world point is inside this hexagonal tile
	 * @param worldX - World X coordinate
	 * @param worldY - World Y coordinate
	 * @returns true if the point is inside the hexagon
	 */
	hitTest(worldX: number, worldY: number): SelectableGameObject | false {
		return pointInHex({ x: worldX, y: worldY }, this.coord, this.hex.tileSize) && this
	}

	private maskGraphics?: Phaser.GameObjects.Graphics
	get worldPosition(): WorldCoord {
		return this.hex.axial2world(this.coord)
	}
	get uid(): string {
		return `tile.${axial.access(this.coord).key}`
	}
	render(scene: Phaser.Scene) {
		const { terrain } = this
		const { hex, worldPosition } = this
		const { x: wpx, y: wpy } = worldPosition
		const textureKey = `terrain-${terrain}`

		// Use TileSprite so the texture repeats seamlessly
		const size = hex.tileSize
		const tile = scene.add.tileSprite(wpx, wpy, size * 2, size * 2, textureKey)
		tile.setOrigin(0.5)
		const src = scene.textures.get(textureKey).getSourceImage() as HTMLImageElement
		const texW = src?.width ?? tile.width
		const texH = src?.height ?? tile.height
		tile.tilePositionX = wpx % texW
		tile.tilePositionY = wpy % texH

		// Create a hex mask centered on the tile
		const maskGraphics = scene.add.graphics(this.worldPosition)
		this.maskGraphics = maskGraphics
		const points = Array.from({ length: 6 }, (_, i) => {
			const angle = (Math.PI / 3) * (i + 0.5)
			return new Phaser.Math.Vector2(Math.cos(angle) * size, Math.sin(angle) * size)
		})
		maskGraphics.fillPoints(points, true, true)
		const mask = maskGraphics.createGeometryMask()
		tile.setMask(mask)
		tile.on("destroy", () => {
			this.maskGraphics?.destroy()
			this.maskGraphics = undefined
		})
		return maskGraphics
	}
	root(props: {
		terrain: TerrainType
		squares: number
		coord: AxialCoord
	}): HexTile {
		return prototyped(props, this)
	}
	declare terrain: TerrainType
	declare squares: number
	declare deposit?: Ssh.Deposit
	declare coord: AxialCoord
	// Future properties can be added here like elevation, resources, etc.
}

export function preloadTerrains(scene: LevelScene) {
	for (const [name, spec] of Object.entries(resources)) {
		if (spec.atlas) {
			scene.load.atlas(name, spec.file, spec.atlas)
		} else {
			scene.load.image(name, spec.file)
		}
	}
}

export class HexBoard extends ContainerClass {
	private tiles: AxialKeyMap<HexTile>
	private size: number
	private rnd: RandGenerator
	private rootTile: HexTile
	public readonly tileSize: number = 30
	// TODO: check if uid and worldPosition are needed (they are not) and how to restructure
	get uid(): string {
		return "hexboard"
	}

	get worldPosition(): WorldCoord {
		return { x: 0, y: 0 } // Board is centered at origin
	}

	axial2world(coord: AxialRef): WorldCoord {
		return cartesian(coord, this.tileSize)
	}
	world2axial(world: WorldCoord): AxialCoord {
		return axial.round(fromCartesian(world, this.tileSize))
	}
	constructor(
		public game: Game,
		size: number = 12,
	) {
		super(game)
		this.rootTile = new HexTile(this)
		this.size = size
		this.tiles = new AxialKeyMap()
		this.rnd = LCG("hexboard-seed") // Use a constant seed for reproducibility
		this.generateBoard()
	}

	hitTest(worldX: number, worldY: number): SelectableGameObject | false {
		const coord = this.world2axial({ x: worldX, y: worldY })
		if(axial.distance(coord, { q: 0, r: 0 }) > this.size) return false
		return this.getTile(coord) ?? false
	}

	private generateBoard(): void {
		const { rnd } = this
		// Generate all tiles within the board radius
		for (const coord of axial.enum(this.size - 1)) {
			const terrain = this.generateRandomTerrain(coord)
			const tile = this.rootTile.root({
				terrain,
				squares: Math.floor(rnd(2)),
				coord,
			})
			this.tiles.set(coord, tile)
		}
		// Register the board itself with the game, not individual tiles
		this.game.register(this)
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
		if (distance > this.size * 0.7) {
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

	getSize(): number {
		return this.size
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
		return axial.distance({ q, r }) < this.size
	}

	/**
	 * Render the hex board as a container with all tiles as children
	 */
	render(scene: Phaser.Scene): Phaser.GameObjects.Container {
		// Create the main container
		this.container = scene.add.container(0, 0)

		// Render all tiles and add them to the container
		for (const [_coord, tile] of this.getAllTiles()) {
			const renderedTile = tile.render(scene)
			this.container.add(renderedTile)
		}

		return this.container
	}

	// Draw squares on tiles that have them
	drawSquares(scene: LevelScene): void {
		for (const [coord, tile] of this.getAllTiles()) {
			renderEffect(
				() => !!tile.squares && scene.add.graphics(),
				(graphics) => {
					const worldPos = this.axial2world(coord)
					graphics.clear()
					graphics.fillStyle(0x00ff00, 0.8) // Green with some transparency
					graphics.fillRect(worldPos.x - 5, worldPos.y - 5, 10, 10)
				},
			)
		}
	}
}
