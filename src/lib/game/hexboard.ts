import D from "flat-diamond"
import { effect, Reactive, reactive, watch, type ScopedCallback } from "mutts"
import { ColorMatrixFilter, Container, Graphics, Point, Sprite, TilingSprite } from "pixi.js"
import { modules, deposits, terrain as terrainChances } from "$assets/game-content"
import {
	GeneratorObject,
	HittableGameObject,
	InteractiveGameObject,
	RenderableContainer,
} from "$lib/game/object"
import { mrg } from "$lib/globals.svelte"
import {
	type AxialCoord,
	type AxialRef,
	axial,
	cartesian,
	findNearest,
	findPath,
	fromCartesian,
	type NeighborInfo,
	type WorldCoord,
	type IsGoal,
	PerlinTerrainGenerator,
	DEFAULT_TERRAIN_CONFIG,
} from "../hex"
import { AxialKeyMap } from "../mem"
import type { Game } from "./game"
import { Module, Deposit, UnBuiltLand, type TileContent, type TerrainType } from "./tile"
// TODO: check container.cacheAsTexture() for background

export class HexTile extends Reactive(D(InteractiveGameObject, GeneratorObject)) {
	constructor(
		public readonly hex: HexBoard,
		readonly coord: AxialCoord,
		public content: TileContent
	) {
		super(hex.game, `hex-tile-${coord.q}-${coord.r}`)
	}

	get title(): string {
		return `Tile ${this.coord.q}, ${this.coord.r}`
	}

	get position(): WorldCoord {
		return this.hex.axial2world(this.coord)
	}

	get debugInfo(): Record<string, any> {
		return {
			position: this.position,
			content: this.content.debugInfo
		}
	}

	render = () => {
		const { background } = this.content
		const { hex, position, game } = this
		const { x: wpx, y: wpy } = position

		// Container for this tile
		const tileContainer = new Container()
		tileContainer.position.set(wpx, wpy)

		// Create tiling sprite from terrain texture
		const size = hex.tileSize
		const texture = this.game.getTexture(background)
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
		const brightnessFilter = new ColorMatrixFilter()
		tileSprite.filters = [brightnessFilter]

		tileContainer.addChild(tileSprite, mask)
		game.backgroundLayer.addChild(tileContainer)
		// Render foreground via tile content
		watch(() => this.content, (content)=> {
			const fg = content.render(this)
			game.objectLayer.addChild(fg as any)
			return () => {
				fg.destroy()
			}
		}, { immediate: true })
		const mouseoverEffect = effect(() => {
			if (mrg.hoveredObject === this) {
				tileSprite.tint = 0xaaaaff
				brightnessFilter.brightness(1.2, false)
			} else {
				tileSprite.tint = 0xffffff
				brightnessFilter.brightness(1, false)
			}
		})
		this.game.backgroundLayer.addChild(tileContainer)
		return () => {
			mouseoverEffect()
			tileContainer.destroy({ children: true })
			this.game.backgroundLayer.removeChild(tileContainer)
		}
	}
}

export class HexBoard extends D(RenderableContainer, HittableGameObject) {
	private tiles: AxialKeyMap<HexTile>
	private terrainGenerator: PerlinTerrainGenerator

	axial2world(coord: AxialRef): WorldCoord {
		return cartesian(coord, this.tileSize)
	}

	world2axial(world: WorldCoord): AxialCoord {
		return fromCartesian(world, this.tileSize)
	}

	constructor(
		public game: Game,
		public readonly boardSize: number = 12,
		public readonly tileSize: number = 30,
	) {
		super(game, "hexboard")
		this.tiles = new AxialKeyMap()
		this.zIndex = -1 // Background layer - tiles should be hit-tested last
		// Use a consistent seed based on the game instance
		this.terrainGenerator = new PerlinTerrainGenerator(12345)
	}

	hitTest = (worldX: number, worldY: number): InteractiveGameObject | false => {
		const coord = axial.round(this.world2axial({ x: worldX, y: worldY }))
		if (axial.distance(coord, { q: 0, r: 0 }) > this.boardSize) return false
		return this.getTile(coord) ?? false
	}

