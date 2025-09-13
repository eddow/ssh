// TODO: Load all .npcs files as raw text at build time
import type { ExecutionContext, ExecutionState } from 'npc-script'
import { epsilon } from '$lib/utils'
import {
	FunctionDefinition,
	type IsaTypes,
	jsIsaTypes,
	jsOperators,
	NpcScript,
	type Operators,
} from 'npc-script/src'
import { objectMap } from '$lib/utils'
import { Position } from '../position'

/**
 * Custom operators that extend JavaScript operators with position support
 */
export const gameOperators: Operators = Object.setPrototypeOf(
	{
		'=='(left: any, right: any) {
			if (left instanceof Position && right instanceof Position) {
				return left.equals(right)
			}
			return jsOperators['=='](left, right)
		},
		'!='(left: any, right: any) {
			if (left instanceof Position && right instanceof Position) {
				return left.notEquals(right)
			}
			return jsOperators['!='](left, right)
		},
		'-'(left: any, right: any) {
			if (left instanceof Position && right instanceof Position) {
				return left.distanceTo(right)
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
		position: (value: any) => value instanceof Position,
	},
	jsIsaTypes,
)

// Math utilities
const mathUtils = {
	// Basic math functions
	min: Math.min,
	max: Math.max,
	abs: Math.abs,
	floor: Math.floor,
	ceil: Math.ceil,
	clamp: (value: number, min: number, max: number) => Math.max(min, Math.min(max, value)),
	
	// Interpolation and rounding
	lerp<T extends number|Position>(a: T, b: T, t: number): T {
		if (typeof a === 'number' && typeof b === 'number') {
			return (a + (b - a) * t) as T
		}
		if (a instanceof Position && b instanceof Position) {
			return a.lerpTo(b, t) as T
		}
		throw new Error(`Invalid lerp types: ${typeof a} and ${typeof b}`)
	},
	round<T extends number|Position>(a: T): T {
		if (typeof a === 'number') {
			return Math.round(a) as T
		}
		if (a instanceof Position) {
			return Position.fromQR(Math.round(a.q), Math.round(a.r)) as T
		}
		throw new Error(`Invalid round type: ${typeof a}`)
	},
	roughly<T extends number|Position>(a: T, usedEpsilon = epsilon): T {
		if (typeof a === 'number') {
			return Math.round(a / usedEpsilon) * usedEpsilon as T
		}
		if (a instanceof Position) {
			return Position.fromQR(
				Math.round(a.q / usedEpsilon) * usedEpsilon,
				Math.round(a.r / usedEpsilon) * usedEpsilon
			) as T
		}
		throw new Error(`Invalid roughly type: ${typeof a}`)
	}
	
}

export const npcsContext: Record<string, any> = {
	// Math utilities
	...mathUtils,
}
class GameScript extends NpcScript {
	constructor(
		public readonly name: string,
		source: string,
	) {
		super(source, npcsContext, gameOperators, gameIsaTypes)
	}
}
const modules = import.meta.glob('$assets/scripts/**/*.npcs', {
	query: '?raw',
	eager: true,
}) as Record<string, string>

type XOrDictX<X> = X | { [k: string]: XOrDictX<X> }

function isXOrDictX<X>(x: XOrDictX<X>, Class: new (...args: any[]) => X): x is XOrDictX<X> {
	return (
		x instanceof Class ||
		(x && typeof x === 'object' && Object.values(x).every((v) => isXOrDictX(v, Class)))
	)
}

export class ScriptExecution {
	constructor(
		public readonly script: GameScript,
		public state?: ExecutionState,
	) {}
	run(context: ExecutionContext) {
		if (!this.state) throw new Error('ScriptExecution was finished')
		const executor = this.script.executor(this.state, context)
		const result = executor.execute()
		this.state = result.type === 'yield' ? executor.state : undefined
		return result
	}
}
export const npcScripts = Object.fromEntries(
	Object.entries(modules).map(([path, source]) => {
		const name = path
			.split('/scripts/')
			.pop()!
			.match(/(.*)\.npcs$/)?.[1]!
			.replace(/\//g, '.')!
		const gameScript = new GameScript(name, source)
		const executed = gameScript.execute()
		if (executed.type !== 'return') {
			throw new Error(
				`Script ${gameScript.name} did not return a value. Expected: a function or a map of functions. Got: ${executed.type}`,
			)
		}
		if (!isXOrDictX(executed.value, FunctionDefinition)) {
			throw new Error(
				`Script ${gameScript.name} returned a value that is not a function or a map of functions. Got: ${executed.value}`,
			)
		}
		return [name, { gameScript, value: executed.value }]
	}),
)

function exposeScripts(
	script: GameScript,
	entryPoint: XOrDictX<FunctionDefinition>,
): XOrDictX<(...args: any[]) => ScriptExecution> {
	return entryPoint instanceof FunctionDefinition
		? (...args: any[]) => new ScriptExecution(script, entryPoint.call(args))
		: (objectMap(entryPoint, (value) => exposeScripts(script, value)) as XOrDictX<
				(...args: any[]) => ScriptExecution
			>)
}

for (const [name, { gameScript, value }] of Object.entries(npcScripts)) {
	npcsContext[name] = exposeScripts(gameScript, value)
}

export abstract class SingleStepExecutor {
	abstract tick(dt: number): number | undefined
	abstract readonly description: string
	
}
