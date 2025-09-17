import { type Axial, type AxialRef, axial } from '$lib/hex'
import type { HexBoard } from './board'
import type { Tile } from './tile'

export interface TileBorderContent {
	readonly border: TileBorder
}

export class TileBorder {
	readonly coord: Axial
	constructor(
		public readonly hex: HexBoard,
		coord: AxialRef,
	) {
		coord = this.coord = axial.access(coord)
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
		return this.hex.getBorderContent(this.coord)
	}
	set content(content: TileBorderContent | undefined) {
		this.hex.setBorderContent(this.coord, content)
	}
}
