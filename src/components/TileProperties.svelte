<script lang="ts">
	import type { HexTile } from '$lib/game'
	import type { TileContent } from '$lib/game/tile'
	import { UnBuiltLand, Module } from '$lib/game/tile'
	import { Badge } from 'flowbite-svelte'
	import UnBuiltProperties from './UnBuiltProperties.svelte'
	import ModuleProperties from './ModuleProperties.svelte'

	let { tile }: { tile: HexTile } = $props()
</script>

<div class="tile-properties">
	<div class="space-y-2">
		<div class="flex items-center gap-2">
			<span class="font-medium">Content:</span>
			<Badge color="green">{tile.content.name}</Badge>
		</div>

		<div class="flex items-center gap-2">
			<span class="font-medium">Walk Time:</span>
			<Badge color={tile.content.walkTime === Number.POSITIVE_INFINITY ? 'red' : 'yellow'}>
				{tile.content.walkTime === Number.POSITIVE_INFINITY ? 'Unwalkable' : tile.content.walkTime}
			</Badge>
		</div>

		{#if tile.content instanceof UnBuiltLand}
			<UnBuiltProperties content={tile.content} />
		{:else if tile.content instanceof Module}
			<ModuleProperties content={tile.content} />
		{/if}
	</div>
</div>

<style>
	.tile-properties {
		padding: 1rem;
	}
</style>
