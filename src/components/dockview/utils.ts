import type { AddPanelOptions, GroupPanelPartInitParameters, IContentRenderer } from "dockview-core"
import { type Component, getAllContexts, mount, type Snippet } from "svelte"
import { writable } from "svelte/store"

export interface IDockviewContext {
	registerComponent(name: string, snippet: Snippet<[Record<string, any>]>): void
	addDock: (part: string, params: Record<string, any>, options: Partial<AddPanelOptions>) => void
	showUniqueDock: (
		part: string,
		params: Record<string, any>,
		options: (Partial<AddPanelOptions> & { id: string }) | string
	) => void
	toggleUniqueDock: (
		part: string,
		params: Record<string, any>,
		options: (Partial<AddPanelOptions> & { id: string }) | string
	) => void
}
abstract class AbstractRenderer implements IContentRenderer {
	readonly element: HTMLElement
	constructor(public readonly id: string) {
		this.element = document.createElement("div")
		this.element.className = "dv-svelte-part"
		this.element.style.height = "100%"
		this.element.style.width = "100%"
	}
	abstract init(parameters: GroupPanelPartInitParameters): void
}
export class ContentRenderer<Parameters extends Record<string, any>> extends AbstractRenderer {
	private size = writable<{ width: number; height: number }>({ width: 100, height: 100 })
	constructor(
		id: string,
		public readonly renderer: Component<Parameters>,
		private readonly props: Partial<Parameters>,
		private readonly context: Map<string, any>,
	) {
		super(`iad-${id}`)
	}

	init(parameters: GroupPanelPartInitParameters): void {
		//@ts-expect-error size is not a valid prop
		mount(this.renderer, {
			target: this.element,
			props: { size: this.size, ...this.props, ...parameters.params },
			context: this.context
		})
	}

	layout(width: number, height: number): void {
		if (width > 0 && height > 0) {
			this.size.set({ width, height })
		}
	}
	/*
	update?(event: PanelUpdateEvent<Parameters>): void {
		//throw new Error('Method not implemented.')
	}
	toJSON?(): object {
		//throw new Error('Method not implemented.')
	}
	focus?(): void {
		//throw new Error('Method not implemented.')
	}
	dispose?(): void {
		//throw new Error('Method not implemented.')
	}*/
}

export type DockviewWidget = {
	title: (params: Record<string, any>) => string
	component: Component<[Record<string, any>]>
}
