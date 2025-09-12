import type { Component } from 'svelte'

const widgetsSource = import.meta.glob('./widgets/**/*.svelte', { eager: true })

const widgets = Object.fromEntries(
	Object.entries(widgetsSource as Record<string, any>).map(([key, widget]) => [
		/^\.\/widgets.*\/(.*)\.svelte$/.exec(key)?.[1],
		{
			title: widget.title,
			component: widget.default,
		},
	]),
) as Record<
	string,
	{ title: (params: Record<string, any>) => string; component: Component<Record<string, any>> }
>
export default widgets
