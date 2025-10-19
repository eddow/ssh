<script lang="ts">
import Icon from '@iconify/svelte'
import { getDockviewContext } from 'dockview-svelte/src'
import { Button } from 'flowbite-svelte'
import { watch } from 'mutts/src'
import AlveolusFlag from '$components/parts/AlveolusFlag.svelte'
import PropertyGridRow from '$components/parts/PropertyGridRow.svelte'
import type { Game } from '$lib/game'
import type { Alveolus } from '$lib/game/board/content/alveolus'
import { T } from '$lib/i18n'
import { m2s, p2s } from '$lib/mutts.svelte'
import { toAxialCoord } from '$lib/utils/position'

const { addDock, api, showUniqueDock, toggleUniqueDock, registerComponent } = getDockviewContext()
const context = { addDock, api, showUniqueDock, toggleUniqueDock, registerComponent }

let { content }: { content: Alveolus } = $props()

// Create the reactive proxy
let alveolus: Alveolus = $derived(m2s(content))

// Check if storage is not empty
let isStorageEmpty = $derived(alveolus.storage.isEmpty)

async function handleCleanUp() {
	const coord = toAxialCoord(alveolus.tile.position)
	/*const confirmed = await showCleanupConfirmation(
		alveolus.name,
		`tile:${coord.q},${coord.r}`,
		context,
	)
	if (confirmed) {
		// TODO: Implement cleanup logic when user confirms
		console.log('Clean up confirmed for alveolus:', alveolus.name)
	}*/
}
</script>

{#if alveolus}
	<PropertyGridRow label={$T.alveolus.commands}>
		<div class="flex gap-2">
			<AlveolusFlag
				bind:checked={alveolus.working}
				icon="mdi:cog"
				name={$T.alveolus.working}
				tooltip={$T.alveolus.workingTooltip}
			/>
			{#if !isStorageEmpty}
				<Button color="red" size="sm" onclick={handleCleanUp} title={$T.alveolus.cleanUpTooltip}>
					<Icon icon="mdi:broom" class="w-4 h-4" />
					<span class="ml-1">{$T.alveolus.cleanUp}</span>
				</Button>
			{/if}
		</div>
	</PropertyGridRow>
{/if}
