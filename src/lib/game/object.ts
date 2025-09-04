// Library used by Pixi
import EventEmitter from "eventemitter3"
import D from "flat-diamond"
import { effect, type ScopedCallback, unreactive } from "mutts"
import type { Container } from "pixi.js"
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
	constructor(game: Game) {
		super()
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
class InitEmptySet<T> extends Set<T> {
	constructor(...args: any[]) {
		super()
	}
}
export class RenderableContainer extends D(RenderableObject, InitEmptySet<RenderableObject>) {
	destroy() {
		for (const child of this.values()) child.destroy()
		this.clear()
		super.destroy()
	}

	delete = (child: RenderableObject) => {
		child.destroy()
		return super.delete(child)
	}
}

export abstract class HittableGameObject extends D(RenderableObject) {
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
	 * Highlights of the object (selected/hover/attention/etc.)
	 */
	public readonly highlight = new Set<string>()
	abstract readonly title: string
	abstract readonly debugInfo?: Record<string, any>
	abstract readonly worldPosition: WorldCoord
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
