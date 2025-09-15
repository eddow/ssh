// TODO: Load all .npcs files as raw text at build time
import type { ExecutionContext, ExecutionState } from 'npc-script/src'
import {
	FunctionDefinition,
	type IsaTypes,
	jsIsaTypes,
	jsOperators,
	NpcScript,
	MiniScriptExecutor,
	type Operators,
} from 'npc-script/src'
import { epsilon, objectMap } from '$lib/utils'
import { HexTile } from '../hexboard'
import type { GameObject } from '../object'
import { Position } from '../position'
import { unreactive } from 'mutts'

unreactive(MiniScriptExecutor)
unreactive(NpcScript)
/**
 * Custom operators that extend JavaScript operators with position support
 */
export const gameOperators: Operators = Object.setPrototypeOf(
	{
		'=='(left: any, right: any) {
			return left instanceof Position && right instanceof Position
				? left.roughlyEquals(right)
				: typeof left === 'number' && typeof right === 'number'
					? Math.abs(left - right) < epsilon
					: left === right
		},
		'!='(left: any, right: any) {
			return left instanceof Position && right instanceof Position
				? !left.roughlyEquals(right)
				: typeof left === 'number' && typeof right === 'number'
					? Math.abs(left - right) >= epsilon
					: left !== right
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
		tile: (value: any) => value instanceof HexTile,
	},
	jsIsaTypes,
)
//!TODO: Heavy argument validation
// Math utilities
@unreactive
class GlobalUtils implements ExecutionContext {
	debugger(value: any) {
		console.dir(value, { depth: null })
		debugger
	}
	// Basic math functions
	min(... args: any[]) {
		return Math.min(...args)
	}
	max(... args: any[]) {
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
		if (a instanceof Position) {
			return Position.fromQR(Math.round(a.q), Math.round(a.r)) as T
		}
		throw new Error(`Invalid round type: ${typeof a}`)
	}
	roughly<T extends number | Position>(a: T, usedEpsilon = epsilon): T {
		if (typeof a === 'number') {
			return (Math.round(a / usedEpsilon) * usedEpsilon) as T
		}
		if (a instanceof Position) {
			return Position.fromQR(
				Math.round(a.q / usedEpsilon) * usedEpsilon,
				Math.round(a.r / usedEpsilon) * usedEpsilon,
			) as T
		}
		throw new Error(`Invalid roughly type: ${typeof a}`)
	}
}

export class GameUtils extends GlobalUtils {
	readonly #subject: GameObject
	constructor(gameObject: GameObject) {
		super()
		this.#subject = gameObject
	}
	tileAt(position: Position) {
		return this.#subject.game.hex.getTile(position)
	}
}
class GameScript extends NpcScript {
	constructor(
		public readonly name: string,
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
		const result = executor.execute()
		this.state = result.type === 'yield' ? executor.state : undefined
		return result
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
			const gameScript = new GameScript(name, source)
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
		context[name] = exposeScripts(gameScript, value)
	}
	return context
}

export function lerp<T extends number | Position>(a: T, b: T, t: number): T {
	if (typeof a === 'number' && typeof b === 'number') {
		return (a + (b - a) * t) as T
	}
	if (a instanceof Position && b instanceof Position) {
		return a.lerpTo(b, t) as T
	}
	throw new Error(`Invalid lerp types: ${typeof a} and ${typeof b}`)
}
