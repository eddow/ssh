import type Phaser from "phaser"
import type { WorldCoord } from "../axial"
import { effect, Reactive, type UnwatchFunction } from "../reactive"
import type { Game } from "./game"

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

export type Positionable = Phaser.GameObjects.GameObject & {
	setPosition(x: number, y: number): void
}
export abstract class RenderableObject<T extends Positionable = Positionable> extends Reactive() {
	abstract readonly worldPosition: WorldCoord
	abstract render(scene: Phaser.Scene): T
	// POC
	protected renderedObject?: T
	tune(object: T) {
		this.renderedObject = object
		/*const { x, y } = this.worldPosition
		object.setPosition(x, y)*/
		object.on("destroy", () => {
			this.remove()
		})
		return () => {
			if (this.renderedObject === object) this.renderedObject = undefined
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
		this.renderedObject = undefined
	}
	getRenderedObject(): T | undefined {
		return this.renderedObject
	}
}

export abstract class InteractiveGameObject extends RenderableObject {
	constructor(public readonly game: Game) {
		super()
	}
	abstract readonly uid: string
	/**
	 * Test if a world point is inside this interactive object
	 * @param worldX - World X coordinate
	 * @param worldY - World Y coordinate
	 * @returns true if the point is inside the object
	 */
	abstract hitTest(worldX: number, worldY: number): SelectableGameObject | false
}

export abstract class SelectableGameObject extends InteractiveGameObject {
	/**
	 * Highlight or unhighlight this object
	 * @param highlighted - Whether to highlight or unhighlight
	 */
	abstract highlight(highlighted: boolean): void
}

export abstract class ContainerClass extends InteractiveGameObject {
	protected container?: Phaser.GameObjects.Container

	/**
	 * Default hitTest behavior: iterate through children and return the first interactive one that passes hitTest
	 */
	hitTest(worldX: number, worldY: number): SelectableGameObject | false {
		if (!this.container) return false

		// Iterate through children in reverse order (topmost first)
		for (let i = this.container.length - 1; i >= 0; i--) {
			const child = this.container.getAt(i)
			if (!child || !(child instanceof InteractiveGameObject)) continue
			const hit = child.hitTest(worldX, worldY)
			if (hit) return hit
		}
		return false
	}

	/**
	 * Add a child to the container
	 */
	addChild(child: Phaser.GameObjects.GameObject): void {
		this.container?.add(child)
	}

	/**
	 * Remove a child from the container
	 */
	removeChild(child: Phaser.GameObjects.GameObject): void {
		this.container?.remove(child)
	}

	/**
	 * Clear all children from the container
	 */
	clearChildren(): void {
		this.container?.removeAll()
	}
}
