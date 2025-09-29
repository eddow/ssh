import { reactive } from 'mutts/src'
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
import { QueueStep } from '../npcs/steps'
import type { Character } from '../population/character'
import { TileBorder, type TileBorderContent } from './border/border'
import type { TileContent } from './content/content'
import { FreeGoods } from './freeGoods'
import { Tile } from './tile'

export function isTileCoord(coord: AxialCoord): boolean {
	return isInteger(coord.q) && isInteger(coord.r)
}

export class HexBoard extends withContainer(withHittable(GameObject)) {
	private readonly contents = reactive(new AxialKeyMap<TileContent | TileBorderContent>())
	private readonly occupied = reactive(new AxialKeyMap<Character[]>([], () => []))
	// Will contain goods when perhaps destroying a building (war-like destruction), killing a character,
	// stopping (or making) a transit, etc.
	readonly freeGoods: FreeGoods

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
		this.freeGoods = new FreeGoods(game)
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
		return this.contents.get({ q: coord.q, r: coord.r }) as TileContent | undefined
	}

	setTileContent(ref: AxialRef, content: TileContent | undefined) {
		const coord = axial.access(ref)
		assert(isTileCoord(coord), 'coord must be a tile coordinate')
		if (!content) this.contents.delete({ q: coord.q, r: coord.r })
		else this.contents.set({ q: coord.q, r: coord.r }, content)
		// If a tile content is set programmatically post-generation, mark tile dirty
		const tile = content?.tile ?? this.getTile(coord)
		if (tile) tile.asGenerated = false
	}

	getTile(ref: AxialRef): Tile | undefined {
		const coord = axial.access(ref)
		if (!(isInteger(coord.q) && isInteger(coord.r)) || !this.inBound(coord)) return undefined
		const content = this.contents.get({ q: coord.q, r: coord.r }) as TileContent | undefined
		return content?.tile ?? new Tile(this, coord)
	}

	getBorderContent(ref: AxialRef): TileBorderContent | undefined {
		const coord = axial.access(ref)
		assert(!isTileCoord(coord), 'coord must be a border coordinate')
		return this.contents.get({ q: coord.q, r: coord.r }) as TileBorderContent | undefined
	}
	setBorderContent(ref: AxialRef, content?: TileBorderContent) {
		const coord = axial.access(ref)
		if (!content) this.contents.delete({ q: coord.q, r: coord.r })
		else this.contents.set({ q: coord.q, r: coord.r }, content)
	}

	getBorder(ref: AxialRef): TileBorder | undefined {
		const coord = axial.access(ref)
		assert(!isTileCoord(coord), 'coord must be a border coordinate')
		if (!this.inBound(coord)) return undefined
		const content = this.contents.get({ q: coord.q, r: coord.r }) as TileBorderContent | undefined
		return content?.border ?? new TileBorder(this.game, ref)
	}

	/** Attempts to move a character onto a coordinate. Returns true if successful. */
	moveCharacter(
		character: Character,
		to: AxialRef,
		from?: AxialRef,
	): QueueStep<Character> | undefined {
		if (from) {
			const fromCoord = axial.access(from)
			const occupation = this.occupied.get(fromCoord)!
			const occupant = occupation.shift()
			assert(occupant === character, 'Character is not the occupant of the from coordinate')
			if (occupation[0]) {
				assert(occupation[0].stepExecutor instanceof QueueStep, 'Occupant is queuing')
				occupation[0].stepExecutor.pass()
			} else {
				this.occupied.delete(fromCoord)
			}
		}
		const toCoord = axial.access(to)
		const occupied = this.occupied.get(toCoord)! /*
		console.trace(character, toCoord.q, toCoord.r)
		if (occupied[0] === character) debugger*/
		if (!occupied.length) {
			occupied.push(character)
			return undefined
		} else {
			return new QueueStep(character, occupied)
		}
	}

	getNeighbors(coord: AxialRef): NeighborInfo[] {
		const tile = this.getTile(coord)
		if (!tile) return []
		return tile.walkNeighbors
	}

	getNeighborsForCharacter(coord: AxialRef, _character: Character): NeighborInfo[] {
		const tile = this.getTile(coord)
		if (!tile) return []
		return tile.walkNeighbors
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
