<script lang="ts">
	import type { Module } from '$lib/game/tile'
	import { Badge } from 'flowbite-svelte'

	let { content }: { content: Module } = $props()
</script>

<div class="module-properties">
	<div class="space-y-2">
		<div class="flex items-center gap-2">
			<span class="font-medium">Module:</span>
			<Badge color="purple">{content.name}</Badge>
		</div>

		<div class="flex items-center gap-2">
			<span class="font-medium">Output:</span>
			<Badge color="blue">{content.output}</Badge>
		</div>

		<div class="flex items-center gap-2">
			<span class="font-medium">Goods:</span>
			<Badge color="yellow">{content.goodsQty} / {content.goodsCapacity}</Badge>
		</div>

		<div class="flex items-center gap-2">
			<span class="font-medium">Workers:</span>
			<Badge color="green">{content.assignedWorker ? '1' : '0'} / {content.maxWorkers}</Badge>
		</div>

		<div class="flex items-center gap-2">
			<span class="font-medium">Action:</span>
			<Badge color="indigo">{content.action.type}</Badge>
		</div>

		<div class="flex items-center gap-2">
			<span class="font-medium">Time:</span>
			<Badge color="indigo">{content.time}s</Badge>
		</div>
	</div>
</div>

<style>
	.module-properties {
		padding: 0.5rem 0;
	}
</style>