	resizeSprite(sprite: Sprite, size: number) {
		size *= this.tileSize
		const scale = Math.max(sprite.width, sprite.height) / size
		sprite.scale.x /= scale
		sprite.scale.y /= scale
	}
	public generateBoard(): void {
		// Generate all tiles within the board radius
		for (const coord of axial.enum(this.boardSize - 1)) {
			const seed = axial.access(coord).key
			const terrain = this.generateRandomTerrain(seed, coord)
			const deposit = this.generateRandomDeposit(seed, terrain)
			const content = new UnBuiltLand(3, terrain, deposit)
			const tile = new HexTile(this, coord, content)
			this.generateRandomGoods(tile, seed, terrain, deposit)
			this.tiles.set(coord, tile)
		}
	}

	private generateRandomGoods(
		tile: HexTile,
		seed: number,
		terrain: TerrainType,
		deposit: Deposit | undefined,
	): void {
		const rnd = this.game.lcg(`goods-${seed}`)

		// Deposit-driven goods
		if (deposit) {
			const goodsByDeposit: Record<string, { good: string; chance: number }> = {
				tree: { good: "wood", chance: 0.7 },
				rock: { good: "stone", chance: 0.6 },
				berry_bush: { good: "berries", chance: 0.8 },
			}
			const rule = goodsByDeposit[deposit.name]
			if (rule && rnd() < rule.chance) tile.content.addGood(rule.good as any, 1)
		}

		// Ambient goods by terrain (new terrain config)
		const ambient = (terrainChances as any)[terrain]?.goods ?? {}
		for (const [good, chance] of Object.entries(ambient)) {
			if (rnd() < (chance as number)) tile.content.addGood(good as any, 1)
		}
	}

	private generateRandomDeposit(seed: number, terrain: TerrainType): Deposit | undefined {
		const rnd = this.game.lcg(`deposit+${seed}`)
		const table = (terrainChances as any)[terrain]?.deposits ?? {}
		for (const [depKey, chance] of Object.entries(table)) {
			if (rnd() < (chance as number)) {
				const type = (deposits as any)[depKey] as Ssh.DepositDefinition
				return Object.setPrototypeOf(
					{
						amount: Math.floor(((1 + rnd() * 2) * type.maxAmount) / 3),
					},
					type,
				)
			}
		}
		return undefined
	}

	private generateRandomTerrain(seed: number, coord: AxialCoord): TerrainType {
		// Use Perlin noise for more natural terrain generation
		const terrain = this.terrainGenerator.generateTerrain(coord, DEFAULT_TERRAIN_CONFIG)
		
		// Convert Perlin terrain types to our TerrainType
		switch (terrain) {
			case "water":
			case "grass":
			case "forest":
			case "rocky":
			case "sand":
			case "snow":
				return terrain
			default:
				return "grass" // fallback
				console.error(`Unknown terrain: ${terrain}`)
		}
	}

	// Public methods
	getTile(coord: AxialRef): HexTile | undefined {
		return this.tiles.get(coord)
	}

	// Get neighbors of a tile with walk time information
	getNeighbors(coord: AxialRef): NeighborInfo[] {
		const neighbors = axial.neighbors(coord)
		return neighbors
			.map((neighbor: AxialRef) => {
				const tile = this.getTile(neighbor)
				return tile
					? {
							coord: axial.coord(neighbor),
							walkTime: tile.content.walkTime,
						}
					: null
			})
			.filter((neighbor): neighbor is NeighborInfo => neighbor !== null)
	}

	/**
	 * A* pathfinding algorithm with time-based costs and maxTime limit
	 * @param start Starting coordinate
	 * @param goal Target coordinate
	 * @param maxTime Maximum walking time allowed for the path
	 * @param punctual Whether to aim for the exact goal or allow nearby coordinates
	 * @returns A path if found within maxTime, undefined otherwise
	 */
	findPath(start: AxialRef, goal: AxialRef, maxTime: number, punctual: boolean = true) {
		return findPath((c) => this.getNeighbors(c), start, goal, maxTime, punctual)
	}

	/**
	 * Find the nearest coordinate that satisfies a condition within maxTime
	 * @param start Starting coordinate
	 * @param isGoal Function that returns true if the coordinate is a valid goal
	 * @param maxTime Maximum walking time allowed for the path
	 * @param punctual Whether to aim for the exact goal or allow nearby coordinates
	 * @returns Path to the nearest valid goal if found within maxTime, undefined otherwise
	 */
	findNearest(
		start: AxialRef,
		isGoal: IsGoal<true>,
		maxTime: number,
		punctual: boolean = true,
	) {
		return findNearest((c) => this.getNeighbors(c), start, isGoal, maxTime, punctual)
	}
}
