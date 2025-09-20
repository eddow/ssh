<script lang="ts">
	import type { UnBuiltLand } from '$lib/game/board/content'
	import { T } from '$lib/i18n'
	import EntityBadge from '$components/parts/EntityBadge.svelte'
	import PropertyGridRow from '$components/parts/PropertyGridRow.svelte'
	import { ms } from '$lib/mutts.svelte'

	let { content }: { content: UnBuiltLand } = $props()
	const game = content.tile.hex.game
	const deposit = $derived(ms(() => content.deposit, true))
	//TODO:
	// - Badge does not refresh
	// - Badge takes all line
	// - When killing the deposit, doesn't go to drop afterward
</script>

{#if $deposit}
	<PropertyGridRow label={$T.deposit} class="flex items-center">
		<EntityBadge
			{game}
			sprite={$deposit.sprites[0]}
			text={$T.deposits[$deposit.name!]}
			qty={$deposit.amount}
		/>
	</PropertyGridRow>
{/if}
