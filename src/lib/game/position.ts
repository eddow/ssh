import { type AxialRef, axial, cartesian, fromCartesian, type WorldCoord, type AxialCoord } from '$lib/hex'
import { epsilon, tileSize } from '$lib/utils'

function roughly(x: number) {
	return Math.round(x / epsilon) * epsilon
}

// Position concept - can be any coordinate representation
export type Position = WorldCoord | AxialRef | { position: Position }

// Type guards
export function isPosition(value: any): value is Position {
	if (typeof value === 'number') return true // AxialKey
	if (typeof value === 'object' && value !== null) {
		if ('x' in value && 'y' in value) return true // WorldCoord
		if ('q' in value && 'r' in value) return true // AxialCoord
		if ('position' in value) return true // { position: Position }
	}
	return false
}

export function isWorldCoord(value: any): value is WorldCoord {
	return typeof value === 'object' && value !== null && 'x' in value && 'y' in value
}

export function isAxialRef(value: any): value is AxialRef {
	return typeof value === 'number' || 
		   (typeof value === 'object' && value !== null && 'q' in value && 'r' in value)
}

// Conversion functions
export function toWorldCoord(position: Position): WorldCoord {
	if (isWorldCoord(position)) return position
	if(typeof position === 'number') 
		return cartesian(position, tileSize)
	if (isAxialRef(position)) {
		Object.assign(position, cartesian(position, tileSize))
		return position as unknown as WorldCoord
	}
	if ('position' in position) {
		return toWorldCoord(position.position)
	}
	throw new Error('Invalid position type')
}

export function toAxialCoord(position: Position): { q: number; r: number } {
	if (isAxialRef(position)) {
		return axial.access(position)
	}
	if (isWorldCoord(position)) {
		Object.assign(position, fromCartesian(position, tileSize))
		return position as unknown as AxialCoord
	}
	if ('position' in position) {
		return toAxialCoord(position.position)
	}
	throw new Error('Invalid position type')
}

// Position operations
export function positionToString(position: Position): string {
	const axial = toAxialCoord(position)
	return `<${axial.q}, ${axial.r}, ${-axial.q - axial.r}>`
}

export function positionDistance(a: Position, b: Position): number {
	return axial.distance(toAxialCoord(a), toAxialCoord(b))
}

export function positionRoughly(position: Position): Position {
	if (isWorldCoord(position)) {
		return { x: roughly(position.x), y: roughly(position.y) }
	}
	if (isAxialRef(position)) {
		const { q, r } = toAxialCoord(position)
		return { q: roughly(q), r: roughly(r) }
	}
	if ('position' in position) {
		return positionRoughly(position.position)
	}
	throw new Error('Invalid position type')
}

export function positionRoughlyEquals(a: Position, b: Position): boolean {
	if (isWorldCoord(a) && isWorldCoord(b)) {
		return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) < epsilon
	}
	const aAxial = toAxialCoord(a)
	const bAxial = toAxialCoord(b)
	return aAxial.q === bAxial.q && aAxial.r === bAxial.r
}

export function positionEquals(a: Position, b: Position): boolean {
	if (isWorldCoord(a) && isWorldCoord(b)) {
		return a.x === b.x && a.y === b.y
	}
	const aAxial = toAxialCoord(a)
	const bAxial = toAxialCoord(b)
	return aAxial.q === bAxial.q && aAxial.r === bAxial.r
}

export function positionLerp(a: Position, b: Position, t: number): Position {
	if(isWorldCoord(a) && isWorldCoord(b)) {
		return {
			x: a.x + (b.x - a.x) * t,
			y: a.y + (b.y - a.y) * t
		}
	}
	const aAxial = toAxialCoord(a)
	const bAxial = toAxialCoord(b)
	return {
		q: aAxial.q + (bAxial.q - aAxial.q) * t,
		r: aAxial.r + (bAxial.r - aAxial.r) * t
	}
}