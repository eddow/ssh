<script lang="ts">
	import type { UnBuiltLand } from '$lib/game/board/content'
	import type { GoodType } from '$lib/arktype'
	import { goods } from '$assets/game-content'
	import { Badge } from 'flowbite-svelte'
	import { T } from '$lib/i18n'
	import EntityBadge from './EntityBadge.svelte'

	let { content }: { content: UnBuiltLand } = $props()
	const game = content.tile.hex.game

	//TODO:
	// - Badge does not refresh
	// - Badge takes all line
	// - When killing the deposit, doesn't go to drop afterward
</script>

<div class="unbuilt-properties">
	<div class="space-y-2">
		{#if content.deposit}
			<EntityBadge
				{game}
				sprite={content.deposit.sprites[0]}
				text={content.deposit.name || '?'}
				qty={content.deposit.amount}
			/>
			<div class="flex items-center gap-2">
				<span class="font-medium">{$T.deposit}:</span>
				<Badge color="purple">{content.deposit.name}</Badge>
				<Badge color="blue">{content.deposit.amount}</Badge>
			</div>
		{/if}
	</div>
</div>

<style>
	.unbuilt-properties {
		padding: 0.5rem 0;
	}
</style>
