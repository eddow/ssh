<script lang="ts">
	import type { Module } from '$lib/game/board/content/module'
	import type { Game } from '$lib/game'
	import { Badge } from 'flowbite-svelte'
	import ModuleFlag from '$components/parts/ModuleFlag.svelte'
	import PropertyGridRow from '$components/parts/PropertyGridRow.svelte'
	import ResourceImage from '$components/parts/resourceImage.svelte'
	import { ms } from '$lib/mutts.svelte'
	import { T } from '$lib/i18n'

	let { content, game }: { content: Module; game: Game } = $props()
	let module = ms(content)
	// TODO: property grid per action type
</script>

<PropertyGridRow label={$T.module.module}>
	<ResourceImage height={20} {game} sprite={$module.sprites[0]} alt={$T.modules[$module.name!]} />
</PropertyGridRow>

<PropertyGridRow label={$T.module.action}>
	<Badge color="indigo">{$module.action.type}</Badge>
</PropertyGridRow>

<PropertyGridRow label={$T.module.workTime}>
	<Badge color="indigo">{$module.workTime}s</Badge>
</PropertyGridRow>

<PropertyGridRow label={$T.module.configuration}>
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
</PropertyGridRow>
