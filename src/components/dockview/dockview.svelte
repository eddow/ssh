<script lang="ts" module>
	import { getContext, setContext } from 'svelte'
	const dockviewContext = Symbol('dockviewContext')

	export function getDockviewContext() {
		return getContext<IDockviewContext>(dockviewContext)
	}
	function setDockviewContext(context: IDockviewContext) {
		setContext(dockviewContext, context)
	}
</script>

<script lang="ts">
	import {
		type AddPanelOptions,
		type CreateComponentOptions,
		createDockview,
		type DockviewApi,
		type DockviewOptions,
		type IContentRenderer
	} from 'dockview-core'
	import 'dockview-core/dist/styles/dockview.css'
	import { getAllContexts, onMount, type Snippet } from 'svelte'
	import DvSnippet from './dv-snippet.svelte'
	import { ContentRenderer, type DockviewWidget, type IDockviewContext } from './utils'

	let {
		widgets = {},
		api = $bindable(undefined),
		theme = 'light',
		onready,
		children,
		snippets = {},
		renderers = {},
		class: className = '',
		...props
	}: Omit<DockviewOptions, 'theme'> & {
		widgets?: Record<string, DockviewWidget>
		snippets?: Record<string, Snippet<any>>
		renderers?: Record<string, (id: string) => IContentRenderer>
		class?: string
		api?: DockviewApi
		theme?: 'dark' | 'light' | 'vs' | 'abyss' | 'dracula' | 'replit'
		onready?: (api: DockviewApi) => void
		children?: Snippet
	} = $props()

	// Content defined components
	const cdc: Record<string, Snippet<[Record<string, any>]>> = {}

	export function addDock(
		part: string,
		params: Record<string, any>,
		options: Partial<AddPanelOptions> = {}
	) {
		return api?.addPanel({
			id: `widget.${part}.${crypto.randomUUID()}`,
			component: part,
			title: widgets[part].title(params),
			params,
			...options
		})
	}
	export function showUniqueDock(
		part: string,
		params: Record<string, any>,
		options: (Partial<AddPanelOptions> & { id: string }) | string
	) {
		const id = typeof options === 'string' ? options : options.id
		if (!id) throw new Error('DockView.addUniqueDock: id is required')
		const panel = api?.getPanel(id)
		if (panel) {
			if (!panel.api.isActive) panel.api.setActive()
			return panel
		}
		return api?.addPanel({
			component: part,
			title: widgets[part].title(params),
			params,
			...(typeof options === 'object' ? options : {}),
			...{ id }
		})
	}
	export function toggleUniqueDock(
		part: string,
		params: Record<string, any>,
		options: (Partial<AddPanelOptions> & { id: string }) | string
	) {
		const id = typeof options === 'string' ? options : options.id
		if (!id) throw new Error('DockView.addUniqueDock: id is required')
		const panel = api?.getPanel(id)
		if (panel) {
			if (!panel.api.isActive) {
				panel.api.setActive()
				return panel
			}
			panel.api.close()
			return null
		}
		return api?.addPanel({
			component: part,
			title: widgets[part].title(params),
			params,
			...(typeof options === 'object' ? options : {}),
			...{ id }
		})
	}
	export function registerComponent(name: string, snippet: Snippet<[Record<string, any>]>) {
		cdc[name] = snippet
	}

	setDockviewContext({ addDock, showUniqueDock, toggleUniqueDock, registerComponent })
	let el: HTMLDivElement
	$effect(() => {
		api?.updateOptions?.(props)
	})
	const allContexts = getAllContexts()
	onMount(() => {
		api = createDockview(el, {
			...props,
			createComponent({ id, name }: CreateComponentOptions): IContentRenderer {
				if (widgets[name])
					return new ContentRenderer(id, widgets[name].component, [{}], allContexts)
				if (cdc[name])
					return new ContentRenderer(id, DvSnippet, { snippet: cdc[name] }, allContexts)
				if (snippets[name])
					return new ContentRenderer(id, DvSnippet, { snippet: snippets[name] }, allContexts)
				if (renderers[name]) return renderers[name](id)
				throw new Error(`DockView: Component ${name} not found`)
			}
		})
		onready?.(api)
		;(el.firstChild as HTMLElement).className = '' //remove dockview-theme-... so that we manage it
	})
</script>

{#if children}<div style="display: none">{@render children()}</div>{/if}
<div class={`dockview dockview-theme-${theme} ${className}`} bind:this={el}></div>

<style>
	.dockview {
		width: 100%;
		height: 100%;
	}
</style>
