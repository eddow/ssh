<script lang="ts">
import EntityBadge from '$components/parts/EntityBadge.svelte'
import PropertyGridRow from '$components/parts/PropertyGridRow.svelte'
import type { UnBuiltLand } from '$lib/game/board/content/unbuilt-land'
import { T } from '$lib/i18n'
import { p2s } from '$lib/mutts.svelte'

let { content }: { content: UnBuiltLand } = $props()
const game = content.tile.board.game
const deposit = $derived.by(
	p2s(
		() =>
			content.deposit && {
				sprites: content.deposit.sprites,
				name: content.deposit.name,
				amount: content.deposit.amount,
			},
	),
)
</script>

{#if deposit}
	<PropertyGridRow label={$T.deposit} class="flex items-center">
		<EntityBadge
			{game}
			height={16}
			sprite={deposit.sprites[0]}
			text={$T.deposits[deposit.name!]}
			qty={deposit.amount}
		/>
	</PropertyGridRow>
{/if}
