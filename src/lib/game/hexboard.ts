import D from "flat-diamond"
import { effect, Reactive, reactive, type ScopedCallback } from "mutts"
import { ColorMatrixFilter, Container, Graphics, Point, Sprite, TilingSprite } from "pixi.js"
import { buildings, deposits, goods } from "$assets/game-content"
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
} from "../hex"
import { AxialKeyMap } from "../mem"
import type { Character } from "./character"
import type { Game } from "./game"
// TODO: check container.cacheAsTexture() for background
export interface Deposit extends Ssh.DepositDefinition {
	amount: number
}

export interface Building extends Ssh.BuildingDefinition {
	// Activity weights for each action (0 to 1)
	activityWeights: number[]
	// Assigned workers (characters)
	assignedWorkers: Character[] // Character objects
}

export type TerrainType = "water" | "grass" | "forest" | "rocky"
const nbrGoodsSlotsPerTile = 3

export class HexTile extends Reactive(D(InteractiveGameObject, GeneratorObject)) {
	public building: Building | undefined
	public goods: (string | undefined)[] = new Array(nbrGoodsSlotsPerTile).fill(undefined)

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
		if (this.building) {
			info.building = this.building.name
		}
		return info
	}

	get walkTime(): number {
		// Buildings make tiles unwalkable
		if (this.building) return 6
		// Water is unwalkable
		if (this.terrain === "water") return Number.POSITIVE_INFINITY
		// All other terrain is walkable
		return 1
	}

	get position(): WorldCoord {
		return this.hex.axial2world(this.coord)
	}

	// MultipleSet-like interface for goods
	addGood(goodType: string): boolean {
		// Find first empty slot
		for (let i = 0; i < this.goods.length; i++) {
			if (this.goods[i] === undefined) {
				this.goods[i] = goodType
				return true
			}
		}
		return false // No empty slots
	}

	removeGood(goodType: string): boolean {
		// Find and remove the good
		for (let i = 0; i < this.goods.length; i++) {
			if (this.goods[i] === goodType) {
				this.goods[i] = undefined
				return true
			}
		}
		return false // Good not found
	}

	hasGood(goodType: string): boolean {
		return this.goods.includes(goodType)
	}

	getGoodCount(goodType: string): number {
		return this.goods.filter((good) => good === goodType).length
	}

	getAllGoods(): string[] {
		return this.goods.filter((good) => good !== undefined) as string[]
	}

	isFull(): boolean {
		return this.goods.every((good) => good !== undefined)
	}

	getEmptySlots(): number {
		return this.goods.filter((good) => good === undefined).length
	}

	canStoreGoods(goodType: string): boolean {
		return this.getEmptySlots() > 0
	}

	storeGoods(goodType: string, amount: number): number {
		let stored = 0
		for (let i = 0; i < this.goods.length && stored < amount; i++) {
			if (this.goods[i] === undefined) {
				this.goods[i] = goodType
				stored++
			}
		}
		return stored
	}

	takeGoods(goodType: string, amount: number): number {
		let taken = 0
		for (let i = 0; i < this.goods.length && taken < amount; i++) {
			if (this.goods[i] === goodType) {
				this.goods[i] = undefined
				taken++
			}
		}
		return taken
	}

	render = () => {
		const { terrain } = this
		const { hex, position, game } = this
		const { x: wpx, y: wpy } = position

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
		const brightnessFilter = new ColorMatrixFilter()
		tileSprite.filters = [brightnessFilter]

		tileContainer.addChild(tileSprite, mask)
		game.backgroundLayer.addChild(tileContainer)
		let depositSprite: Sprite | undefined
		let buildingSprite: Sprite | undefined
		const depositEffect = effect(() => {
			if (depositSprite && !this.deposit) {
				depositSprite.destroy()
				depositSprite = undefined
			} else if (this.deposit && !depositSprite) {
				depositSprite = new Sprite(game.getTexture(this.deposit.sprites[0]))
				depositSprite.position.set(wpx, wpy)
				hex.resizeSprite(depositSprite, 1)
				game.objectLayer.addChild(depositSprite)
			}
		})
		const buildingEffect = effect(() => {
			if (buildingSprite && !this.building) {
				buildingSprite.destroy()
				buildingSprite = undefined
			} else if (this.building && !buildingSprite) {
				buildingSprite = new Sprite(game.getTexture(this.building.sprites[0]))
				buildingSprite.position.set(wpx, wpy)
				hex.resizeSprite(buildingSprite, 1.5)
				game.objectLayer.addChild(buildingSprite)
			}
		})

		// Goods rendering in triangular pattern
		const goodsSprites: (Sprite | undefined)[] = []
		const goodsEffects: ScopedCallback[] = []
		for (let i = 0; i < this.goods.length; i++) {
			goodsEffects.push(
				effect((_dep, i) => {
					const good = this.goods[i]
					const sprite = goodsSprites[i]
					if (sprite && !good) {
						sprite.destroy()
						goodsSprites[i] = undefined
					} else if (good && !goodsSprites[i]) {
						const goodsSprite = new Sprite(game.getTexture(goods[good].sprites[0]))
						hex.resizeSprite(goodsSprite, 0.5)

						// Position in triangular pattern (de-centered)
						const angle = (i * 2 * Math.PI) / 3 // 120 degrees apart
						const radius = size * 0.4 // Distance from center
						const offsetX = Math.cos(angle) * radius
						const offsetY = Math.sin(angle) * radius

						goodsSprite.position.set(wpx + offsetX, wpy + offsetY)
						game.objectLayer.addChild(goodsSprite)
						goodsSprites[i] = goodsSprite
					}
				}, i),
			)
		}
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
			depositEffect()
			buildingEffect()
			for (const goodsEffect of goodsEffects) goodsEffect()
			mouseoverEffect()
			tileContainer.destroy({ children: true })
			depositSprite?.destroy()
			buildingSprite?.destroy()
			goodsSprites.forEach((sprite) => {
				sprite?.destroy()
			})
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
			const tile = new HexTile(this, deposit, coord, terrain)
			this.generateRandomGoods(tile, seed, terrain, deposit)
			this.tiles.set(coord, tile)
		}
		const shackPath = this.findNearest(
			{ q: 0, r: 0 },
			(c) => {
				const tile = this.getTile(c)
				return (
					!!tile &&
					tile.terrain !== "water" &&
					tile.building === undefined &&
					tile.deposit === undefined &&
					tile.goods.every((good) => good === undefined)
				)
			},
			5,
			true,
		)
		if (shackPath) {
			const shackCoord = shackPath.pop()!
			const tile = this.getTile(shackCoord)!
			const building = Object.setPrototypeOf({}, buildings.shack) as Building
			// Initialize activity weights for all actions (default to 1.0)
			building.activityWeights = new Array(building.actions.length).fill(0.5)
			// Initialize assigned workers array
			building.assignedWorkers = []
			tile.building = reactive(building)
		}
	}

	private generateRandomGoods(
		tile: HexTile,
		seed: number,
		terrain: TerrainType,
		deposit: Deposit | undefined,
	): void {
		const rnd = this.game.lcg(`goods-${seed}`)

		// Generate goods based on deposit type
		if (deposit) {
			switch (deposit.name) {
				case "Tree":
					// 70% chance for wood under trees
					if (rnd() < 0.7) {
						tile.addGood("wood")
					}
					break
				case "Rock":
					// 60% chance for stone under rocks
					if (rnd() < 0.6) {
						tile.addGood("stone")
					}
					break
				case "Berry Bush":
					// 80% chance for berries under bushes
					if (rnd() < 0.8) {
						tile.addGood("berries")
					}
					break
			}
		}

		// Generate mushrooms in forests (independent of deposits)
		if (terrain === "forest" && rnd() < 0.3) {
			tile.addGood("mushrooms")
		}
	}

	private generateRandomDeposit(seed: number, terrain: TerrainType): Deposit | undefined {
		const rnd = this.game.lcg(`deposit+${seed}`)
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
			case "water":
				return undefined
			case "forest":
				return genDeposit(deposits.tree, 0.7)
			case "rocky": {
				return genDeposit(deposits.rock, 0.6)
			}
			case "grass":
				return genDeposit(deposits.berry_bush, 0.1)
		}
	}

	private generateRandomTerrain(seed: number, coord: AxialCoord): TerrainType {
		const rnd = this.game.lcg(`deposit-${seed}`)
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
			return "water"
		} else if (random < waterChance + grassChance) {
			return "grass"
		} else if (random < waterChance + grassChance + forestChance) {
			return "forest"
		} else {
			return "rocky"
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
							walkTime: tile.walkTime,
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
		isGoal: (coord: AxialRef) => boolean,
		maxTime: number,
		punctual: boolean = true,
	) {
		return findNearest((c) => this.getNeighbors(c), start, isGoal, maxTime, punctual)
	}
}
