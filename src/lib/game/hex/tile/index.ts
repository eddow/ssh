import { type } from 'arktype'
import { effect, reactive, watch } from 'mutts'
import {
	ColorMatrixFilter,
	Container,
	type ContainerChild,
	Graphics,
	Point,
	TilingSprite,
} from 'pixi.js'
import type { GoodType, ModuleType } from '$lib/arktype'
import { mrg } from '$lib/globals.svelte'
import type { AxialCoord } from '$lib/hex'
import { tileSize } from '$lib/utils'
import { gameIsaTypes } from '../../npcs/utils'
import { GameObject, withGenerator, withInteractive } from '../../object'
import { type Position, toAxialCoord, toWorldCoord } from '../../position'
import type { Storage } from '../../storage'
import type { HexBoard } from '../board'
import type { TileBorder } from '../border'
import { Module } from './module'

export interface TileContent extends Storage {
	readonly tile: Tile
	// TODO: translate-> name = translation set on load
	readonly name?: string
	destroy?(): void
	readonly debugInfo: Record<string, any>
	readonly walkTime: number
	readonly background: string
	/**
	 * List the goods on the tile
	 * @returns A record of goods and their quantities
	 */
	get goods(): { [k in GoodType]?: number }
	/**
	 * Render the tile
	 * @param tile - The tile to render
	 * @returns The container child to render
	 */
	render(tile: Tile): ContainerChild
	/**
	 * Check if this tile content can perform the given action
	 * @param action - The action to check
	 * @returns true if the action can be performed
	 */
	canInteract?(action: string): boolean
}

@reactive
export class Tile extends withInteractive(withGenerator(GameObject)) {
	get content(): TileContent | undefined {
		return this.hex.getTileContent(toAxialCoord(this.position))
	}
	set content(content: TileContent | undefined) {
		this.content?.destroy?.()
		this.hex.setTileContent(toAxialCoord(this.position), content)
	}
	constructor(
		public readonly hex: HexBoard,
		coord: AxialCoord,
	) {
		super(hex.game, `hex-tile:${coord.q},${coord.r}`)
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

	build(moduleType: ModuleType): boolean {
		if (!this.canInteract(`build:${moduleType}`)) {
			return false
		}
		const ModuleClass = Module.class[moduleType]
		if (!ModuleClass) return false
		const newModule = new ModuleClass(this)
		// Set tile reference on new content
		this.content = newModule
		return true
	}

	/**
	 * Retrieve the six borders around this tile at:
	 * {q+.5,r}, {q-.5,r}, {q,r+.5}, {q,r-.5}, {q-.5,r+.5}, {q+.5,r-.5}
	 */
	getBorders(): (TileBorder | undefined)[] {
		const { q, r } = toAxialCoord(this.position)
		return [
			this.hex.getBorder({ q: q + 0.5, r }),
			this.hex.getBorder({ q: q - 0.5, r }),
			this.hex.getBorder({ q, r: r + 0.5 }),
			this.hex.getBorder({ q, r: r - 0.5 }),
			this.hex.getBorder({ q: q - 0.5, r: r + 0.5 }),
			this.hex.getBorder({ q: q + 0.5, r: r - 0.5 }),
		]
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
		watch(
			() => this.content,
			(content) => {
				if (!content) return
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
			tileContainer.destroy({ children: false })
			this.game.backgroundLayer.removeChild(tileContainer)
		}
	}
}
export const TileType = type.instanceOf(Tile)
gameIsaTypes.tile = (value: any) => {
	return value instanceof Tile
}

// Re-export content classes
export * from './module'
export * from './unbuilt-land'
