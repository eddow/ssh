import { unreactive } from 'mutts'
import {
	type IsaTypes,
	jsIsaTypes,
	jsOperators,
	MiniScriptExecutor,
	NpcScript,
	type Operators,
} from 'npc-script/src'
import { epsilon } from '$lib/utils'
import {
	axialDistance,
	isPosition,
	Position,
	type Positioned,
	positionLerp,
	positionRoughlyEquals,
} from '../position'

unreactive(MiniScriptExecutor)
unreactive(NpcScript)
/**
 * Custom operators that extend JavaScript operators with position support
 */
export const gameOperators: Operators = Object.setPrototypeOf(
	{
		'=='(left: any, right: any) {
			return isPosition(left) && isPosition(right)
				? positionRoughlyEquals(left, right)
				: typeof left === 'number' && typeof right === 'number'
					? Math.abs(left - right) < epsilon
					: left === right
		},
		'!='(left: any, right: any) {
			return isPosition(left) && isPosition(right)
				? !positionRoughlyEquals(left, right)
				: typeof left === 'number' && typeof right === 'number'
					? Math.abs(left - right) >= epsilon
					: left !== right
		},
		'-'(left: any, right: any) {
			if (isPosition(left) && isPosition(right)) {
				return axialDistance(left, right)
			}
			return jsOperators['-'](left, right)
		},
	},
	jsOperators,
)

/**
 * Custom isa types that extend JavaScript isa types with position support
 */
export const gameIsaTypes: IsaTypes = Object.setPrototypeOf(
	{
		position: (_value: any) => Position.infer,
	},
	jsIsaTypes,
)
// Math utilities

export function lerp<T extends number | Positioned>(a: T, b: T, t: number): T {
	if (typeof a === 'number' && typeof b === 'number') {
		return (a + (b - a) * t) as T
	}
	if (isPosition(a) && isPosition(b)) {
		return positionLerp(a, b, t) as T
	}
	throw new Error(`Invalid lerp types: ${typeof a} and ${typeof b}`)
}
