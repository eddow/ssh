import { watch, effect as mEffect } from "mutts"
import type { Readable, Subscriber, Unsubscriber } from "svelte/store"

/**
 * Mutts to Svelte store
 * @param muttsValue mutts value
 */
export function ms<T>(muttsValue: () => T): Readable<T>
export function ms<T extends object>(muttsValue: T): Readable<T>
export function ms<T>(muttsValue: (() => T) | T): Readable<T> {
	const subscribers = new Set<Subscriber<T>>()
	let cleanup: Unsubscriber | undefined
	function subscribe(this: void, run: Subscriber<T>): Unsubscriber {
		subscribers.add(run)
		if (cleanup === undefined) {
			cleanup = watch(muttsValue as any, (value: T) => {
				for(const run of subscribers) run(value)
			}, { immediate: true })
		}
		return () => {
			subscribers.delete(run)
			if (subscribers.size === 0) {
				cleanup?.()
				cleanup = undefined
			}
		}
	}
	
	return { subscribe }
}

function copyInto(from: object, to?: object) {
	if(!to) to = Object.create(Object.getPrototypeOf(from))
	for(const key of Object.getOwnPropertyNames(to))
		delete to![key as keyof object]
	for(const key in from) if(from.hasOwnProperty(key) || !Number.isNaN(Number(key)))
		to![key as keyof object] = from[key as keyof object]
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
	if(Array.isArray(muttsValue)) {
		let array = $state([...muttsValue])	
		mns(()=> array.splice(0, array.length, ...muttsValue as any[]))
		return array as T
	}
	const state = $state(copyInto(muttsValue) as T)
	$effect(()=> watch(muttsValue, (value: T) => {
		copyInto(value, state)
	}))
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
		})
	)
}
