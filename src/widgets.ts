const widgetsSource = import.meta.glob('./widgets/**/*.svelte', { eager: true })
/*[
    "./widgets/selection-info.svelte",
    "./widgets/system/configuration.svelte",
    "./widgets/system/debug.svelte"
]*/
const widgets = Object.fromEntries(Object.entries(widgetsSource as Record<string, { default: any }>)
	.map(([key, widget]) => [
		/^\.\/widgets.*\/(.*)\.svelte$/.exec(key)?.[1],
		widget.default
	]))
export default widgets