import { computed, Reactive, reactive } from "mutts"
import type { AxialCoord, WorldCoord } from "$lib/hex"
import type { InteractiveGameObject } from "../object"

export class CancelledError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "CancelledError"
	}
}
type Lerpable = number | AxialCoord | WorldCoord
export function lerp<T extends Lerpable>(a: T, b: T, t: number): T {
	if (typeof a === "number" && typeof b === "number") return (a + (b - a) * t) as T
	if (typeof a === "object" && typeof b === "object") {
		if ("q" in a && "q" in b) return { q: lerp(a.q, b.q, t), r: lerp(a.r, b.r, t) } as T
		if ("x" in a && "x" in b) return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) } as T
	}
	throw new Error(`Invalid lerpable type: ${typeof a}`)
}

export type Plan<Activated extends InteractiveGameObject> = (
	plan: (activity: ActivityManager<Activated>) => Promise<void>,
	description?: string,
) => Promise<void>
export type LerpSpecification<T extends Lerpable> = {
	duration: number
	from: T
	to: T
}

interface NumericEvolution {
	value: number
	factor?: number
	bound?: number
}
function numberEvolve(specs: NumericEvolution, dt: number, resolve?: () => void) {
	const { value, factor = 1, bound = 0 } = specs
	const maxDt = (bound - value) / factor
	if (dt > maxDt) {
		const remaining = dt - maxDt
		specs.value = bound
		resolve?.()
		return remaining
	}
	specs.value = value + factor * dt
}

export default class ActivityManager<Activated extends InteractiveGameObject> extends Reactive(Object) {
	constructor(public readonly activated: Activated) {
		super()
	}
	public readonly descriptions: string[] = []
	private types: string[] = []
	@computed
	get activity() {
		return this.types[0]
	}
	private remainingDt: number = 0

	private async wrap<T>(
		promise: Promise<T> | (() => Promise<T>),
		type?: string,
		description?: string,
	): Promise<T> {
		if (type) this.types.unshift(type)
		if (!!description) {
			this.descriptions.push(description)
			this.log(description)
		}
		const oldReject = this.reject
		const rejectPromise = new Promise<T>((_resolve, pReject) => {
			this.reject = pReject
		})
		try {
			return await Promise.race([
				typeof promise === "function" ? promise() : promise,
				rejectPromise,
			])
		} catch (error) {
			if (!(error instanceof CancelledError)) {
				this.log(`Error on ${description}:\n${error}`)
				if (error instanceof Error) console.log(error.stack)
			}
			throw error
		} finally {
			if (type) this.types.shift()
			if (description) this.descriptions.pop()
			this.reject = oldReject
		}
	}
	log = (...args: any[]): void => this.activated.log(...args)

	plan = <T>(plan: (activity: ActivityManager<Activated>) => Promise<T>, description?: string) =>
		this.wrap(() => plan(this), plan.name, description)

	atomicProgress?: (dt: number) => number | undefined
	reject?: (reason?: any) => void
	cancel(reason: string) {
		if (!this.reject) return
		this.log(`Cancelled: ${this.descriptions.join(" | ")}: ${reason}`)
		this.reject(new CancelledError(reason))
	}

	public evolve(dt: number = 0) {
		const { atomicProgress, reject } = this
		if (!atomicProgress) return
		try {
			dt += this.remainingDt
			if (dt) this.remainingDt = atomicProgress(dt) ?? 0
		} catch (error) {
			reject!(error)
		}
	}

