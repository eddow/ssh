import type Phaser from "phaser"
import type { WorldCoord } from "../axial"
import { effect, Reactive, type UnwatchFunction } from "../reactive"
import type { Game } from "./game"
import type { T } from "vitest/dist/chunks/environment.d.cL3nLXbE.js"

export function renderEffect<T extends Phaser.GameObjects.GameObject>(
	render: () => T | undefined | false,
	tune: (object: T) => void = () => {},
) {
	let rendered: T | undefined | false
	const cleanup = effect(
		() => {
			if (rendered) {
				rendered.destroy()
				rendered = undefined
			}
			rendered = render()
		},
		() => effect(() => rendered && tune(rendered)),
	)
	return () => {
		if (rendered) {
			rendered.destroy()
			rendered = undefined
		}
		cleanup()
	}
}

const interactions = new WeakMap<Phaser.GameObjects.GameObject, InteractiveGameObject>()

export abstract class RenderableObject<
	T extends Phaser.GameObjects.GameObject & { x: number; y: number } = 
		Phaser.GameObjects.GameObject & { x: number; y: number }
>  extends Reactive() {
	abstract readonly worldPosition: WorldCoord
	abstract render(scene: Phaser.Scene): T
	tune(object: T) {
		object.x = this.worldPosition.x
		object.y = this.worldPosition.y
		object.on("destroy", () => {
			this.remove()
		})
		object.setInteractive()
		return () => {
			interactions.delete(object)
		}
	}
	private renderCleanup?: UnwatchFunction
	addToScene(scene: Phaser.Scene) {
		this.renderCleanup = renderEffect(
			() => this.render(scene),
			(o) => this.tune(o),
		)
	}
	remove() {
		this.renderCleanup?.()
		this.renderCleanup = undefined
	}
}

export abstract class InteractiveGameObject<
	T extends Phaser.GameObjects.GameObject & { x: number; y: number } = 
		Phaser.GameObjects.GameObject & { x: number; y: number }
> extends RenderableObject {
	constructor(public readonly game: Game) {
		super()
	}
	abstract readonly uid: string
	abstract highlight(highlighted: boolean): void
	tune(object: T) {
		interactions.set(object, this)
		object.setInteractive()
		return super.tune(object)
	}
}

export function getInteractiveObject<T extends Phaser.GameObjects.GameObject>(object: T): InteractiveGameObject | undefined {
	return interactions.get(object)
}