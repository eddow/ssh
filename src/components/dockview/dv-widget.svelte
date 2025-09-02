<script lang="ts" generics="Parameters extends {} = {}">
	import { type Snippet } from 'svelte'
	import { getDockviewContext } from './dockview.svelte'

	const { name, children }: { name: string; children?: Snippet<[Record<string, any>]> } = $props()
	const ctx = getDockviewContext()
	if (!ctx) throw new Error('DockView: DvComponent must be used inside DockView')
	console.assert(!!children, 'DockView: DvComponent registers no children')
	if (children) ctx.registerComponent(name, children)
</script>
