import { watch } from 'mutts/src'
import type { Game } from '$lib/game/game'
import { GameObject, withGenerator } from '$lib/game/object'
import type { Storage } from '$lib/game/storage'
import { renderBorderGoods } from '$lib/game/storage/goods-renderer'
import { type Positioned, tileSize } from '$lib/utils'
import { type Position, toAxialCoord, toWorldCoord } from '$lib/utils/position'
import type { Tile } from '../tile'

export interface TileBorderContent extends Storage<any> {
	readonly border: TileBorder
	destroy?(): void
}

export class TileBorder extends withGenerator(GameObject) {
	readonly position: Position
	constructor(game: Game, coord: Positioned) {
		super(game)
		const hex = game.hex
		this.position = coord = toAxialCoord(coord)
		this.tile = {
			get a(): Tile {
				return hex.getTile({ q: Math.ceil(coord.q), r: Math.floor(coord.r) })!
			},
			get b(): Tile {
				return hex.getTile({ q: Math.floor(coord.q), r: Math.ceil(coord.r) })!
			},
		}
	}
	tile: {
		get a(): Tile
		get b(): Tile
	}
	get content(): TileBorderContent | undefined {
		return this.game.hex.getBorderContent(toAxialCoord(this.position))
	}
	set content(content: TileBorderContent | undefined) {
		this.content?.destroy?.()
		this.game.hex.setBorderContent(toAxialCoord(this.position), content)
	}
	render() {
		// Get world coordinates of both tiles
		const tileAWorld = toWorldCoord(this.tile.a.position)
		const tileBWorld = toWorldCoord(this.tile.b.position)

		// Calculate border center position
		const borderCenter = {
			x: (tileAWorld.x + tileBWorld.x) / 2,
			y: (tileAWorld.y + tileBWorld.y) / 2,
		}

		// Calculate relative position of tile A from the border center
		const alveolusCenter = {
			x: tileAWorld.x - borderCenter.x,
			y: tileAWorld.y - borderCenter.y,
		}

		// Watch for content changes and render border goods
		return watch(
			() => this.content,
			(content) => {
				if (!content) return
				return renderBorderGoods(
					this.game,
					tileSize,
					() => content.renderedGoods(),
					borderCenter,
					alveolusCenter,
				)
			},
			{ immediate: true },
		)
	}
}
