<script lang="ts">
	import type { GoodType, UnBuiltLand } from '$lib/game/tile'
	import { goods } from '$assets/game-content'
	import { Badge } from 'flowbite-svelte'
	import { T } from '$lib/i18n'

	let { content }: { content: UnBuiltLand } = $props()
</script>

<div class="unbuilt-properties">
	<div class="space-y-2">
		{#if content.deposit}
			<div class="flex items-center gap-2">
				<span class="font-medium">{$T.deposit}:</span>
				<Badge color="purple">{content.deposit.name}</Badge>
				<Badge color="blue">{content.deposit.amount}</Badge>
			</div>
		{/if}

		{#if Object.keys(content.goods).length > 0}
			<div class="flex items-center gap-2">
				<span class="font-medium">{$T.goods}:</span>
				<div class="flex flex-wrap gap-1">
					{#each Object.entries(content.goods) as [good, count]}
						{@const goodDef = goods[good as GoodType]}
						<Badge color="yellow">
							{goodDef.name} × {count}
						</Badge>
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
