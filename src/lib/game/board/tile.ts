import { type } from 'arktype'
import { computed, effect, watch } from 'mutts'
import { ColorMatrixFilter, Container, Graphics, Point, TilingSprite } from 'pixi.js'

import type { AlveolusType } from '$lib/arktype'
import { mrg } from '$lib/globals.svelte'
import { type AxialCoord, type AxialRef, axial, type NeighborInfo } from '$lib/hex'
import { tileSize } from '$lib/utils'
import { alveolusClass } from '../hive'
import { gameIsaTypes } from '../npcs/utils'
import { GameObject, withGenerator, withInteractive } from '../object'
import {
	axialDistance,
	type Position,
	type Positioned,
	toAxialCoord,
	toWorldCoord,
} from '../position'
import type { HexBoard } from './board'
import type { TileBorder } from './border/border'
import type { TileContent } from './content/content'

export class Tile extends withInteractive(withGenerator(GameObject)) {
	// True when the tile is exactly as produced by generation
	public asGenerated: boolean = false
	@computed
	get content(): TileContent | undefined {
		return this.board.getTileContent(toAxialCoord(this.position))
	}
	set content(content: TileContent) {
		this.content?.destroy?.()
		this.board.setTileContent(toAxialCoord(this.position), content)
		// Mark as modified from generation when content changes
		this.asGenerated = false
	}
	constructor(
		public readonly board: HexBoard,
		coord: AxialCoord,
	) {
		super(board.game, `tile:${coord.q},${coord.r}`)
		this.position = coord
		// Set tile reference on content
	}
	readonly position: Position
	get tile(): Tile {
		return this
	}

	get title(): string {
		const axial = toAxialCoord(this.position)
		return `Tile ${axial.q}, ${axial.r}`
	}

	get debugInfo(): Record<string, any> {
		return {
			position: this.position,
			content: this.content?.debugInfo,
		}
	}

	canInteract(action: string): boolean {
		return this.content?.canInteract?.(action) ?? false
	}

	build(alveolusType: AlveolusType): boolean {
		if (!this.canInteract(`build:${alveolusType}`)) {
			return false
		}
		const AlveolusClass = alveolusClass[alveolusType]
		if (!AlveolusClass) return false
		const newAlveolus = new AlveolusClass(this)
		this.content = newAlveolus
		return true
	}

	get surroundings(): { border: TileBorder; tile: TileContent }[] {
		return axial
			.neighbors(toAxialCoord(this.position))
			.map((n) => ({ border: this.borderWith(n), tile: this.board.getTileContent(n) }))
			.filter((b) => b.border !== undefined && b.tile !== undefined) as {
			border: TileBorder
			tile: TileContent
		}[]
	}

	borderWith(positioned: Positioned): TileBorder | undefined {
		const thisCoord = toAxialCoord(this)
		const otherCoord = toAxialCoord(positioned)
		if (axialDistance(this, positioned) !== 1) return
		const coord = axial.linear([0.5, thisCoord], [0.5, otherCoord])
		return this.board.getBorder(coord)
	}
	@computed
	get neighborTiles(): Tile[] {
		return axial
			.neighbors(toAxialCoord(this.position))
			.map((neighbor) => this.board.getTile(neighbor))
			.filter((tile): tile is Tile => tile !== undefined)
	}

	render() {
		if (!this.content) return
		const { background } = this.content
		const { position, game } = this
		const { x: wpx, y: wpy } = toWorldCoord(position)

		const tileContainer = new Container()
		tileContainer.position.set(wpx, wpy)

		const size = tileSize
		const texture = this.game.getTexture(background)
		const tileSprite = new TilingSprite({ texture, width: size * 2, height: size * 2 })
		tileSprite.anchor.set(0.5)
		tileSprite.tilePosition.set(-wpx % (texture.width || size), -wpy % (texture.height || size))

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
		const cleanup = watch(
			() => this.content,
			(content) => {
				if (!content) return
				const fg = new Container()
				const { x, y } = toWorldCoord(position)
				fg.position.set(x, y)
				game.objectLayer.addChild(fg)
				fg.addChild(content.render(game))
				return () => {
					fg.destroy()
					game.objectLayer.removeChild(fg)
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
			cleanup()
			mouseoverEffect()
			tileContainer.destroy({ children: false })
			this.game.backgroundLayer.removeChild(tileContainer)
		}
	}
	@computed
	get walkNeighbors(): NeighborInfo[] {
		const coord = toAxialCoord(this.position)
		const neighbors = axial.neighbors(coord)
		return neighbors
			.map((neighbor: AxialRef) => {
				const tile = this.board.getTile(neighbor)
				return tile
					? {
							coord: axial.coord(neighbor),
							walkTime: tile.content!.walkTime,
						}
					: null
			})
			.filter((neighbor): neighbor is NeighborInfo => neighbor !== null)
	}
}

export const TileArkType = type.instanceOf(Tile)
gameIsaTypes.tile = (value: any) => {
	return value instanceof Tile
}
