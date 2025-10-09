import { watch } from 'mutts/src'
import { untrack } from 'svelte'
import { nf } from './debug'
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
 * @returns A Svelte reactive getter to feed to `$derived.by`
 */
export function p2s<T extends object | any[] | undefined>(getter: () => T): () => T | undefined {
	let value = $state<T | undefined>(undefined)
	let initialized = $state(false)

	$effect(() => {
		const unwatch = watch(
			getter,
			nf('p2s', (newVal: T) => {
				// Use untrack to prevent the state updates from triggering effects
				untrack(() => {
					value = newVal
					initialized = true
				})
			}),
			{ immediate: true },
		)

		return unwatch
	})

	return () => (initialized ? value : getter())
}
// TODO: proxy -> $state(sub)?
