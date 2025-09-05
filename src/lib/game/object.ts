// Library used by Pixi
import EventEmitter from "eventemitter3"
import D from "flat-diamond"
import { effect, reactive, type ScopedCallback, unreactive } from "mutts"
import { type Container, Ticker } from "pixi.js"
import type { WorldCoord } from "$lib/hex"
import type { Game } from "./game"

unreactive(EventEmitter)
export type Positionable = Container & {
	setPosition(x: number, y: number): void
}

export abstract class RenderableObject extends D() {
	destroy() {}
}

export abstract class GeneratorObject extends D(RenderableObject) {
	private renderCleanup?: ScopedCallback
	abstract render(): ScopedCallback | undefined
	constructor(game: Game, ...args: any[]) {
		super(game, ...args)
		game.loaded.then(() => {
			if (!this.renderCleanup) this.renderCleanup = effect(() => this.render())
		})
	}
	destroy() {
		this.renderCleanup?.()
		this.renderCleanup = () => {}
		super.destroy()
	}
}
export class RenderableContainer extends D(RenderableObject) {
	public readonly children = new Set<RenderableObject>()

	destroy() {
		for (const child of this.children) child.destroy()
		this.children.clear()
		super.destroy()
	}

	add(child: RenderableObject) {
		this.children.add(child)
		return this
	}

	delete(child: RenderableObject) {
		child.destroy()
		return this.children.delete(child)
	}

	has(child: RenderableObject) {
		return this.children.has(child)
	}

	clear() {
		for (const child of this.children) child.destroy()
		this.children.clear()
	}
}

export abstract class HittableGameObject extends D(RenderableObject) {
	/**
	 * Z-index for hit testing priority. Higher values are tested first.
	 * Default is 0. Objects with higher zIndex will be hit-tested first.
	 */
	public zIndex: number = 0

	constructor(
		public readonly game: Game,
		...args: any[]
	) {
		super(game, ...args)
		game.registerHittable(this)
	}
	destroy(): void {
		this.game.unregisterHittable(this)
		super.destroy()
	}
	/**
	 * Test if a world point is inside this interactive object
	 * @param worldX - World X coordinate
	 * @param worldY - World Y coordinate
	 * @returns true if the point is inside the object
	 */
	abstract hitTest(worldX: number, worldY: number): InteractiveGameObject | false
}

export abstract class InteractiveGameObject extends D(RenderableObject) {
	/**
	 * Log messages associated with the object. Intended for UI display.
	 */
	public readonly logs: string[] = []

	/**
	 * Append a log line to this object's logs
	 */
	log(...args: any[]) {
		try {
			const line = args.map((a) => a.toString()).join(" ")
			this.logs.push(line)
		} catch {
			// Fallback if JSON serialization fails
			this.logs.push(String(args))
		}
	}
	abstract readonly title: string
	abstract readonly debugInfo?: Record<string, any>
	abstract readonly position: WorldCoord
	constructor(
		public readonly game: Game,
		public readonly uid: string,
		...args: any[]
	) {
		super(game, uid, ...args)
		game.register(this, uid)
	}
	destroy(): void {
		this.game.unregister(this)
		super.destroy()
	}
}

export abstract class TickedGameObject extends D(RenderableObject) {
	constructor(...args: any[]) {
		super(...args)
		Ticker.shared.add(this.updateCallback)
	}
	private updateCallback = (timer: Ticker) => {
		reactive(this).update(timer.elapsedMS / 1000)
	}
	abstract update(deltaTime: number): void
	destroy(): void {
		Ticker.shared.remove(this.updateCallback)
		super.destroy()
	}
}
