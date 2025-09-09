<script lang="ts">
	import type { Module } from '$lib/game/tile'
	import { Badge } from 'flowbite-svelte'
	import ModuleFlag from './ModuleFlag.svelte'
	import { ms } from '$lib/mutts.svelte'

	let { content }: { content: Module } = $props()
	let module = ms(content)
</script>

<div class="module-properties">
	<div class="space-y-2">
		<div class="flex items-center gap-2">
			<span class="font-medium">Module:</span>
			<Badge color="purple">{$module.name}</Badge>
		</div>

		<div class="flex items-center gap-2">
			<span class="font-medium">Output:</span>
			<Badge color="blue">{$module.output}</Badge>
		</div>

		<div class="flex items-center gap-2">
			<span class="font-medium">Goods:</span>
			<Badge color="yellow">{Object.keys($module.goods).length} types stored</Badge>
		</div>

		<div class="flex items-center gap-2">
			<span class="font-medium">Workers:</span>
			<Badge color="green">{$module.assignedWorker ? '1' : '0'} / {$module.maxWorkers}</Badge>
		</div>

		<div class="flex items-center gap-2">
			<span class="font-medium">Action:</span>
			<Badge color="indigo">{$module.action.type}</Badge>
		</div>

		<div class="flex items-center gap-2">
			<span class="font-medium">Time:</span>
			<Badge color="indigo">{$module.time}s</Badge>
		</div>

		<!-- Configurable Properties -->
		<div class="border-t pt-3 mt-3">
			<h4 class="font-medium text-sm text-gray-600 dark:text-gray-400 mb-3">Configuration</h4>

			<div class="flex gap-2">
				<ModuleFlag
					bind:checked={$module.walkway}
					icon="mdi:walk"
					name="Walkway"
					tooltip="Allow characters to walk through this module"
				/>

				<ModuleFlag
					bind:checked={$module.conveyor}
					icon="material-symbols:conveyor-belt"
					name="Conveyor"
					tooltip="Allow unrelated goods to pass through this module"
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
