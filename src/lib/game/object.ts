import Diamond from "flat-diamond"
import { effect, Reactive, type ScopedCallback, unreactive } from "mutts"
import Phaser from "phaser"
import type { Game, LevelScene } from "./game"

unreactive(Phaser.GameObjects.GameObject)
export type Positionable = Phaser.GameObjects.GameObject & {
	setPosition(x: number, y: number): void
}

export abstract class RenderableObject extends Diamond(Reactive()) {
	setScene(scene: LevelScene) {}
	destroy() {}
}

export abstract class GeneratorObject<T extends Phaser.GameObjects.GameObject[]> extends Diamond(
	RenderableObject,
) {
	private renderCleanup?: ScopedCallback
	abstract render(scene: LevelScene): T
	abstract manage(scene: LevelScene, objects: T): ScopedCallback
	setScene(scene: LevelScene) {
		this.renderCleanup?.()
		this.renderCleanup = effect(
			() => this.render(scene),
			(objs) => {
				this.manage(scene, objs)
				return () => {
					for (const obj of objs) obj.destroy()
				}
			},
		)
		super.setScene(scene)
	}
	destroy() {
		this.renderCleanup?.()
		this.renderCleanup = undefined
		super.destroy()
	}
}

export class RenderableContainer extends Diamond(RenderableObject) {
	public scene?: LevelScene
	protected readonly children = new Set<RenderableObject>()
	setScene(scene: LevelScene) {
		this.scene = scene
		super.setScene(scene)
		for (const child of this.children)
			if (!(child instanceof InteractiveGameObject)) child.setScene(scene)
	}
	destroy() {
		for (const child of this.children.values()) child.destroy()
		this.children.clear()
		super.destroy()
	}
	add(...children: RenderableObject[]) {
		if (this.scene) {
			for (const child of children) {
				if (!(child instanceof InteractiveGameObject)) child.setScene(this.scene)
				this.children.add(child)
			}
		} else for (const child of children) this.children.add(child)
	}
	remove(...children: RenderableObject[]) {
		for (const child of children) {
			this.children.delete(child)
			child.destroy()
		}
	}
}

export abstract class InteractiveGameObject extends Diamond(RenderableObject) {
	constructor(public readonly game: Game) {
		super()
		this.uid = game.register(this)
	}
	public readonly uid: string
	/**
	 * Test if a world point is inside this interactive object
	 * @param worldX - World X coordinate
	 * @param worldY - World Y coordinate
	 * @returns true if the point is inside the object
	 */
	abstract hitTest(worldX: number, worldY: number): SelectableGameObject | false
	destroy(): void {
		this.game.unregister(this)
		super.destroy()
	}
}

export abstract class SelectableGameObject extends Diamond(InteractiveGameObject) {
	/**
	 * Highlight or unhighlight this object
	 * @param highlighted - Whether to highlight or unhighlight
	 */
	abstract highlight(highlighted: boolean): void
}
