import { effect, reactive, watch } from 'mutts'
import { ColorMatrixFilter, Container, Graphics, Point, type Sprite, TilingSprite } from 'pixi.js'
import { deposits, terrain as terrainDetails } from '$assets/game-content'
import {
	GameObject,
	withContainer,
	withGenerator,
	withHittable,
	withInteractive,
} from '$lib/game/object'
import { mrg } from '$lib/globals.svelte'
import { tileSize } from '$lib/utils'
import {
	type AxialCoord,
	type AxialRef,
	axial,
	cartesian,
	findNearest,
	findPath,
	fromCartesian,
	type IsGoal,
	type NeighborInfo,
	PerlinTerrainGenerator,
	type WorldCoord,
} from '../hex'
import { AxialKeyMap } from '../mem'
import type { Game } from './game'
import { type Position, toAxialCoord, toWorldCoord } from './position'
import { type Deposit, Module, type TerrainType, type TileContent, UnBuiltLand } from './tile'
// TODO: check container.cacheAsTexture() for background

@reactive
export class HexTile extends withInteractive(withGenerator(GameObject)) {
	constructor(
		public readonly hex: HexBoard,
		coord: AxialCoord,
		public content: TileContent,
	) {
		super(hex.game, `hex-tile:${coord.q},${coord.r}`)
		this.position = coord
	}
	readonly position: Position
	get tile(): HexTile { return this }

	get title(): string {
		const axial = toAxialCoord(this.position)
		return `Tile ${axial.q}, ${axial.r}`
	}

	get debugInfo(): Record<string, any> {
		return {
			position: this.position,
			content: this.content.debugInfo,
		}
	}

	canAct(action: string): boolean {
		// For other actions, check if the tile content can act
		return this.content.canAct?.(action) ?? false
	}

	build(moduleType: string): boolean {
		// Check if we can build on this tile
		if (!this.canAct(`build:${moduleType}`)) {
			return false
		}

		// Get the module class from the static class registry
		const ModuleClass = Module.class[moduleType as keyof typeof Module.class]

		if (!ModuleClass) {
			console.error(`Unknown module type: ${moduleType}`)
			return false
		}

		// Create and set the new module
		const newModule = new ModuleClass()
		this.content = newModule
		// TODO: Temporary, move char0
		const char = this.game.population.getAllCharacters()[0]
		char.abandonAnd(char.scriptsContext.walk.into(this.position))

		return true
	}

	render() {
		const { background } = this.content
		const { position, game } = this
		const { x: wpx, y: wpy } = toWorldCoord(position)

		// Container for this tile
		const tileContainer = new Container()
		tileContainer.position.set(wpx, wpy)

		// Create tiling sprite from terrain texture
		const size = tileSize
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
		watch(
			() => this.content,
			(content) => {
				const fg = content.render(this)
				const { x, y } = toWorldCoord(position)
				fg.position.set(x, y)
				game.objectLayer.addChild(fg as any)
				return () => {
					fg.destroy()
				}
			},
			{ immediate: true },
		)
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

export class HexBoard extends withContainer(withHittable(GameObject)) {
	private tiles: AxialKeyMap<HexTile>
	private terrainGenerator: PerlinTerrainGenerator

	axial2world(coord: AxialRef): WorldCoord {
		return cartesian(coord, tileSize)
	}

	world2axial(world: WorldCoord): AxialCoord {
		return fromCartesian(world, tileSize)
	}

	constructor(
		public game: Game,
		public readonly boardSize: number = 12,
	) {
		super(game)
		this.tiles = new AxialKeyMap()
		this.zIndex = -1 // Background layer - tiles should be hit-tested last
		// Use a consistent seed based on the game instance
		this.terrainGenerator = new PerlinTerrainGenerator(12345)
	}

	// Container functionality is provided by withContainer mixin

	hitTest(worldX: number, worldY: number, selectedAction?: string): any {
		const coord = axial.round(this.world2axial({ x: worldX, y: worldY }))
		if (axial.distance(coord, { q: 0, r: 0 }) > this.boardSize) return false
		const tile = this.getTile(coord)
		if (!tile) return false

		// If we have a selected action, check if the tile can act with it
		if (selectedAction && !tile.canAct(selectedAction)) {
			return false
		}

		return tile
	}

	resizeSprite(sprite: Sprite, size: number) {
		size *= tileSize
		const scale = Math.max(sprite.width, sprite.height) / size
		sprite.scale.x /= scale
		sprite.scale.y /= scale
	}
	public generateBoard(): void {
		// Generate all tiles within the board radius
		for (const coord of axial.enum(this.boardSize - 1)) {
			const seed = axial.access(coord).key
			const terrain = this.terrainGenerator.generateTerrain(coord)
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
		const details: Ssh.TerrainDefinition = terrainDetails[terrain]

		// Deposit-driven goods
		if (deposit?.generation?.goods) {
			let gen = rnd()
			for (const [good, chance] of Object.entries(deposit.generation.goods)) {
				if (gen < chance) {
					tile.content.addGood(good as any, 1)
					break
				}
				gen -= chance
			}
		}

		// Ambient goods by terrain (new terrain config)
		const ambient = details.generation?.goods ?? {}
		for (const [good, chance] of Object.entries(ambient)) {
			if (rnd() < (chance as number)) tile.content.addGood(good as any, 1)
		}
	}

	private generateRandomDeposit(seed: number, terrain: TerrainType): Deposit | undefined {
		const rnd = this.game.lcg(`deposit+${seed}`)
		const details: Ssh.TerrainDefinition = terrainDetails[terrain]
		const table = details.generation?.deposits ?? {}
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
	findNearest(start: AxialRef, isGoal: IsGoal<true>, maxTime: number, punctual: boolean = true) {
		return findNearest((c) => this.getNeighbors(c), start, isGoal, maxTime, punctual)
	}
}
