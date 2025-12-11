import { effect, enableDevTools, reactiveOptions } from 'mutts/src'

export function nf<T extends Function>(name: string, fn: T): T {
	Object.defineProperty(fn, 'name', { value: name })
	return fn
}
export function namedEffect(name: string, fn: () => void): () => void {
	return effect(nf(name, fn))
}
export class AssertionError extends Error {
	constructor(message: string) {
		super(`Assertion failure: ${message}`)
		this.name = 'AssertionError'
	}
}
export function assert(condition: any, message: string): asserts condition {
	if (!condition) throw new AssertionError(message)
}
export function defined<T>(value: T | undefined, message = 'Value is defined'): T {
	assert(value !== undefined, message)
	return value
}

export const traces: Record<string, typeof console | undefined> = {}

//traces.advertising = console
const debugMutts = false
if (debugMutts) {
	reactiveOptions.chain = (targets: Function[], caller?: Function) => {
		console.log(
			caller
				? `${caller.name} -> ${targets.map((t) => t.name).join(' -> ')}`
				: `-> ${targets.map((t) => t.name).join(' -> ')}`,
		)
	}
	reactiveOptions.beginChain = (targets: Function[]) => {
		console.groupCollapsed(`${targets.map((t) => t.name).join(' -> ')}`)
	}
	reactiveOptions.endChain = () => {
		console.groupEnd()
	}
	reactiveOptions.skipRunningEffect = (effect: Function, chain: Function[]) => {
		console.log(
			`Skipping running effect: ${chain.map((t) => t.name).join(' -> ')} -> ${effect.name}`,
		)
	}
}
reactiveOptions.maxEffectChain = 100
reactiveOptions.maxEffectReaction = 'debug'
enableDevTools()
