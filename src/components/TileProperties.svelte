<script lang="ts">
	import type { HexTile } from '$lib/game'
	import type { TileContent } from '$lib/game/tile'
	import { UnBuiltLand, Module } from '$lib/game/tile'
	import { Badge } from 'flowbite-svelte'
	import UnBuiltProperties from './UnBuiltProperties.svelte'
	import ModuleProperties from './ModuleProperties.svelte'
	import { ms } from '$lib/mutts.svelte'
	import { T } from '$lib/i18n'

	let { tile }: { tile: HexTile } = $props()
	let tileContent = ms(() => tile.content)
</script>

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

		{#if $tileContent instanceof UnBuiltLand}
			<UnBuiltProperties content={$tileContent} />
		{:else if $tileContent instanceof Module}
			<ModuleProperties content={$tileContent} />
		{/if}
	</div>
</div>

<style>
	.tile-properties {
		padding: 1rem;
	}
</style>
