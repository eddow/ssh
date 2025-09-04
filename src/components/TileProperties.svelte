<script lang="ts">
	import type { HexTile } from '$lib/game'
	import { Badge } from 'flowbite-svelte'

	let { tile }: { tile: HexTile } = $props()
</script>

<div class="tile-properties">
	<h2 class="text-lg font-semibold mb-2">Tile Properties</h2>

	<div class="space-y-2">
		<div class="flex items-center gap-2">
			<span class="font-medium">Coordinates:</span>
			<Badge color="blue">{tile.coord.q}, {tile.coord.r}</Badge>
		</div>

		<div class="flex items-center gap-2">
			<span class="font-medium">Terrain:</span>
			<Badge color="green">{tile.terrain}</Badge>
		</div>

		<div class="flex items-center gap-2">
			<span class="font-medium">Walk Time:</span>
			<Badge color={tile.walkTime === Number.POSITIVE_INFINITY ? 'red' : 'yellow'}>
				{tile.walkTime === Number.POSITIVE_INFINITY ? 'Unwalkable' : tile.walkTime}
			</Badge>
		</div>

		{#if tile.deposit}
			<div class="flex items-center gap-2">
				<span class="font-medium">Deposit:</span>
				<Badge color="purple">{tile.deposit.name}</Badge>
				<Badge color="blue">{tile.deposit.amount}</Badge>
			</div>
		{/if}

		{#if tile.building}
			<div class="flex items-center gap-2">
				<span class="font-medium">Building:</span>
				<Badge color="indigo">{tile.building.name}</Badge>
			</div>
		{/if}

		{#if tile.getAllGoods().length > 0}
			<div class="flex items-center gap-2">
				<span class="font-medium">Goods:</span>
				<div class="flex flex-wrap gap-1">
					{#each tile.getAllGoods() as good}
						<Badge color="yellow">{good}</Badge>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.tile-properties {
		padding: 1rem;
	}
</style>
