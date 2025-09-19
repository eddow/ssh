import { effect as mEffect, unwrap, watch } from 'mutts'
import type { Subscriber, Unsubscriber, Writable } from 'svelte/store'

function deepClone<T>(value: T): T {
	if (typeof value !== 'object' || value === null) return value
	const uo = unwrap(value)
	const uop = Object.getPrototypeOf(uo)
	if (uop === Object.prototype)
		return Object.fromEntries(
			Object.entries(uo).map(([key, value]) => [key, deepClone(value)]),
		) as T
	if (uop === Array.prototype)
		// @ts-expect-error
		return uo.map(deepClone)
	return uo
}

/**
 * Mutts to Svelte store
 * @param muttsValue mutts value
 */
type AnyFn = (...args: any[]) => any
type NonFunction<T> = T extends AnyFn ? never : T
export function ms<T>(factory: () => T, deep?: false): Writable<T>

// 2) Factory returning object: deep optional (true|undefined)
export function ms<T extends object | undefined>(factory: () => T, deep: true): Writable<T>

// 1) Plain value that is NOT a function
export function ms<T extends object | any[]>(value: NonFunction<T>): Writable<T>
export function ms<T>(muttsValue: (() => T) | T, deep: boolean = false): Writable<T> {
	const subscribers = new Set<Subscriber<T>>()
	let cleanup: Unsubscriber | undefined
	function subscribe(this: void, run: Subscriber<T>): Unsubscriber {
		subscribers.add(run)
		if (cleanup === undefined) {
			cleanup = watch(
				muttsValue as any,
				(value: T) => {
					const clonedValue = deep ? deepClone(value) : value
					for (const run of subscribers) run(clonedValue)
				},
				{ immediate: true, deep },
			)
		}
		return () => {
			subscribers.delete(run)
			if (subscribers.size === 0) {
				cleanup?.()
				cleanup = undefined
			}
		}
	}
	// writing is done on property set - though replacing the value won't od the job here
	function set(value: T) {
		//debugger
	}
	function update(updater: (value: T) => T) {
		//set(updater(typeof muttsValue === 'function' ? muttsValue() : muttsValue))
	}
	return { subscribe, set, update }
}

function copyInto(from: object, to?: object) {
	if (!to) to = Object.create(Object.getPrototypeOf(from))
	for (const key of Object.getOwnPropertyNames(to)) delete to![key as keyof object]
	const fromProps = Object.getOwnPropertyDescriptors(from)
	for (const [key, value] of Object.entries(fromProps))
		if ('value' in value)
			// @ts-expect-error
			to![key] = value.value
	return to
}
/**
 * Converts a Mutts reactive object/array to a Svelte reactive object/array.
 *
 * ⚠️ IMPORTANT: This function MUST be called within component context
 * (inside a .svelte file or component function) where $state and $effect are available.
 *
 * Usage:
 * - In templates: `{#each m2s(myMuttsArray) as item}` (if array)
 * - In derived: `let derived = $derived(m2s(myMuttsArray))` (if object)
 *
 * @param muttsValue The Mutts reactive object/array to convert
 * @returns A Svelte reactive object/array that stays in sync with the Mutts object/array
 */
export function m2s<T extends object | any[]>(muttsValue: T): T {
	if (Array.isArray(muttsValue)) {
		const array = $state([...muttsValue])
		mns(() => array.splice(0, array.length, ...(muttsValue as any[])))
		return array as T
	}
	const state = $state(copyInto(muttsValue) as T)
	$effect(() =>
		watch(muttsValue, (value: T) => {
			copyInto(value, state)
		}),
	)
	return state
}

/**
 * Mutts aNd Svelte effect
 * @param cb
 */
export function mns(cb: () => void) {
	$effect(() =>
		mEffect(() => {
			cb()
		}),
	)
}
