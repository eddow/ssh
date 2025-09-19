<script lang="ts">
	import type { Module } from '$lib/game/board/content'
	import type { Game } from '$lib/game'
	import { Badge } from 'flowbite-svelte'
	import ModuleFlag from './ModuleFlag.svelte'
	import GoodsList from './GoodsList.svelte'
	import { ms } from '$lib/mutts.svelte'
	import { T } from '$lib/i18n'

	let { content, game }: { content: Module; game: Game } = $props()
	let module = ms(content)
</script>

<div class="module-properties">
	<div class="space-y-2">
		<div class="flex items-center gap-2">
			<span class="font-medium">{$T.module.module}:</span>
			<Badge color="purple">{$module.name}</Badge>
		</div>

		<div class="flex items-center gap-2">
			<span class="font-medium">{$T.module.output}:</span>
			<GoodsList goods={$module.output} {game} itemSize={16} />
		</div>

		<div class="flex items-center gap-2">
			<span class="font-medium">{$T.goods}:</span>
			<Badge color="yellow">
				{$T.module.typesStored.replace(
					'{count}',
					Object.keys($module.goods).length.toString()
				)}</Badge
			>
		</div>

		<div class="flex items-center gap-2">
			<span class="font-medium">{$T.module.action}:</span>
			<Badge color="indigo">{$module.action.type}</Badge>
		</div>

		<div class="flex items-center gap-2">
			<span class="font-medium">{$T.module.workTime}:</span>
			<Badge color="indigo">{$module.workTime}s</Badge>
		</div>

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
</div>

<style>
	.module-properties {
		padding: 0.5rem 0;
	}
</style>
