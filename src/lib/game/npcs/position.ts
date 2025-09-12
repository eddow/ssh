import { axial, cartesian, fromCartesian } from '$lib/hex'
import { epsilon, tileSize } from '$lib/utils'

function roughly(x: number) {
	return Math.round(x * epsilon) / epsilon
}

/**
 * Position type that can contain either x,y coordinates or q,r hex coordinates
 * The internal representation is not accessible from scripts - only toString() is available
 */
export class Position {
	private xy?: { x: number; y: number }
	private qr?: { q: number; r: number }

	constructor(from: { x: number; y: number } | { q: number; r: number }) {
		this.xy = 'x' in from ? from : undefined
		this.qr = 'q' in from ? from : undefined
	}

	private ensureXY() {
		if (this.xy === undefined) {
			const { x, y } = cartesian(this.qr!, tileSize)
			this.xy = { x: roughly(x), y: roughly(y) }
		}
	}

	private ensureQR() {
		if (this.qr === undefined) {
			const { q, r } = fromCartesian(this.xy!, tileSize)
			this.qr = { q: roughly(q), r: roughly(r) }
		}
	}

	get x(): number {
		this.ensureXY()
		return this.xy!.x
	}
	get y(): number {
		this.ensureXY()
		return this.xy!.y
	}

	get q(): number {
		this.ensureQR()
		return this.qr!.q
	}

	get r(): number {
		this.ensureQR()
		return this.qr!.r
	}

	distanceTo(other: Position): number {
		return axial.distance(this, other)
	}

	toString(): string {
		if (this.qr !== undefined) return `(${this.qr.q}, ${this.qr.r})`
		return `(${this.xy!.x}, ${this.xy!.y})`
	}

	equals(other: Position): boolean {
		if (this.xy !== undefined && other.xy !== undefined)
			return this.xy.x === other.xy.x && this.xy.y === other.xy.y
		this.ensureQR()
		other.ensureQR()
		return this.qr!.q === other.qr!.q && this.qr!.r === other.qr!.r
	}

	notEquals(other: Position): boolean {
		return !this.equals(other)
	}
}
