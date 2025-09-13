// Library used by Pixi
import EventEmitter from 'eventemitter3'
import { effect, ReactiveBase, reactive, type ScopedCallback, unreactive, computed } from 'mutts'
import { Ticker } from 'pixi.js'
import type { Game } from './game'
import type { Position } from './position'
import { ScriptExecution, SingleStepExecutor } from './npcs/scripts'
import type { ExecutionContext } from 'npc-script'

// All pixi objects extend this `EventEmitter` and should be unreactive
unreactive(EventEmitter)

// Base game object class
export class GameObject extends ReactiveBase {
	constructor(
		public readonly game: Game,
		..._args: any[]
	) {
		super()
	}

	destroy() {}
}


// Mixin functions for composition
export function withGenerator<T extends new (...args: any[]) => GameObject>(Base: T) {
	abstract class GeneratorMixin extends Base {
		renderCleanup?: ScopedCallback

		constructor(...args: any[]) {
			super(...args)
			// Access the game instance to set up render cleanup
			const game = this.game
			if (game) {
				game.loaded.then(() => {
					if (!this.renderCleanup) this.renderCleanup = effect(() => this.render())
				})
			}
		}

		abstract render(): ScopedCallback | undefined

		destroy() {
			this.renderCleanup?.()
			this.renderCleanup = () => {}
			super.destroy()
		}
	}
	return GeneratorMixin
}

export function withInteractive<T extends new (...args: any[]) => GameObject>(Base: T) {
	abstract class InteractiveMixin extends Base {
		public readonly uid: string

		/**
		 * Log messages associated with the object. Intended for UI display.
		 */
		public readonly logs: string[] = []

		constructor(...args: any[]) {
			const [game, uid] = args
			super(...args)
			this.uid = uid
			game.register(this, uid)
		}

		/**
		 * Append a log line to this object's logs
		 */
		log(...args: any[]) {
			try {
				const line = args.map((a) => a.toString()).join(' ')
				this.logs.push(line)
			} catch {
				// Fallback if JSON serialization fails
				this.logs.push(String(args))
			}
		}

		abstract canAct(action: string): boolean
		abstract readonly title: string
		abstract readonly debugInfo?: Record<string, any>
		abstract readonly position: Position

		destroy(): void {
			this.game.unregister(this as any)
			super.destroy()
		}
	}
	return InteractiveMixin
}

export function withHittable<T extends new (...args: any[]) => GameObject>(Base: T) {
	abstract class HittableMixin extends Base {
		/**
		 * Z-index for hit testing priority. Higher values are tested first.
		 * Default is 0. Objects with higher zIndex will be hit-tested first.
		 */
		public zIndex: number = 0

		constructor(...args: any[]) {
			super(...args)
			this.game.registerHittable(this as any)
		}

		destroy(): void {
			this.game.unregisterHittable(this as any)
			super.destroy()
		}

		/**
		 * Test if a world point is inside this interactive object
		 * @param worldX - World X coordinate
		 * @param worldY - World Y coordinate
		 * @param selectedAction - Currently selected action (optional)
		 * @returns true if the point is inside the object
		 */
		abstract hitTest(
			worldX: number,
			worldY: number,
			selectedAction?: string,
		): any
	}
	return HittableMixin
}

export function withTicked<T extends new (...args: any[]) => GameObject>(Base: T) {
	abstract class TickedMixin extends Base {
		constructor(...args: any[]) {
			super(...args)
			Ticker.shared.add(this.updateCallback)
		}

		updateCallback = (timer: Ticker) => {
			reactive(this).update(timer.elapsedMS / 1000)
		}

		abstract update(deltaTime: number): void

		destroy(): void {
			Ticker.shared.remove(this.updateCallback)
			super.destroy()
		}
	}
	return TickedMixin
}

export function withContainer<T extends new (...args: any[]) => GameObject>(Base: T) {
	abstract class ContainerMixin extends Base {
		children = new Set<GameObject>()

		add(child: GameObject): this {
			this.children.add(child)
			return this
		}

		delete(child: GameObject): boolean {
			child.destroy()
			return this.children.delete(child)
		}

		has(child: GameObject): boolean {
			return this.children.has(child)
		}

		clear(): void {
			for (const child of this.children) child.destroy()
			this.children.clear()
		}

		destroy(): void {
			this.clear()
			super.destroy()
		}
	}
	return ContainerMixin
}

export function withScripted<T extends new (...args: any[]) => TickedGameObject>(Base: T) {
	abstract class ScriptedMixin extends Base {
		public stepExecutor: SingleStepExecutor | undefined
		public runningScripts: ScriptExecution[] = []

		abstract readonly scriptContext: ExecutionContext
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

		update(dt: number) {
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
	return ScriptedMixin
}

// Type aliases for backward compatibility
export type GeneratorObject = InstanceType<ReturnType<typeof withGenerator<typeof GameObject>>>
export type RenderableContainer = InstanceType<ReturnType<typeof withContainer<typeof GameObject>>>
export type HittableGameObject = InstanceType<ReturnType<typeof withHittable<typeof GameObject>>>
export type InteractiveGameObject = InstanceType<ReturnType<typeof withInteractive<typeof GameObject>>>
export type TickedGameObject = InstanceType<ReturnType<typeof withTicked<typeof GameObject>>>
export type ScriptedObject = InstanceType<ReturnType<typeof withScripted<ReturnType<typeof withTicked<typeof GameObject>>>>>

