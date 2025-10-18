<script lang="ts">
import Icon from '@iconify/svelte'
import { watch } from 'mutts/src'
import AlveolusFlag from '$components/parts/AlveolusFlag.svelte'
import PropertyGridRow from '$components/parts/PropertyGridRow.svelte'
import type { Game } from '$lib/game'
import type { Alveolus } from '$lib/game/board/content/alveolus'
import { m2s, p2s } from '$lib/mutts.svelte'

let { content }: { content: Alveolus } = $props()

// Create the reactive proxy
let alveolus: Alveolus = $derived(m2s(content))
function handleCleanUp() {
	// TODO: Implement clean up command
	console.log('Clean up command clicked')
}
</script>

{#if alveolus}
	<PropertyGridRow label="Commands">
		<div class="flex gap-2">
			<AlveolusFlag
				bind:checked={alveolus.working}
				icon="mdi:cog"
				name="Working"
				tooltip="Toggle working state"
			/>
			<button
				type="button"
				class="flex items-center gap-2 px-1 rounded-lg border transition-all duration-200 bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
				onclick={handleCleanUp}
				title="Clean up alveolus"
			>
				<Icon icon="mdi:broom" class="w-4 h-4 text-gray-500 dark:text-gray-400" />
				<span class="text-sm font-medium">Clean up</span>
			</button>
		</div>
	</PropertyGridRow>
{/if}
