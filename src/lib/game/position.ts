import { axial, cartesian, fromCartesian, type AxialRef } from '$lib/hex'
import { epsilon, tileSize } from '$lib/utils'

function roughly(x: number) {
	return Math.round(x * epsilon) / epsilon
}

/**
 * Position type that can contain either x,y coordinates or q,r hex coordinates
 * The internal representation is not accessible from scripts - only toString() is available
 */
export class Position {
	private xy?: { readonly x: number; readonly y: number }
	private qr?: { readonly q: number; readonly r: number }

	constructor(from: { x: number; y: number } | AxialRef) {
		if (typeof from === 'number') from = axial.keyAccess(from)
		this.xy = 'x' in from ? from : undefined
		this.qr = 'q' in from ? from : undefined
	}

	// Factory method for creating Position from x,y coordinates
	static fromXY(x: number, y: number): Position {
		return new Position({ x, y })
	}

	// Factory method for creating Position from q,r coordinates  
	static fromQR(q: number, r: number): Position {
		return new Position({ q, r })
	}

	public get world() {
		if (this.xy === undefined) {
			const { x, y } = cartesian(this.axial, tileSize)
			this.xy = { x: roughly(x), y: roughly(y) }
		}
		return this.xy
	}

	public get axial() {
		if (this.qr === undefined) {
			const { q, r } = fromCartesian(this.world, tileSize)
			this.qr = { q: roughly(q), r: roughly(r) }
		}
		return this.qr
	}

	get x(): number {
		return this.world.x
	}
	get y(): number {
		return this.world.y
	}

	get q(): number {
		return this.axial.q
	}

	get r(): number {
		return this.axial.r
	}

	distanceTo(other: Position): number {
		return axial.distance(this.axial, other.axial)
	}

	toString(): string {
		return this.qr !== undefined ?
			`<${this.qr.q}, ${this.qr.r}, ${-this.qr.q - this.qr.r}>` :
			`(${this.xy!.x}, ${this.xy!.y})`
	}

	equals(other: Position): boolean {
		if (this.xy !== undefined && other.xy !== undefined)
			return this.xy.x === other.xy.x && this.xy.y === other.xy.y
		return this.axial.q === other.axial.q && this.axial.r === other.axial.r
	}

	notEquals(other: Position): boolean {
		return !this.equals(other)
	}

	lerpTo(other: Position, t: number): Position {
		return Position.fromXY(
			this.world.x + (other.world.x - this.world.x) * t,
			this.world.y + (other.world.y - this.world.y) * t
		)
	}
}
