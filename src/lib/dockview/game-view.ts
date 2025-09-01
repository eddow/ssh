import type { GroupPanelPartInitParameters, IContentRenderer } from "dockview-core"
import type Phaser from "phaser"
import { Game } from "$lib/game"

export class GameViewRenderer implements IContentRenderer {
	public game: Game = undefined!
	private phaser: Phaser.Game = undefined!
	constructor(public readonly id: string) {
		//this.phaser = game.phaser
	}

	get element(): HTMLElement {
		return this.phaser.canvas
	}

	private initSize: { width: number; height: number } | undefined
	init(_parameters: GroupPanelPartInitParameters): void {
		// TODO: get game from parameters
		this.game = new Game()
		this.phaser = this.game.phaser

		// Prevent context menu on the canvas
		this.phaser.canvas.addEventListener("contextmenu", (e) => {
			e.preventDefault()
		})

		if (this.initSize) {
			this.phaser.scale.resize(this.initSize.width, this.initSize.height)
			this.initSize = undefined
		}
	}

	layout?(width: number, height: number): void {
		if (width > 0 && height > 0) {
			if (this.phaser) this.phaser.scale.resize(width, height)
			else this.initSize = { width, height }
		}
	}
	/*update(event: PanelUpdateEvent<Parameters>): void {
	}*/
	dispose(): void {
		if (this.game) this.game.destroy()
	}
}

export default function createGameViewRenderer(id: string): GameViewRenderer {
	return new GameViewRenderer(id)
}
