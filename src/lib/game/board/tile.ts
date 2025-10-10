import { computed, unreactive, watch } from 'mutts/src'
import { ColorMatrixFilter, Container, Graphics, Point, TilingSprite } from 'pixi.js'
import { namedEffect } from '$lib/debug'
import { mrg } from '$lib/globals.svelte'
import type { AlveolusType, Job } from '$lib/types/base'
import { type AxialCoord, axial, type NeighborInfo, tileSize } from '$lib/utils'
import {
	axialDistance,
	type Position,
	type Positioned,
	toAxialCoord,
	toWorldCoord,
} from '../../utils/position'
import { Hive } from '../hive'
import { BuildAlveolus } from '../hive/build'
import { gameIsaTypes } from '../npcs/utils'
import { GameObject, withGenerator, withInteractive } from '../object'
import type { HexBoard } from './board'
import type { TileBorder } from './border/border'
import { Alveolus } from './content/alveolus'
import type { TileContent } from './content/content'
import type { FreeGood } from './freeGoods'
import type { Zone } from './zone'

@unreactive
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

		// If content is an Alveolus, handle hive attachment
		if (content instanceof Alveolus) {
			const hive = Hive.for(this)
			hive.attach(content)
			// Start advertising to the hive
			content.advertisingEffect = namedEffect('tile.campaign', () => {
				hive.campaign(content)
			})
		}
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
			zone: this.zone,
		}
	}

	// Tile-level job offering
	getJob(): Job | undefined {
		// Offload if there are free goods on tile and it's a zone/alveolus tile
		const hasFreeGoods = this.availableGoods.length > 0
		const isSpecial = !!this.zone || this.content instanceof Alveolus
		if (hasFreeGoods && isSpecial) {
			return { type: 'offload', fatigue: 1, urgency: 10 }
		}
		// Otherwise delegate to alveolus if present
		if (this.content instanceof Alveolus) return this.content.getJob()
	}

	// Zone getter/setter
	get zone(): Zone | undefined {
		return this.board.zoneManager.getZone(toAxialCoord(this.position))
	}

	set zone(zone: Zone | undefined) {
		if (zone === undefined) {
			this.board.zoneManager.removeZone(toAxialCoord(this.position))
		} else {
			this.board.zoneManager.setZone(toAxialCoord(this.position), zone)
		}
	}

	canInteract(action: string): boolean {
		return this.content?.canInteract?.(action) ?? false
	}

	/**
	 * Check if tile is clear of obstacles (no deposits, no free goods)
	 */
	get isClear(): boolean {
		const coord = toAxialCoord(this.position)
		const content = this.board.getTileContent(coord)

		// If this is a BuildAlveolus, check the underlying land's deposit
		if (content instanceof BuildAlveolus) {
			const underlyingLand = content.underlyingLand
			if (underlyingLand && 'deposit' in underlyingLand && underlyingLand.deposit) {
				return false
			}
		}
		// Otherwise check content directly for deposit
		else if (content && 'deposit' in content && content.deposit) {
			return false
		}

		// Check if there are free goods
		const freeGoods = this.board.freeGoods.getGoodsAt(coord)
		if (freeGoods.length > 0) {
			return false
		}

		return true
	}

	build(alveolusType: AlveolusType): boolean {
		// Check if content can be built on
		if (!this.canInteract(`build:${alveolusType}`)) {
			return false
		}

		// Create BuildAlveolus directly - it will be blocked until tile is clear
		this.content = new BuildAlveolus(this, alveolusType)
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
		game.groundLayer.addChild(tileContainer)

		// Watch for content changes and render content
		const cleanup = watch(
			() => this.content,
			(content) => {
				if (!content) return
				// content.render now returns a cleanup function instead of a Container
				return content.render(game)
			},
			{ immediate: true },
		)

		const mouseoverEffect = namedEffect('tile.mouseover', () => {
			if (mrg.hoveredObject === this) {
				tileSprite.tint = 0xaaaaff
				brightnessFilter.brightness(1.2, false)
			} else {
				let tint = 0xffffff
				// Priority: construction site > zone
				if (this.zone === 'residential') {
					tint = 0xaaffaa // greenish for residential zone
				} else if (this.zone === 'harvest') {
					tint = 0xffffaa // yellowish for harvest zone
				}
				tileSprite.tint = tint
				brightnessFilter.brightness(1, false)
			}
		})

		return () => {
			cleanup()
			mouseoverEffect()
			tileContainer.destroy({ children: false })
			this.game.groundLayer.removeChild(tileContainer)
		}
	}
	@computed
	get walkNeighbors(): NeighborInfo[] {
		const coord = toAxialCoord(this.position)
		const neighbors = axial.neighbors(coord)
		return neighbors
			.map((neighbor: Positioned) => {
				const tile = this.board.getTile(neighbor)
				return tile
					? {
							coord: toAxialCoord(neighbor),
							walkTime: tile.content!.walkTime,
						}
					: null
			})
			.filter((neighbor): neighbor is NeighborInfo => neighbor !== null)
	}

	@computed
	get freeGoods(): FreeGood[] {
		return this.board.freeGoods.getGoodsAt(toAxialCoord(this.position))
	}

	@computed
	get availableGoods(): FreeGood[] {
		return this.freeGoods.filter((g) => !g.allocated)
	}
}

gameIsaTypes.tile = (value: any) => {
	return value instanceof Tile
}
