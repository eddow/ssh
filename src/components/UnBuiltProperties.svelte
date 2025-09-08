<script lang="ts">
	import type { UnBuiltLand } from '$lib/game/tile'
	import { Badge } from 'flowbite-svelte'

	let { content }: { content: UnBuiltLand } = $props()
</script>

<div class="unbuilt-properties">
	<div class="space-y-2">
		{#if content.deposit}
			<div class="flex items-center gap-2">
				<span class="font-medium">Deposit:</span>
				<Badge color="purple">{content.deposit.name}</Badge>
				<Badge color="blue">{content.deposit.amount}</Badge>
			</div>
		{/if}

		{#if Object.keys(content.listGoods()).length > 0}
			<div class="flex items-center gap-2">
				<span class="font-medium">Goods:</span>
				<div class="flex flex-wrap gap-1">
					{#each Object.entries(content.listGoods()) as [good, count]}
						<Badge color="yellow">{good} × {count}</Badge>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.unbuilt-properties {
		padding: 0.5rem 0;
	}
</style>
