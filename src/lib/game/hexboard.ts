import { AxialKeyMap } from "../mem"
import { axial, type Axial, type AxialCoord, type AxialRef } from "../axial"
import type Board from "phaser3-rex-plugins/plugins/board/board/LogicBoard"
import type { TileXYType, WorldXYType } from "phaser3-rex-plugins/plugins/board/types/Position"
import type { LevelScene } from "./game"
import Phaser from "phaser"
import EventEmitter from "phaser3-rex-plugins/plugins/utils/eventemitter/EventEmitter"

export enum TerrainType {
	WATER = "water",
	GRASS = "grass", 
	FOREST = "forest",
	ROCKY = "rocky"
}

export interface HexTile {
	terrain: TerrainType
	// Future properties can be added here like elevation, resources, etc.
}
const stagger = {
	staggeraxis: 'x',
	staggerindex: 'odd'
} as const

export function cubic2offset(coord: AxialRef): TileXYType {
	const {q, r} = axial.access(coord)
	return {
		x: q + (r - (r & 1)) / 2,
		y: r
	}
}

export function offset2cubic(xy: TileXYType): AxialCoord {
	const {x, y} = xy
	return {
		q: x - (y - (y & 1)) / 2,
		r: y
	}
}

export class HexBoard extends EventEmitter {
	private tiles: AxialKeyMap<HexTile>
	private size: number
	private board: Board
	private graphics: Phaser.GameObjects.Graphics
	
	axial2world(coord: AxialRef) {
		const {x, y} = cubic2offset(coord)
		return this.board.tileXYToWorldXY(x, y)
	}
	world2axial(world: WorldXYType) {
		const {x, y} = world
		return offset2cubic({x, y})
	}
	constructor(scene: LevelScene, size: number = 6) {
		super()
		this.size = size
		this.tiles = new AxialKeyMap()
		this.generateBoard()

		const tileForward = (event: string) => {
			return (pointer: any, xy: any) => {
				const coord = offset2cubic(xy)
				if(this.hasTile(coord))
					this.emit(event, pointer, coord)
			}
		}
		this.board = scene.rexBoard.add.board({
			grid: {
				gridType: 'hexagonGrid',
				x: 60,
				y: 60,
				size: 30,
				...stagger
			},
			infinity: true
		})
			.setInteractive()
			.on('tiledown', tileForward('tile-click'))
			.on('tileup', tileForward('tile-up'))
			.on('tileover', tileForward('tile-over'))
			.on('tileout', tileForward('tile-out'))
			.on('gameobjectdown', (pointer: any, gameObject: any) => {
				debugger
			})

		
		const graphics = scene.add.graphics({
			lineStyle: {
				width: 2,
				color: 0xffffff,
				alpha: 1
			}
		});
		this.graphics = graphics
		for (const coord of this.tiles.coords()) {
			graphics.strokePoints(this.board.getGridPoints(cubic2offset(coord), true), true);
			const worldXY = this.axial2world(coord);
			scene.add.text(worldXY.x, worldXY.y, `${coord.q},${coord.r}`).setOrigin(0.5);
		}
	}

	private generateBoard(): void {
		// Generate all tiles within the board radius
		for (const coord of axial.enum(this.size - 1)) {
			const terrain = this.generateRandomTerrain(coord)
			this.tiles.set(coord, { terrain })
		}
	}

	private generateRandomTerrain(coord: { q: number; r: number }): TerrainType {
		// Create some randomness based on position for more interesting generation
		const distance = axial.distance(coord)
		const angle = Math.atan2(coord.r, coord.q)
		
		// Use a simple hash of coordinates for consistent randomness
		const hash = this.hashCoordinates(coord.q, coord.r)
		const random = (hash % 1000) / 1000
		
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

	private hashCoordinates(q: number, r: number): number {
		// Simple hash function for consistent randomness
		return ((q * 73856093) ^ (r * 19349663)) >>> 0
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
