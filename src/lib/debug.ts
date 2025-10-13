import { effect, reactiveOptions } from 'mutts/src'

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
	reactiveOptions.chain = (target: Function, caller?: Function) => {
		console.log(caller ? `${caller.name} -> ${target.name}` : `-> ${target.name}`)
	}
	reactiveOptions.beginChain = (target: Function) => {
		console.groupCollapsed(`${target.name}`)
	}
	reactiveOptions.endChain = () => {
		console.groupEnd()
	}
}
reactiveOptions.maxEffectChain = 100
reactiveOptions.maxEffectReaction = 'debug'
