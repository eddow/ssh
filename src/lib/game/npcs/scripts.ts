// TODO: Load all .npcs files as raw text at build time

import { unreactive } from 'mutts'
import type { ExecutionContext, ExecutionState } from 'npc-script/src'
import {
	ExecutionError,
	FunctionDefinition,
	type IsaTypes,
	jsIsaTypes,
	jsOperators,
	MiniScriptExecutor,
	NpcScript,
	type Operators,
} from 'npc-script/src'
import { epsilon, objectMap } from '$lib/utils'
import { HexTile } from '../hexboard'
import type { GameObject, InteractiveGameObject } from '../object'
import {
	isPosition,
	type Position,
	positionDistance,
	positionLerp,
	positionRoughly,
	positionRoughlyEquals,
	toAxialCoord,
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
				return positionDistance(left, right)
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
		position: (value: any) => isPosition(value),
		tile: (value: any) => value instanceof HexTile,
	},
	jsIsaTypes,
)
//!TODO: Heavy argument validation
// Math utilities
@unreactive
class GlobalContext implements ExecutionContext {
	debugger(value: any) {
		console.dir(value, { depth: null })
		debugger
	}
	error(message: string) {
		throw new Error(message)
	}
	// Basic math functions
	min(...args: any[]) {
		return Math.min(...args)
	}
	max(...args: any[]) {
		return Math.max(...args)
	}
	abs(args: any) {
		return Math.abs(args)
	}
	floor(args: any) {
		return Math.floor(args)
	}
	ceil(args: any) {
		return Math.ceil(args)
	}
	clamp(value: number, min: number, max: number) {
		return Math.max(min, Math.min(max, value))
	}

	// Interpolation and rounding
	lerp(a: number, b: number, t: number) {
		return lerp(a, b, t)
	}
	round<T extends number | Position>(a: T): T {
		if (typeof a === 'number') {
			return Math.round(a) as T
		}
		if (isPosition(a)) {
			const axial = toAxialCoord(a)
			return { q: Math.round(axial.q), r: Math.round(axial.r) } as T
		}
		throw new Error(`Invalid round type: ${typeof a}`)
	}
	roughly<T extends number | Position>(a: T, usedEpsilon = epsilon): T {
		if (typeof a === 'number') {
			return (Math.round(a / usedEpsilon) * usedEpsilon) as T
		}
		if (isPosition(a)) {
			return positionRoughly(a) as T
		}
		throw new Error(`Invalid roughly type: ${typeof a}`)
	}
}

export class GameContext extends GlobalContext {
	readonly #gameObject: GameObject
	constructor(gameObject: GameObject) {
		super()
		this.#gameObject = gameObject
	}
	tileAt(position: Position) {
		return this.#gameObject.game.hex.getTile(toAxialCoord(position))
	}
}

export class InteractiveContext extends GameContext {
	#interactive: InteractiveGameObject
	constructor(interactive: InteractiveGameObject) {
		super(interactive)
		this.#interactive = interactive
	}
	get tile() {
		return this.#interactive.tile
	}
	log(...args: any[]) {
		this.#interactive.log(...args)
	}
}

class GameScript extends NpcScript {
	constructor(
		public readonly name: string,
		public readonly fileName: string,
		source: string,
	) {
		super(source, gameOperators, gameIsaTypes)
	}
}

type XOrDictX<X> = X | { [k: string]: XOrDictX<X> }

function isXOrDictX<X>(x: XOrDictX<X>, Class: new (...args: any[]) => X): x is XOrDictX<X> {
	return (
		x instanceof Class ||
		(x && typeof x === 'object' && Object.values(x).every((v) => isXOrDictX(v, Class)))
	)
}

@unreactive
export class ScriptExecution {
	constructor(
		public readonly script: GameScript,
		public state?: ExecutionState,
	) {}
	run(context: ExecutionContext) {
		if (!this.state) throw new Error('ScriptExecution was finished')
		const executor = this.script.executor(context, this.state)
		try {
			const result = executor.execute()
			this.state = result.type === 'yield' ? executor.state : undefined
			return result
		} catch (error) {
			if (error instanceof ExecutionError)
				console.error(this.script.sourceLocation(error.statement))
			throw error
		}
	}
}

export function loadNpcScripts(modules: Record<string, string>, context: ExecutionContext) {
	const npcScripts = Object.fromEntries(
		Object.entries(modules).map(([path, source]) => {
			const name = path
				.split('/scripts/')
				.pop()!
				.match(/(.*)\.npcs$/)?.[1]!
				.replace(/\//g, '.')!
			const gameScript = new GameScript(name, path, source)
			const executed = gameScript.execute(context)
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

	type XoDe = XOrDictX<(...args: any[]) => ScriptExecution>
	function exposeScripts(script: GameScript, entryPoint: XOrDictX<FunctionDefinition>): XoDe {
		return entryPoint instanceof FunctionDefinition
			? (...args: any[]) => new ScriptExecution(script, entryPoint.call(args))
			: (objectMap(entryPoint, (value) => exposeScripts(script, value)) as XoDe)
	}

	for (const [name, { gameScript, value }] of Object.entries(npcScripts)) {
		const exposed = exposeScripts(gameScript, value)
		const existing = (context as any)[name]
		if (name in context && typeof context[name] === 'object') {
			Object.assign(existing, exposed)
		} else {
			context[name] = exposed
		}
	}
	return context
}

export function lerp<T extends number | Position>(a: T, b: T, t: number): T {
	if (typeof a === 'number' && typeof b === 'number') {
		return (a + (b - a) * t) as T
	}
	if (isPosition(a) && isPosition(b)) {
		return positionLerp(a, b, t) as T
	}
	throw new Error(`Invalid lerp types: ${typeof a} and ${typeof b}`)
}
