<script lang="ts">
	import type { GoodType } from '$lib/arktype'
	import { type Game } from '$lib/game'
	import { goods as goodsCatalog } from '$assets/game-content'
	import { T } from '$lib/i18n'
	import EntityBadge from './EntityBadge.svelte'

	let {
		goods,
		game,
		itemSize = 20,
		className = ''
	} = $props<{
		goods: { [k in GoodType]?: number }
		game: Game
		itemSize?: number
		className?: string
	}>()
	const entries = $derived(Object.entries(goods) as [GoodType, number][])
</script>

{#if entries.length > 0}
	<div class={`goods-list flex flex-wrap gap-2 items-center ${className}`}>
		{#each entries as [good, qty]}
			<EntityBadge
				{game}
				sprite={goodsCatalog[good].sprites[0]}
				text={$T.goods?.[good]}
				{qty}
				{itemSize}
			/>
		{/each}
	</div>
{/if}

<style>
	.goods-list {
		min-width: 0;
	}
</style>
