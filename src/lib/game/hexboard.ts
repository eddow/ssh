import type Phaser from "phaser"
import type Board from "phaser3-rex-plugins/plugins/board/board/LogicBoard"
import type { TileXYType, WorldXYType } from "phaser3-rex-plugins/plugins/board/types/Position"
import EventEmitter from "phaser3-rex-plugins/plugins/utils/eventemitter/EventEmitter"
import { Eventful } from "$lib/events"
import { type AxialCoord, type AxialRef, axial } from "../axial"
import { AxialKeyMap } from "../mem"
import { LCG, type RandGenerator } from "../numbers"
import type { LevelScene } from "./game"

export enum TerrainType {
	WATER = "water",
	GRASS = "grass",
	FOREST = "forest",
	ROCKY = "rocky",
}

export interface HexTile {
	terrain: TerrainType
	textureOffset: { x: number; y: number }

	// Future properties can be added here like elevation, resources, etc.
}
const stagger = {
	staggeraxis: "x",
	staggerindex: "odd",
} as const

export function preloadTerrains(scene: LevelScene) {
	scene.load.image("terrain-water", "assets/terrain/water.jpg")
	scene.load.image("terrain-grass", "assets/terrain/grass.jpg")
	scene.load.image("terrain-forest", "assets/terrain/forest.jpg")
	scene.load.image("terrain-rocky", "assets/terrain/stone.jpg")
	scene.load.atlas("objects", "assets/objects/bushes.png", "assets/objects/bushes.json")
	scene.load.atlas("objects", "assets/objects/trees.png", "assets/objects/trees.json")
	scene.load.atlas("objects", "assets/objects/rocks.png", "assets/objects/rocks.json")
}

export function cubic2offset(coord: AxialRef): TileXYType {
	const { q, r } = axial.access(coord)
	return {
		x: q + (r - (r & 1)) / 2,
		y: r,
	}
}

export function offset2cubic(xy: TileXYType): AxialCoord {
	const { x, y } = xy
	return {
		q: x - (y - (y & 1)) / 2,
		r: y,
	}
}

export class HexBoard extends Eventful<{
	tileClick: (pointer: any, coord: AxialCoord) => void
	tileUp: (pointer: any, coord: AxialCoord) => void
	tileOver: (pointer: any, coord: AxialCoord) => void
	tileOut: (pointer: any, coord: AxialCoord) => void
	gameobjectClick: (pointer: any, coord: AxialCoord) => void
}> {
	private tiles: AxialKeyMap<HexTile>
	private size: number
	private board: Board
	private randomGenerator: RandGenerator

	axial2world(coord: AxialRef) {
		const { x, y } = cubic2offset(coord)
		return this.board.tileXYToWorldXY(x, y)
	}
	world2axial(world: WorldXYType) {
		const { x, y } = world
		return offset2cubic({ x, y })
	}
	constructor(scene: LevelScene, size: number = 6) {
		super()
		this.size = size
		this.tiles = new AxialKeyMap()
		this.randomGenerator = LCG("hexboard-seed") // Use a constant seed for reproducibility
		this.generateBoard()

		const tileForward = (event: string) => {
			return (pointer: any, xy: any) => {
				const coord = offset2cubic(xy)
				if (this.hasTile(coord)) this.emit(event as any, pointer, coord)
			}
		}
		this.board = scene.rexBoard.add
			.board({
				grid: {
					gridType: "hexagonGrid",
					x: 60,
					y: 60,
					size: 30,
					...stagger,
				},
				infinity: true,
			})
			.setInteractive()
			.on("tiledown", tileForward("tileClick"))
			.on("tileup", tileForward("tileUp"))
			.on("tileover", tileForward("tileOver"))
			.on("tileout", tileForward("tileOut"))
			.on("gameobjectdown", (_pointer: any, _gameObject: any) => {
				debugger
			})
		for (const coord of this.tiles.coords()) {
			const tile = this.tiles.get(coord)!

			// Get hexagonal tile points
			const gridPoints = this.board.getGridPoints(cubic2offset(coord), true)

			// Create hexagonal tile filled with texture
			const textureKey = `terrain-${tile.terrain}`
			const worldXY = this.axial2world(coord)

			// Create a regular image that will be masked to hexagon shape
			const texture = scene.add.image(worldXY.x, worldXY.y, textureKey)
			texture.setOrigin(0.5)

			// Create a mask in the shape of the hexagon
			const maskGraphics = scene.add.graphics()
			maskGraphics.fillPoints(gridPoints, true, true)
			const mask = maskGraphics.createGeometryMask()
			texture.setMask(mask)

			// Apply texture offset by adjusting the texture position
			const offsetX = tile.textureOffset.x * 50 // Adjust scale as needed
			const offsetY = tile.textureOffset.y * 50
			texture.setPosition(worldXY.x + offsetX, worldXY.y + offsetY)
		}
	}

	private generateBoard(): void {
		// Generate all tiles within the board radius
		for (const coord of axial.enum(this.size - 1)) {
			const terrain = this.generateRandomTerrain(coord)
			const textureOffset = {
				x: this.randomGenerator(),
				y: this.randomGenerator(),
			}
			this.tiles.set(coord, {
				terrain,
				textureOffset,
			})
		}
	}

	private generateRandomTerrain(coord: { q: number; r: number }): TerrainType {
		// Create some randomness based on position for more interesting generation
		const distance = axial.distance(coord)
		const angle = Math.atan2(coord.r, coord.q)

		// Use the reproducible random generator for consistent randomness
		const random = this.randomGenerator()

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

	*getAllTiles(): Iterable<[{ q: number; r: number }, HexTile]> {
		for (const [key, tile] of this.tiles) {
			const coord = axial.keyAccess(key)
			yield [{ q: coord.q, r: coord.r }, tile]
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
}
