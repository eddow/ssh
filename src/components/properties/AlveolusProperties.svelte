<script lang="ts">
import { Badge } from 'flowbite-svelte'
import AlveolusFlag from '$components/parts/AlveolusFlag.svelte'
import PropertyGridRow from '$components/parts/PropertyGridRow.svelte'
import ResourceImage from '$components/parts/resourceImage.svelte'
import type { Game } from '$lib/game'
import type { Alveolus } from '$lib/game/board/content/alveolus'
import { T } from '$lib/i18n'
import { p2s } from '$lib/mutts.svelte'

let { content, game }: { content: Alveolus; game: Game } = $props()
let alveolus = $derived.by(p2s(() => content))
// TODO: property grid per action type
</script>

{#if alveolus}
	<PropertyGridRow label={$T.alveolus.alveolus}>
		<ResourceImage
			height={20}
			{game}
			sprite={alveolus.sprites[0]}
			alt={$T.alveoli[alveolus.name!]}
		/>
	</PropertyGridRow>

	<PropertyGridRow label={$T.alveolus.action}>
		<Badge color="indigo">{alveolus.action.type}</Badge>
	</PropertyGridRow>

	<PropertyGridRow label={$T.alveolus.workTime}>
		<Badge color="indigo">{alveolus.workTime}s</Badge>
	</PropertyGridRow>

	<PropertyGridRow label={$T.alveolus.configuration}>
		<div class="flex gap-2">
			<AlveolusFlag
				bind:checked={alveolus.walkway}
				icon="mdi:walk"
				name={$T.alveolus.walkway}
				tooltip={$T.alveolus.walkwayTooltip}
			/>

			<AlveolusFlag
				bind:checked={alveolus.conveyor}
				icon="material-symbols:conveyor-belt"
				name={$T.alveolus.conveyor}
				tooltip={$T.alveolus.conveyorTooltip}
			/>
		</div>
	</PropertyGridRow>
{/if}
