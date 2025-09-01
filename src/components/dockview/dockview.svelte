<script lang="ts" module>
	import { getContext, setContext } from 'svelte'
	const dockviewContext = Symbol('dockviewContext')
	export interface IDockView {
		addWidget: (
			name: string,
			params: Record<string, any>,
			options: Partial<AddPanelOptions>
		) => void
	}
	export function getDockviewContext() {
		return getContext<IDockView>(dockviewContext)
	}
	function setDockviewContext(context: IDockView) {
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
	import { onMount, type Snippet } from 'svelte'
	import DvSnippet from './dv-snippet.svelte'
	import { ContentRenderer, dvContext, type DockviewWidget } from './utils'

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
	const cdc: Record<string, Snippet> = {}
	setContext(dvContext, {
		registerComponent(name: string, snippet: Snippet) {
			cdc[name] = snippet
		}
	})

	export function addWidget(
		name: string,
		params: Record<string, any>,
		options: Partial<AddPanelOptions> = {}
	) {
		return api?.addPanel({
			id: `widget.${name}.${crypto.randomUUID()}`,
			component: name,
			title: widgets[name].title(params),
			params,
			...options
		})
	}
	const context: IDockView = { addWidget }
	setDockviewContext(context)
	let el: HTMLDivElement
	$effect(() => {
		api?.updateOptions?.(props)
	})
	onMount(() => {
		api = createDockview(el, {
			...props,
			createComponent({ id, name }: CreateComponentOptions): IContentRenderer {
				if (widgets[name]) return new ContentRenderer(id, widgets[name].component)
				if (cdc[name]) return new ContentRenderer(id, DvSnippet, { snippet: cdc[name] })
				if (snippets[name]) return new ContentRenderer(id, DvSnippet, { snippet: snippets[name] })
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
