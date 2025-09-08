<script lang="ts">
	import type { Character } from '$lib/game'
	import { Badge } from 'flowbite-svelte'
	import StatProgressBar from './StatProgressBar.svelte'
	import { ms, m2s } from '$lib/mutts.svelte'

	let { character }: { character: Character } = $props()
	const actions = ms(character.activityManager.descriptions)
	const bars = ms(() => ({
		hunger: character.hunger,
		sleepiness: character.sleepiness,
		fatigue: character.fatigue,
		triggerLevels: character.triggerLevels
	}))

	//	let mct = $derived(m2s(character))

	//{mct.fatigue}
</script>

<div class="character-properties">
	{#if $bars.triggerLevels}
		<div class="mt-4">
			<h3 class="font-medium mb-3">Character Stats</h3>
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
				<StatProgressBar value={$bars.hunger} levels={$bars.triggerLevels.hunger} label="Hunger" />
				<StatProgressBar
					value={$bars.sleepiness}
					levels={$bars.triggerLevels.sleepiness}
					label="Sleepiness"
				/>
				<StatProgressBar
					value={$bars.fatigue}
					levels={$bars.triggerLevels.fatigue}
					label="Fatigue"
				/>
			</div>
		</div>
	{/if}

	<div class="mt-4">
		<div class="space-y-2">
			<div class="flex items-center gap-2">
				<span class="font-medium">Current Activity:</span>
				<Badge color="blue">{character.activityManager.activity || 'Idle'}</Badge>
			</div>
			<div class="flex flex-col gap-1">
				<span class="font-medium">Activity Descriptions:</span>
				{#if $actions.length > 0}
					<ul
						class="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 space-y-1"
					>
						{#each $actions as description}
							<li class="flex items-center gap-2">
								<span>{description}</span>
							</li>
						{/each}
					</ul>
				{:else}
					<div
						class="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 italic"
					>
						No activity
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.character-properties {
		padding: 1rem;
	}
</style>