	step = <T>(
		progress: (dt: number, resolve: (v: T) => void) => number | undefined,
		description?: string,
		type?: string,
	): Promise<T> => {
		let resolve: (value: T) => void = null!
		this.atomicProgress = (dt: number) => progress(dt, resolve)
		const promise = this.wrap(
			new Promise<T>((pResolve, reject) => {
				resolve = pResolve
			}),
			type || progress.name,
			description,
		).finally(() => {
			this.atomicProgress = undefined
		})
		this.evolve()
		return promise
	}
	evolveStep = (<T>(
		specs: NumericEvolution,
		complete?: (() => T) | string,
		type?: string,
		description?: string,
	): Promise<T> => {
		if (typeof complete === "string") {
			description = type
			type = complete
			complete = undefined
		}
		return this.step(
			(dt: number, resolve: (v: T) => void) => {
				return numberEvolve(
					specs,
					dt,
					// @ts-expect-error No mood to manage the cases with void/number here
					complete ? () => resolve(complete()) : resolve,
				)
			},
			description,
			type,
		)
	}) as (<T>(
		specs: NumericEvolution,
		complete?: () => T,
		type?: string,
		description?: string,
	) => Promise<T>) &
		((specs: NumericEvolution, type?: string, description?: string) => Promise<void>)
	lerpStep = (<T extends Lerpable, R>(
		spec: number | LerpSpecification<T>,
		progress: ((lerp: T | number) => void) | string,
		complete?: string | (() => R),
		description?: string,
	) => {
		const { from, to } = typeof spec === "number" ? {} : spec
		const duration = typeof spec === "number" ? spec : spec.duration
		const progressFn =
			typeof progress === "string"
				? undefined
				: typeof spec === "number"
					? progress
					: (e: number) => progress(lerp(from!, to!, e))

		const type = typeof progress === "string" ? progress : progress.name
		if (typeof complete === "string") {
			description = complete
			complete = undefined
		}

		let evolution = 0
		return this.evolveStep(
			{
				get value() {
					return evolution
				},
				set value(v) {
					evolution = v
					progressFn?.(v / duration)
				},
				bound: duration,
			},
			complete,
			type,
			description,
		)
	}) as ((
		duration: number,
		progress: ((lerp: number) => void) | string,
		description?: string,
	) => Promise<void>) &
		(<R>(
			duration: number,
			progress: ((lerp: number) => void) | string,
			complete: () => R,
			description?: string,
		) => Promise<R>) &
		(<T extends Lerpable>(
			specs: LerpSpecification<T>,
			progress: ((lerp: T) => void) | string,
			description?: string,
		) => Promise<void>) &
		(<T extends Lerpable, R>(
			specs: LerpSpecification<T>,
			progress: ((lerp: T) => void) | string,
			complete: () => R,
			description?: string,
		) => Promise<R>)
	idle = (duration: number, description?: string, type?: string) =>
		this.lerpStep(duration, type ?? "idle", description)
	waitFor = <T>(
		promise: Promise<T>,
		timeout: number,
		description?: string,
		type: string = "idle",
	): Promise<T> => {
		let reject: (reason?: any) => void = null!
		this.remainingDt = 0
		const timeoutPromise = new Promise<T>((_resolve, pReject) => {
			reject = pReject
			setTimeout(() => {
				reject(new CancelledError(`Timeout: ${description}`))
			}, timeout)
		})
		return this.wrap(Promise.race([promise, timeoutPromise]), type, description)
	}

	/* TODO: emergencies -> character
	affectBuilding(): void {
		const { activated: character, workPlace } = this
		if (workPlace) {
			// Start work with a coffee pause
			character.fatigue = trigger_levels.fatigue.high
			goTo(this.plan, workPlace, "Going to work")
		}
	}

	async emergency(urgency: Urgency, promise: () => Promise<void>) {
		this.urgency = urgency
		if (this.reject) {
			// TODO: reject waiting promise) {
			this.cancel("Emergency")
		}
		try {
			await promise()
		} catch (error) {
			if (error instanceof Error && !(error instanceof CancelledError)) console.log(error.stack)
		} finally {
			this.urgency = "0-none"
		}
	}
	_process(delta: number): void {
		const { activated: character } = this

		if (character.hunger > trigger_levels.hunger.critical && this.urgency < "3-hungry")
			this.emergency("3-hungry", () => goEat(this.plan))
		else if (character.Tiredness > trigger_levels.Tiredness.critical && this.urgency < "2-tired")
			this.emergency("2-tired", () => goSleep(this.plan))
		else if (
			character.fatigue > trigger_levels.fatigue.critical &&
			this.urgency < "1-fatigue" &&
			this.workPlace
		)
			this.emergency("1-fatigue", () => goRest(this.plan))
		if (!this.reject)
			this.findAction().catch((error) => {
				if (!(error instanceof CancelledError)) console.error(error.stack)
			})
		this.evolve(delta)
	}*/
}
