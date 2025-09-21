<script lang="ts">
	import type { Tile } from '$lib/game'
	import { UnBuiltLand, Module } from '$lib/game/board/content'
	import { Badge } from 'flowbite-svelte'
	import UnBuiltProperties from '$components/properties/UnBuiltProperties.svelte'
	import ModuleProperties from '$components/properties/ModuleProperties.svelte'
	import { ms } from '$lib/mutts.svelte'
	import { T } from '$lib/i18n'
	import GoodsList from '$components/parts/GoodsList.svelte'
	import PropertyGridRow from '$components/parts/PropertyGridRow.svelte'
	import PropertyGrid from '$components/parts/PropertyGrid.svelte'

	let { tile }: { tile: Tile } = $props()
	let tileContent = $derived(ms(() => tile.content))
	// TODO: we still have reactivity issues: it works without $goods, but tilecontent ms has to be deep
	// and the performances crashes
	let goods = $derived(ms(() => tile.content!.goods))
	// TODO: terrain type as background color
</script>

{#if $tileContent}
	<div class="tile-properties">
		<div class="space-y-2">
			<div class="flex items-center gap-2">
				<span class="font-medium">{$T.tile.content}:</span>
				<Badge color="green">{$tileContent.constructor.name}</Badge>
			</div>

			<div class="flex items-center gap-2">
				<span class="font-medium">{$T.tile.walkTime}:</span>
				<Badge color={$tileContent.walkTime === Number.POSITIVE_INFINITY ? 'red' : 'yellow'}>
					{$tileContent.walkTime === Number.POSITIVE_INFINITY
						? $T.tile.unwalkable
						: $tileContent.walkTime}
				</Badge>
			</div>
			<PropertyGrid>
				<PropertyGridRow label={$T.goods}>
					<GoodsList goods={$goods} game={tile.hex.game} />
				</PropertyGridRow>

				{#if $tileContent instanceof UnBuiltLand}
					<UnBuiltProperties content={$tileContent} />
				{:else if $tileContent instanceof Module}
					<ModuleProperties content={$tileContent} game={tile.hex.game} />
				{/if}
			</PropertyGrid>
		</div>
	</div>
{/if}

<style>
	.tile-properties {
		padding: 1rem;
	}
</style>
