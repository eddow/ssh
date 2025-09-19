import type { Sprite } from 'pixi.js'
import { terrain as terrainDetails } from '$assets/game-content'
import type { DepositType, TerrainType } from '$lib/arktype'
import { GameObject, withContainer, withHittable } from '$lib/game/object'
import {
	type AxialCoord,
	type AxialRef,
	axial,
	cartesian,
	findBest,
	findNearest,
	findPath,
	fromCartesian,
	type NeighborInfo,
	PerlinTerrainGenerator,
	type Scoring,
	type WorldCoord,
} from '$lib/hex'
import { AxialKeyMap } from '$lib/mem'
import { isInteger, tileSize } from '$lib/utils'
import type { Character } from '../character'
import type { Game } from '../game'
import { TileBorder, type TileBorderContent } from './border'
import { Deposit, Tile, type TileContent, UnBuiltLand } from './tile'

export class HexBoard extends withContainer(withHittable(GameObject)) {
	private contents: AxialKeyMap<TileContent | TileBorderContent>
	private occupied: AxialKeyMap<Character>
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
		this.contents = new AxialKeyMap()
		this.occupied = new AxialKeyMap()
		this.zIndex = -1
		this.terrainGenerator = new PerlinTerrainGenerator(12345)
	}

	hitTest(worldX: number, worldY: number, selectedAction?: string): any {
		const coord = axial.round(this.world2axial({ x: worldX, y: worldY }))
		if (axial.distance(coord, { q: 0, r: 0 }) > this.boardSize) return false
		const tile = this.getTile(coord)
		if (!tile) return false
		if (selectedAction && !tile.canInteract(selectedAction)) {
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
		for (const coord of axial.enum(this.boardSize - 1)) {
			const seed = axial.access(coord).key
			const terrain = this.terrainGenerator.generateTerrain(coord)
			const deposit = this.generateRandomDeposit(seed, terrain)
			const tile = new Tile(this, coord)
			const land = new UnBuiltLand(tile, 3, terrain, deposit)
			this.generateRandomGoods(land, seed, terrain, deposit)
			tile.content = land
		}
	}

	private generateRandomGoods(
		content: UnBuiltLand,
		seed: number,
		terrain: TerrainType,
		deposit: Deposit | undefined,
	): void {
		const rnd = this.game.lcg(`goods-${seed}`)
		const details: Ssh.TerrainDefinition = terrainDetails[terrain]
		if (deposit?.generation?.goods) {
			let gen = rnd()
			for (const [good, chance] of Object.entries(deposit.generation.goods)) {
				if (gen < chance) {
					content.addGood(good as any, 1)
					break
				}
				gen -= chance
			}
		}
		const ambient = details.generation?.goods ?? {}
		for (const [good, chance] of Object.entries(ambient)) {
			if (rnd() < (chance as number)) content.addGood(good as any, 1)
		}
	}

	private generateRandomDeposit(seed: number, terrain: TerrainType): Deposit | undefined {
		const rnd = this.game.lcg(`deposit+${seed}`)
		const details: Ssh.TerrainDefinition = terrainDetails[terrain]
		const table = details.generation?.deposits ?? {}
		for (const [depKey, chance] of Object.entries(table)) {
			if (rnd() < (chance as number)) {
				const Kind = Deposit.class[depKey as DepositType]
				return new Kind(Math.floor(((1 + rnd() * 2) * Kind.prototype.maxAmount) / 3))
			}
		}
		return undefined
	}

	inBound(coord: AxialRef): boolean {
		coord = axial.access(coord)
		return axial.distance(coord) < this.boardSize
	}

	getTileContent(ref: AxialRef): TileContent | undefined {
		const coord = axial.access(ref)
		return this.contents.get({ q: coord.q << 1, r: coord.r << 1 }) as TileContent | undefined
	}

	setTileContent(ref: AxialRef, content: TileContent | undefined) {
		const coord = axial.access(ref)
		if (!content) this.contents.delete({ q: coord.q << 1, r: coord.r << 1 })
		else this.contents.set({ q: coord.q << 1, r: coord.r << 1 }, content)
	}

	getTile(ref: AxialRef): Tile | undefined {
		const coord = axial.access(ref)
		if (!(isInteger(coord.q) && isInteger(coord.r)) || !this.inBound(coord)) return undefined
		const content = this.contents.get({ q: coord.q << 1, r: coord.r << 1 }) as
			| TileContent
			| undefined
		return content?.tile ?? new Tile(this, coord)
	}

	getBorderContent(ref: AxialRef): TileBorderContent | undefined {
		const coord = axial.access(ref)
		return this.contents.get({ q: coord.q * 2, r: coord.r * 2 }) as TileBorderContent | undefined
	}
	setBorderContent(ref: AxialRef, content?: TileBorderContent) {
		const coord = axial.access(ref)
		if (!content) this.contents.delete({ q: coord.q * 2, r: coord.r * 2 })
		else this.contents.set({ q: coord.q * 2, r: coord.r * 2 }, content)
	}

	getBorder(ref: AxialRef): TileBorder | undefined {
		const coord = axial.access(ref)
		if ((isInteger(coord.q) && isInteger(coord.r)) || !this.inBound(coord)) return undefined
		const content = this.contents.get({ q: coord.q * 2, r: coord.r * 2 }) as
			| TileBorderContent
			| undefined
		return content?.border ?? new TileBorder(this, ref)
	}

	// Occupancy management (regular coordinates, not */2)
	getCharacterAt(ref: AxialRef): Character | undefined {
		return this.occupied.get(axial.access(ref))
	}

	isOccupied(ref: AxialRef): boolean {
		return this.occupied.has(axial.access(ref))
	}

	/** Attempts to move a character onto a coordinate. Returns true if successful. */
	moveCharacter(character: Character, to: AxialRef, from?: AxialRef): boolean {
		const toCoord = axial.access(to)
		// TODO: if occupied by idle character, ask him to move away - if possible, still step on
		if (this.isOccupied(toCoord)) return false
		// allocate new position
		this.occupied.set(toCoord, character)
		// deallocate old position if provided and still pointing to this character
		if (from && this.getCharacterAt(from) === character) this.occupied.delete(from)
		return true
	}

	getNeighbors(coord: AxialRef): NeighborInfo[] {
		const neighbors = axial.neighbors(coord)
		return neighbors
			.map((neighbor: AxialRef) => {
				const tile = this.getTile(neighbor)
				return tile
					? {
							coord: axial.coord(neighbor),
							walkTime: this.isOccupied(neighbor)
								? Number.POSITIVE_INFINITY
								: tile.content!.walkTime,
						}
					: null
			})
			.filter((neighbor): neighbor is NeighborInfo => neighbor !== null)
	}

	findPath(start: AxialRef, goal: AxialRef, maxTime: number, punctual: boolean = true) {
		return findPath((c) => this.getNeighbors(c), start, goal, maxTime, punctual)
	}

	findNearest(
		start: AxialRef,
		isGoal: Scoring<true>,
		stop: number | ((coord: AxialRef, walkTime: number) => boolean),
		punctual: boolean = true,
	) {
		return findNearest((c) => this.getNeighbors(c), start, isGoal, stop, punctual)
	}

	findBest(
		start: AxialRef,
		scoring: Scoring<number>,
		stop: number | ((coord: AxialRef, walkTime: number) => boolean),
		bestPossibleScore: number,
		punctual: boolean = true,
	) {
		return findBest((c) => this.getNeighbors(c), start, scoring, stop, bestPossibleScore, punctual)
	}
}
