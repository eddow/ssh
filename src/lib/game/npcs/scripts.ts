// TODO: Load all .npcs files as raw text at "build time"

import { type } from 'arktype'
import { Eventful, unreactive } from 'mutts'
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
import { deposits, goods, modules, terrain } from '$assets/game-content'
import { CharacterContract } from '$assets/scripts/contracts'
import type { Contract } from '$lib/arktype'
import { contract, overloadContract } from '$lib/arktype'
import { epsilon, objectMap } from '$lib/utils'
import { HexTile } from '../hexboard'
import type { GameObject, InteractiveGameObject } from '../object'
import {
	isPosition,
	Position,
	Positioned,
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
		position: (value: any) => Position.infer,
		tile: (value: any) => value instanceof HexTile,
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

type XOrDictX<X> = X | { [k: string]: XOrDictX<X> }

@unreactive
export class GlobalContext {
	@contract('unknown')
	debugger(value: any) {
		console.dir(value, { depth: null })
		debugger
	}
	@contract('string')
	error(message: string) {
		throw new Error(message)
	}
	// Basic math functions
	@contract('...', 'number[]')
	min(...args: number[]) {
		return Math.min(...args)
	}
	@contract('...', 'number[]')
	max(...args: number[]) {
		return Math.max(...args)
	}
	@contract('number')
	abs(arg: number) {
		return Math.abs(arg)
	}
	@contract('number')
	floor(arg: number) {
		return Math.floor(arg)
	}
	@contract('number')
	ceil(arg: number) {
		return Math.ceil(arg)
	}
	@contract('number', 'number', 'number')
	clamp(value: number, min: number, max: number) {
		return Math.max(min, Math.min(max, value))
	}

	// Interpolation and rounding
	@overloadContract(['number', 'number', 'number'], [Positioned, Positioned, 'number'])
	lerp<T extends number | Positioned>(a: T, b: T, t: number): T {
		return lerp(a, b, t)
	}
	@contract(type.or('number', Positioned))
	round<T extends number | Positioned>(a: T): T {
		if (typeof a === 'number') {
			return Math.round(a) as T
		}
		if (isPosition(a)) {
			const axial = toAxialCoord(a)
			return { q: Math.round(axial.q), r: Math.round(axial.r) } as T
		}
		throw new Error(`Invalid round type: ${typeof a}`)
	}
	@contract(type.or('number', Positioned), 'number?')
	roughly<T extends number | Positioned>(a: T, usedEpsilon = epsilon): T {
		if (typeof a === 'number') {
			return (Math.round(a / usedEpsilon) * usedEpsilon) as T
		}
		if (isPosition(a)) {
			return positionRoughly(a) as T
		}
		throw new Error(`Invalid roughly type: ${typeof a}`)
	}
}

export const subject = Symbol('subject')
export function protoCtx<Class extends abstract new () => object, Ext extends object>(
	concept: Class,
	ext?: Ext,
): InstanceType<Class> & Ext {
	const cp = concept.prototype
	delete cp.constructor
	return ext ? Object.setPrototypeOf(ext, cp) : cp
}
export class GameContext<Subject extends GameObject> extends GlobalContext {
	declare [subject]: Subject
	tileAt(positioned: Positioned) {
		return this[subject].game.hex.getTile(toAxialCoord(positioned))
	}
}

Object.assign(GameContext.prototype, { terrain, deposits, modules, goods })

export class InteractiveContext<
	Subject extends InteractiveGameObject,
> extends GameContext<Subject> {
	get tile() {
		return this[subject].tile
	}
	log(...args: any[]) {
		this[subject].log(...args)
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

function isXOrDictX<X>(x: XOrDictX<X>, Class: new (...args: any[]) => X): x is XOrDictX<X> {
	return (
		x instanceof Class ||
		(x && typeof x === 'object' && Object.values(x).every((v) => isXOrDictX(v, Class)))
	)
}

export type AsyncActionEvents = {
	cancel: () => void
	finish: () => void
}

@unreactive
export class ScriptExecution extends Eventful<AsyncActionEvents> {
	constructor(
		public readonly script: GameScript,
		public readonly name: string,
		public state?: ExecutionState,
	) {
		super()
	}
	cancel() {
		this.emit('cancel')
	}
	run(context: ExecutionContext) {
		if (!this.state) throw new Error('ScriptExecution was finished')
		const executor = this.script.executor(context, this.state)
		try {
			const result = executor.execute()
			this.state = result.type === 'yield' ? executor.state : undefined
			if (result.type === 'return') this.emit('finish')
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
	function exposeScripts(
		script: GameScript,
		entryPoint: XOrDictX<FunctionDefinition>,
		name: string,
		contract: Contract,
	): XoDe {
		if (entryPoint instanceof FunctionDefinition && Array.isArray(contract)) {
			const validate = type.raw(contract)
			return (...args: any[]) => {
				const result = validate(args)
				if (result instanceof type.errors) {
					throw new Error(`Validation failed for ${name}: ${result.summary}`)
				}
				return new ScriptExecution(script, name, entryPoint.call(args))
			}
		}
		if (!(entryPoint instanceof FunctionDefinition) && !Array.isArray(contract)) {
			return objectMap(entryPoint, (value, key) => {
				const nextName = `${name}.${key}`
				const nextProto = (contract as { [K: string]: Contract })[key]
				return exposeScripts(script, value, nextName, nextProto)
			}) as XoDe
		}
		throw new Error(`Invalid contract type for entry point ${name}: ${typeof contract} ${contract}`)
	}

	for (const [name, { gameScript, value }] of Object.entries(npcScripts)) {
		const exposed = exposeScripts(
			gameScript,
			value,
			name,
			CharacterContract[name as keyof typeof CharacterContract],
		)
		const existing = (context as any)[name]
		if (name in context && typeof context[name] === 'object') {
			Object.assign(existing, exposed)
		} else {
			context[name] = exposed
		}
	}
	return context
}
