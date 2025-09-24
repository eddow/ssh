import type { Sprite } from 'pixi.js'
import { assert } from '$lib/debug'
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
	type Scoring,
	type WorldCoord,
} from '$lib/hex'
import { AxialKeyMap } from '$lib/mem'
import { isInteger, tileSize } from '$lib/utils'
import type { Game } from '../game'
import type { Character } from '../population/character'
import { TileBorder, type TileBorderContent } from './border/border'
import type { TileContent } from './content/content'
import { Module } from './content/module'
import { Tile } from './tile'

export function isTileCoord(coord: AxialCoord): boolean {
	return isInteger(coord.q) && isInteger(coord.r)
}

export class HexBoard extends withContainer(withHittable(GameObject)) {
	private contents: AxialKeyMap<TileContent | TileBorderContent>
	private occupied: AxialKeyMap<Character>

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

	inBound(coord: AxialRef): boolean {
		coord = axial.access(coord)
		return axial.distance(coord) < this.boardSize
	}

	getTileContent(ref: AxialRef): TileContent | undefined {
		const coord = axial.access(ref)
		assert(isTileCoord(coord), 'coord must be a tile coordinate')
		return this.contents.get({ q: coord.q << 1, r: coord.r << 1 }) as TileContent | undefined
	}

	setTileContent(ref: AxialRef, content: TileContent | undefined) {
		const coord = axial.access(ref)
		assert(isTileCoord(coord), 'coord must be a tile coordinate')
		if (!content) this.contents.delete({ q: coord.q << 1, r: coord.r << 1 })
		else this.contents.set({ q: coord.q << 1, r: coord.r << 1 }, content)
		// If a tile content is set programmatically post-generation, mark tile dirty
		const tile = content?.tile ?? this.getTile(coord)
		if (tile) tile.asGenerated = false
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
		assert(!isTileCoord(coord), 'coord must be a border coordinate')
		return this.contents.get({ q: coord.q * 2, r: coord.r * 2 }) as TileBorderContent | undefined
	}
	setBorderContent(ref: AxialRef, content?: TileBorderContent) {
		const coord = axial.access(ref)
		if (!content) this.contents.delete({ q: coord.q * 2, r: coord.r * 2 })
		else this.contents.set({ q: coord.q * 2, r: coord.r * 2 }, content)
	}

	getBorder(ref: AxialRef): TileBorder | undefined {
		const coord = axial.access(ref)
		assert(!isTileCoord(coord), 'coord must be a border coordinate')
		if (!this.inBound(coord)) return undefined
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

	getNeighborsForCharacter(coord: AxialRef, character: Character): NeighborInfo[] {
		const neighbors = axial.neighbors(coord)
		return neighbors
			.map((neighbor: AxialRef) => {
				const tile = this.getTile(neighbor)
				if (
					!tile ||
					// If character is carrying items and tile has a module, make it unwalkable
					(character.aCarriedGood && tile.content instanceof Module) ||
					// If tile is occupied by another character, make it unwalkable
					// TODO: remove this for character path finding, manage queues somehow
					this.isOccupied(neighbor)
				)
					return null

				return {
					coord: axial.coord(neighbor),
					walkTime: tile.content!.walkTime,
				}
			})
			.filter((neighbor): neighbor is NeighborInfo => neighbor !== null)
	}

	findPathForCharacter(
		start: AxialRef,
		goal: AxialRef,
		character: Character,
		maxTime: number,
		punctual: boolean = true,
	) {
		return findPath(
			(c) => this.getNeighborsForCharacter(c, character),
			start,
			goal,
			maxTime,
			punctual,
		)
	}

	findNearest(
		start: AxialRef,
		isGoal: Scoring<true>,
		stop: number | ((coord: AxialRef, walkTime: number) => boolean),
		punctual: boolean = true,
	) {
		return findNearest((c) => this.getNeighbors(c), start, isGoal, stop, punctual)
	}

	findNearestForCharacter(
		start: AxialRef,
		character: Character,
		isGoal: Scoring<true>,
		stop: number | ((coord: AxialRef, walkTime: number) => boolean),
		punctual: boolean = true,
	) {
		return findNearest(
			(c) => this.getNeighborsForCharacter(c, character),
			start,
			isGoal,
			stop,
			punctual,
		)
	}

	findBestForCharacter(
		start: AxialRef,
		character: Character,
		scoring: Scoring<number>,
		stop: number | ((coord: AxialRef, walkTime: number) => boolean),
		bestPossibleScore: number,
		punctual: boolean = true,
	) {
		return findBest(
			(c) => this.getNeighborsForCharacter(c, character),
			start,
			scoring,
			stop,
			bestPossibleScore,
			punctual,
		)
	}
}
