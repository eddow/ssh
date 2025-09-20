import type { Storage } from '$lib/game/storage'
import { type Axial, type AxialRef, axial } from '$lib/hex'
import type { HexBoard } from '..'
import type { Tile } from '../tile'
import { type } from 'arktype'

// Re-export content classes
export * from './module-gate'

export interface TileBorderContent extends Storage<any> {
	readonly border: TileBorder
	destroy?(): void
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
		this.content?.destroy?.()
		this.hex.setBorderContent(this.coord, content)
	}
}

export const TileBorderType = type.instanceOf(TileBorder)
