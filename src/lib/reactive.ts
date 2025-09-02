export type EffectFunction = () => void
export type UnwatchFunction = () => void

// Stack of active effects to handle nested effects
let activeEffect: EffectFunction | undefined
// Track effects per reactive object and property
const watchers = new WeakMap<object, Map<PropertyKey, Set<EffectFunction>>>()
// Track which effects are watching which reactive objects for cleanup
const effectToReactiveObjects = new Map<EffectFunction, Set<object>>()
// Track currently executing effects to prevent re-execution
const plannedEffects = new Set<EffectFunction>()

// Track object -> proxy and proxy -> object relationships
const objectToProxy = new WeakMap<object, object>()
const proxyToObject = new WeakMap<object, object>()

export class ReactiveError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "ReactiveError"
	}
}

/**
 * Options for the reactive system, can be configured at runtime
 */
export const options = {
	/**
	 * Debug purpose: called when an effect is entered
	 * @param effect - The effect that is entered
	 */
	enter: (effect: EffectFunction) => {},
	/**
	 * Debug purpose: called when an effect is left
	 * @param effect - The effect that is left
	 */
	leave: (effect: EffectFunction) => {},
	/**
	 * Debug purpose: called when an effect is chained
	 * @param caller - The effect that is calling the target
	 * @param target - The effect that is being triggered
	 */
	chain: (caller: EffectFunction, target: EffectFunction) => {},
	/**
	 * Debug purpose: maximum effect chain (like call stack max depth)
	 * Used to prevent infinite loops
	 * @default 100
	 */
	maxEffectChain: 100,
	/**
	 * Only react on instance members modification (not inherited properties)
	 * @default true
	 */
	instanceMembers: true,
} as const

function hasEffect(effect: EffectFunction) {
	plannedEffects.add(effect)
	let effectCount = 0
	if (!activeEffect) {
		try {
			while (plannedEffects.size) {
				if (effectCount > options.maxEffectChain)
					throw new ReactiveError("[reactive] Max effect chain reached")
				effectCount++
				const effect = plannedEffects.values().next().value!
				effect()
				plannedEffects.delete(effect)
			}
		} finally {
			plannedEffects.clear()
		}
	} else options?.chain(activeEffect, effect)
}

const reactiveHandlers = {
	get(obj: any, prop: PropertyKey, receiver: any) {
		function get() {
			if(!(prop in obj)) return undefined
			let browser = obj, pD = Object.getOwnPropertyDescriptor(browser, prop)
			while(!pD && pD !== Object.prototype) {
				browser = Object.getPrototypeOf(browser)
				pD = Object.getOwnPropertyDescriptor(browser, prop)
			}
			return pD.get ? pD.get.call(receiver) : obj[prop]
		}
		// Only track own properties, not inherited methods or properties
		if (!options.instanceMembers || Object.hasOwn(obj, prop)) {
			if (activeEffect) {
				const objectWatchers = watchers.get(receiver) || new Map<PropertyKey, Set<EffectFunction>>()
				const deps = objectWatchers.get(prop) || new Set<EffectFunction>()
				deps.add(activeEffect)
				objectWatchers.set(prop, deps)
				watchers.set(receiver, objectWatchers)

				// Track which reactive objects this effect is watching
				const effectObjects = effectToReactiveObjects.get(activeEffect) || new Set<object>()
				effectObjects.add(receiver)
				effectToReactiveObjects.set(activeEffect, effectObjects)
			}
			return reactive(get())
		}
		return get()
	},
	set(obj: any, prop: PropertyKey, value: any, receiver: any): boolean {
		const oldVal = (obj as any)[prop]
		;(obj as any)[prop] = reactive(value)
		if (oldVal !== value) {
			const objectWatchers = watchers.get(receiver)
			if (objectWatchers) {
				const deps = objectWatchers.get(prop)
				if (deps) {
					const theseDeps = Array.from(deps)
					for (const effect of theseDeps) hasEffect(effect)
				}
			}
		}
		return true
	},
}

export function reactive<T extends Record<PropertyKey, any>>(target: T): T {
	// If target is already a proxy, return it
	if (proxyToObject.has(target)) {
		return target as T
	}

	// If we already have a proxy for this object, return it
	if (objectToProxy.has(target)) {
		return objectToProxy.get(target) as T
	}

	// Don't make reactive objects from already reactive ones
	if (target && typeof target === "object" && !Array.isArray(target)) {
		const proxy = new Proxy(target, reactiveHandlers)

		// Store the relationships
		objectToProxy.set(target, proxy)
		proxyToObject.set(proxy, target)

		return proxy as T
	}

	return target
}

export function unwrap<T>(proxy: T): T {
	// If it's not a proxy, return as-is
	if (!proxyToObject.has(proxy as any)) {
		return proxy
	}

	// Return the original object
	return proxyToObject.get(proxy as any) as T
}

export function isReactive(obj: any): boolean {
	return proxyToObject.has(obj)
}

/**
 *
 * @param fn - The effect function to run
 * @param reaction - The effect-less function to run each time the effect is run
 * @returns The cleanup function
 */
export function effect(
	fn: EffectFunction,
	reaction?: () => UnwatchFunction | undefined,
): UnwatchFunction {
	// Prevent nested effects
	if (activeEffect) {
		throw new ReactiveError(
			"Nested effects are not allowed. Effects cannot be created inside other effects.",
		)
	}

	let cleanup: (() => void) | null = null

	function runEffect() {
		// Clear previous dependencies
		if (cleanup) {
			cleanup()
			cleanup = null
		}

		// Push this effect onto the active effects stack
		activeEffect = runEffect

		options.enter(fn)
		try {
			// Run the effect function
			fn()
		} finally {
			// Pop this effect from the active effects stack
			activeEffect = undefined
			options.leave(fn)
		}
		const reactionCleanup = reaction?.()

		// Create cleanup function for next run
		cleanup = () => {
			reactionCleanup?.()
			// Remove this effect from all reactive objects it's watching
			const effectObjects = effectToReactiveObjects.get(runEffect)
			if (effectObjects) {
				for (const reactiveObj of effectObjects) {
					const objectWatchers = watchers.get(reactiveObj)
					if (objectWatchers) {
						for (const [prop, deps] of objectWatchers.entries()) {
							deps.delete(runEffect)
							if (deps.size === 0) {
								objectWatchers.delete(prop)
							}
						}
						if (objectWatchers.size === 0) {
							watchers.delete(reactiveObj)
						}
					}
				}
				effectToReactiveObjects.delete(runEffect)
			}
		}
	}

	// Run the effect immediately
	runEffect()

	return (): void => {
		if (cleanup) {
			cleanup()
			cleanup = null
		}
	}
}
/**
 * Mixin to have a class defining reactive objects
 * Note: creates a proxy per instance, not per prototype, so that instances can be `unwrap`-ed
 * @param target - The object to make reactive
 * @returns The reactive object
 */
export const Reactive = <Base extends new (...args: any[]) => any>(Base: Base = Object as any) =>
	class Reactive extends Base {
		constructor(...args: any[]) {
			super(...args)
			//biome-ignore lint/correctness/noConstructorReturn: This is the whole point of this mixin
			return reactive(this)
		}
	}
