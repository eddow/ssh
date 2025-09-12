// Load all .npcs files as raw text at build time

import D from 'flat-diamond'
import { computed, reactive } from 'mutts'
import type { ExecutionContext, ExecutionState } from 'npc-script'
import {
	FunctionDefinition,
	type IsaTypes,
	jsIsaTypes,
	jsOperators,
	NpcScript,
	type Operators,
} from 'npc-script/src'
import { objectMap } from '$lib/utils'
import type { Game } from '../game'
import { Position } from './position'

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

export const npcsContext: Record<string, any> = {}
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

class ScriptExecution {
	constructor(
		public readonly script: GameScript,
		public state: ExecutionState,
	) {}
	run(context: ExecutionContext) {
		const executor = this.script.executor(this.state, context)
		const { type, value } = executor.execute()
		if (type === 'yield') this.state = executor.state
		return value
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

abstract class SingleStepExecutor {
	abstract tick(dt: number): number | undefined
}

@reactive
export abstract class ScriptedActor extends D() {
	abstract readonly scriptContext: ExecutionContext
	public stepExecutor: SingleStepExecutor | undefined
	public runningScripts: ScriptExecution[] = []

	constructor(public readonly game: Game) {
		super()
	}

	abstract findAction(): ScriptExecution | undefined
	@computed
	get actionDescription() {
		return this.runningScripts.map((s) => s.script.name).reverse()
	}
	nextStep() {
		while (this.runningScripts.length && !this.stepExecutor) {
			const { type, value } = this.runningScripts[0].run(this.scriptContext)
			if (type === 'return') this.runningScripts.shift()
			if (value) {
				if (value instanceof ScriptExecution) this.runningScripts.unshift(value)
				else if (value instanceof SingleStepExecutor) this.stepExecutor = value
				else throw new Error(`Unexpected next action: ${value}`)
			} else if (!this.runningScripts.length) {
				const nextAction = this.findAction()
				if (nextAction) this.runningScripts.unshift(nextAction)
			}
		}
	}

	evolve(dt: number) {
		let remaining: number | undefined = dt
		while (remaining !== undefined && this.stepExecutor) {
			remaining = this.stepExecutor.tick(dt)
			if (remaining !== undefined) {
				this.stepExecutor = undefined
				this.nextStep()
			}
		}
	}
}
