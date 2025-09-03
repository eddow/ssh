<script lang="ts" module>
	export function title(params: Record<string, any>) {
		return `Debug Info`
	}
</script>

<script lang="ts">
	import {
		Button,
		Table,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		TableHeadCell
	} from 'flowbite-svelte'
	import { debugInfo } from '$lib/globals.svelte'
	function ownEntries(value: any) {
		return Object.entries(Object.getOwnPropertyDescriptors(value))
			.filter(([_, v]) => v.enumerable)
			.map(([k, v]) => [k, v.value])
	}

	function debugged(value: any, already = new Set<any>()) {
		if (already.has(value)) return '[Circular]'
		already.add(value)
		try {
			if (typeof value === 'number') return value.toFixed(2)
			if (typeof value !== 'object') return value
			if (!value) return '' + value
			return ownEntries(value)
				.map(([k, v]): string => `${k}: ${debugged(v, already)}`)
				.join(' | ')
		} finally {
			already.delete(value)
		}
	}
	const dDebugInfo = $derived(Object.entries(debugInfo))
	function resetLayout() {
		localStorage.removeItem('layout')
		location.reload()
	}
	function displayed(content: any) {
		if (typeof content !== 'object') return content
		return ownEntries(content)
			.map(([k, v]) => [k, debugged(v)])
			.join(' | ')
	}
</script>

<Button class="w-full" onclick={resetLayout}>Reset layout</Button>
{#each dDebugInfo as content}
	<h2>{content[0]}</h2>
	<Table>
		<TableBody title="Debug info">
			{#each ownEntries(content[1]) as kvp}
				<TableBodyRow>
					<TableHeadCell>{kvp[0]}</TableHeadCell>
					<TableBodyCell>{displayed(kvp[1])}</TableBodyCell>
				</TableBodyRow>
			{/each}
		</TableBody>
	</Table>
{/each}
