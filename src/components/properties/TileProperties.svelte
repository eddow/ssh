<script lang="ts">
import { Badge } from 'flowbite-svelte'
import GoodsList from '$components/parts/GoodsList.svelte'
import PropertyGrid from '$components/parts/PropertyGrid.svelte'
import PropertyGridRow from '$components/parts/PropertyGridRow.svelte'
import AlveolusProperties from '$components/properties/AlveolusProperties.svelte'
import UnBuiltProperties from '$components/properties/UnBuiltProperties.svelte'
import { Alveolus } from '$lib/game/board/content/alveolus'
import { UnBuiltLand } from '$lib/game/board/content/unbuilt-land'
import type { Tile } from '$lib/game/board/tile'
import { T } from '$lib/i18n'
import { p2s } from '$lib/mutts.svelte'

let { tile }: { tile: Tile } = $props()
let tileContent = $derived.by(p2s(() => tile.content))
let stock = $derived.by(p2s(() => tile.content!.storage?.stock))
// TODO: terrain type as background color
// TODO: display freeGoods
</script>

{#if tileContent}
	<div class="tile-properties">
		<div class="space-y-2">
			<div class="flex items-center gap-2">
				<span class="font-medium">{$T.tile.content}:</span>
				<Badge color="green">{tileContent.constructor.name}</Badge>
			</div>

			<div class="flex items-center gap-2">
				<span class="font-medium">{$T.tile.walkTime}:</span>
				<Badge color={tileContent.walkTime === Number.POSITIVE_INFINITY ? 'red' : 'yellow'}>
					{tileContent.walkTime === Number.POSITIVE_INFINITY
						? $T.tile.unwalkable
						: tileContent.walkTime}
				</Badge>
			</div>
			<PropertyGrid>
				{#if stock}
					<PropertyGridRow label={$T.goods}>
						<GoodsList goods={stock} game={tile.board.game} />
					</PropertyGridRow>
				{/if}

				{#if tileContent instanceof UnBuiltLand}
					<UnBuiltProperties content={tileContent} />
				{:else if tileContent instanceof Alveolus}
					<AlveolusProperties content={tileContent} game={tile.board.game} />
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
