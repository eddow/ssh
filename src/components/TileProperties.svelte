<script lang="ts">
	import type { Tile } from '$lib/game'
	import { UnBuiltLand, Module } from '$lib/game/hex/tile'
	import { Badge } from 'flowbite-svelte'
	import UnBuiltProperties from './UnBuiltProperties.svelte'
	import ModuleProperties from './ModuleProperties.svelte'
	import { ms } from '$lib/mutts.svelte'
	import { T } from '$lib/i18n'

	let { tile }: { tile: Tile } = $props()
	let tileContent = ms(() => tile.content)
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

			{#if $tileContent instanceof UnBuiltLand}
				<UnBuiltProperties content={$tileContent} />
			{:else if $tileContent instanceof Module}
				<ModuleProperties content={$tileContent} />
			{/if}
		</div>
	</div>
{/if}

<style>
	.tile-properties {
		padding: 1rem;
	}
</style>
