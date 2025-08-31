import type { GroupPanelPartInitParameters, IContentRenderer } from 'dockview-core'

export class GameViewRenderer implements IContentRenderer {
	private canvas: HTMLCanvasElement
	constructor(public readonly id: string) {
		this.canvas = document.createElement('canvas')
		this.canvas.style.width = '100%'
		this.canvas.style.height = '100%'
	}
	get element(): HTMLElement {
		return this.canvas
	}
	init(parameters: GroupPanelPartInitParameters): void {
		//this.gv = createView
	}
	layout?(width: number, height: number): void {
		//this.gv?.resize(width, height)
	}
	dispose(): void {
		//this.gv?.dispose()
	}

	/*
	focus?(): void {
		//throw new Error('Method not implemented.');
	}
	update(event: PanelUpdateEvent<Parameters>): void {
		//throw new Error('Method not implemented.')
	}
	toJSON(): object {
		//throw new Error('Method not implemented.')
	}
	*/
}
export default function createGameViewRenderer(id: string): GameViewRenderer {
	return new GameViewRenderer(id)
}
