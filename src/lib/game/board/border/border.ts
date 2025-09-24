import { type } from 'arktype'
import { type Position, toAxialCoord } from '$lib/game/position'
import type { Storage } from '$lib/game/storage'
import { type AxialRef, axial } from '$lib/hex'
import type { HexBoard } from '../board'
import type { Tile } from '../tile'

export interface TileBorderContent extends Storage<any> {
	readonly border: TileBorder
	destroy?(): void
}

export class TileBorder {
	readonly position: Position
	constructor(
		public readonly hex: HexBoard,
		coord: AxialRef,
	) {
		this.position = coord = axial.access(coord)
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
		return this.hex.getBorderContent(toAxialCoord(this.position))
	}
	set content(content: TileBorderContent | undefined) {
		this.content?.destroy?.()
		this.hex.setBorderContent(toAxialCoord(this.position), content)
	}
}

export const TileBorderArkType = type.instanceOf(TileBorder)
