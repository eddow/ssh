import { type } from 'arktype'
import { immutables } from 'mutts/src'
import {
	type AxialCoord,
	AxialKey,
	type AxialRef,
	axial,
	cartesian,
	fromCartesian,
	type WorldCoord,
} from '$lib/hex'
import { epsilon, tileSize } from '$lib/utils'

function roughly(x: number) {
	return Math.round(x / epsilon) * epsilon
}
// Position concept - can be any coordinate representation
export const Position = type.or({ q: 'number', r: 'number' }, { x: 'number', y: 'number' })
export type Position = typeof Position.infer
export const Positioned = type.or(Position, { position: Position })
export type Positioned = typeof Positioned.infer

immutables.add((x) => Position.allows(x))

export function isWorldCoord(value: any): value is WorldCoord {
	return typeof value === 'object' && value !== null && 'x' in value && 'y' in value
}

export function isAxialRef(value: any): value is AxialRef {
	return (
		typeof value === 'number' ||
		(typeof value === 'object' && value !== null && 'q' in value && 'r' in value)
	)
}

// Conversion functions
export function toWorldCoord(positioned: Positioned | AxialKey): WorldCoord {
	if (isWorldCoord(positioned)) return positioned
	if (typeof positioned === AxialKey) return cartesian(positioned as AxialKey, tileSize)
	if (isAxialRef(positioned)) {
		Object.assign(positioned, cartesian(positioned, tileSize))
		return positioned as unknown as WorldCoord
	}
	if ('position' in positioned) {
		return toWorldCoord(positioned.position)
	}
	throw new Error('Invalid position type')
}

export function toAxialCoord(positioned: Positioned): { q: number; r: number } {
	if (isAxialRef(positioned)) {
		return axial.access(positioned)
	}
	if (isWorldCoord(positioned)) {
		Object.assign(positioned, fromCartesian(positioned, tileSize))
		return positioned as unknown as AxialCoord
	}
	if ('position' in positioned) {
		return toAxialCoord(positioned.position)
	}
	throw new Error('Invalid position type')
}

// Position operations
export function positionToString(positioned: Positioned): string {
	const axial = toAxialCoord(positioned)
	return `<${axial.q}, ${axial.r}, ${-axial.q - axial.r}>`
}

export function axialDistance(a: Positioned, b: Positioned): number {
	return axial.distance(toAxialCoord(a), toAxialCoord(b))
}

export function positionRoughly(positioned: Positioned): Positioned {
	if (isWorldCoord(positioned)) {
		return { x: roughly(positioned.x), y: roughly(positioned.y) }
	}
	if (isAxialRef(positioned)) {
		const { q, r } = toAxialCoord(positioned)
		return { q: roughly(q), r: roughly(r) }
	}
	if ('position' in positioned) {
		return positionRoughly(positioned.position)
	}
	throw new Error('Invalid position type')
}

export function positionRoughlyEquals(a: Positioned, b: Positioned): boolean {
	if (isWorldCoord(a) && isWorldCoord(b)) {
		return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) < epsilon
	}
	const aAxial = toAxialCoord(a)
	const bAxial = toAxialCoord(b)
	return Math.abs(aAxial.q - bAxial.q) + Math.abs(aAxial.r - bAxial.r) < epsilon
}

export function positionEquals(a: Positioned, b: Positioned): boolean {
	if (isWorldCoord(a) && isWorldCoord(b)) {
		return a.x === b.x && a.y === b.y
	}
	const aAxial = toAxialCoord(a)
	const bAxial = toAxialCoord(b)
	return aAxial.q === bAxial.q && aAxial.r === bAxial.r
}

export function positionLerp(a: Positioned, b: Positioned, t: number): Positioned {
	if (isWorldCoord(a) && isWorldCoord(b)) {
		return {
			x: a.x + (b.x - a.x) * t,
			y: a.y + (b.y - a.y) * t,
		}
	}
	const aAxial = toAxialCoord(a)
	const bAxial = toAxialCoord(b)
	return {
		q: aAxial.q + (bAxial.q - aAxial.q) * t,
		r: aAxial.r + (bAxial.r - aAxial.r) * t,
	}
}

export function xyDistance(a: Positioned, b: Positioned): number {
	const { x: ax, y: ay } = toWorldCoord(a)
	const { x: bx, y: by } = toWorldCoord(b)
	return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2)
}
