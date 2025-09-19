<script lang="ts">
	import type { Module } from '$lib/game/board/content'
	import type { Game } from '$lib/game'
	import { Badge } from 'flowbite-svelte'
	import ModuleFlag from '$components/parts/ModuleFlag.svelte'
	import GoodsList from '$components/parts/GoodsList.svelte'
	import PropertyGrid from '$components/parts/PropertyGrid.svelte'
	import PropertyGridRow from '$components/parts/PropertyGridRow.svelte'
	import { ms } from '$lib/mutts.svelte'
	import { T } from '$lib/i18n'

	let { content, game }: { content: Module; game: Game } = $props()
	let module = ms(content)
</script>

<div class="module-properties">
	<PropertyGrid>
		{#snippet children()}
			<PropertyGridRow label={$T.module.module}>
				{#snippet children()}
					<Badge color="purple">{$module.name}</Badge>
				{/snippet}
			</PropertyGridRow>

			<PropertyGridRow label={$T.module.output}>
				{#snippet children()}
					<GoodsList goods={$module.output} {game} itemSize={16} />
				{/snippet}
			</PropertyGridRow>

			<PropertyGridRow label={$T.module.action}>
				{#snippet children()}
					<Badge color="indigo">{$module.action.type}</Badge>
				{/snippet}
			</PropertyGridRow>

			<PropertyGridRow label={$T.module.workTime}>
				{#snippet children()}
					<Badge color="indigo">{$module.workTime}s</Badge>
				{/snippet}
			</PropertyGridRow>
		{/snippet}
	</PropertyGrid>

	<!-- Configurable Properties -->
	<div class="border-t pt-3 mt-3">
		<h4 class="font-medium text-sm text-gray-600 dark:text-gray-400 mb-3">
			{$T.module.moduleConfiguration}
		</h4>

		<div class="flex gap-2">
			<ModuleFlag
				bind:checked={$module.walkway}
				icon="mdi:walk"
				name={$T.module.walkway}
				tooltip={$T.module.walkwayTooltip}
			/>

			<ModuleFlag
				bind:checked={$module.conveyor}
				icon="material-symbols:conveyor-belt"
				name={$T.module.conveyor}
				tooltip={$T.module.conveyorTooltip}
			/>
		</div>
	</div>
</div>

<style>
	.module-properties {
		padding: 0.5rem 0;
	}
</style>
