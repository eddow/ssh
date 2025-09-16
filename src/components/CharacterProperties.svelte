<script lang="ts">
	import type { Character } from '$lib/game'
	import { Badge } from 'flowbite-svelte'
	import StatProgressBar from './StatProgressBar.svelte'
	import { ms, m2s } from '$lib/mutts.svelte'
	import { T } from '$lib/i18n'
	let { character }: { character: Character } = $props()
	const actions = ms(() => character.actionDescription, true)
	const state = ms(() => ({
		hunger: character.hunger,
		Tiredness: character.tiredness,
		fatigue: character.fatigue,
		triggerLevels: character.triggerLevels,
		stepDescription: character.stepExecutor?.type
	}))
</script>

<div class="character-properties">
	{#if $state.triggerLevels}
		<div class="mt-4">
			<h3 class="font-medium mb-3">{$T.character.characterStats}</h3>
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
				<StatProgressBar
					value={$state.hunger}
					levels={$state.triggerLevels.hunger}
					label={$T.character.hunger}
				/>
				<StatProgressBar
					value={$state.Tiredness}
					levels={$state.triggerLevels.tiredness}
					label={$T.character.tiredness}
				/>
				<StatProgressBar
					value={$state.fatigue}
					levels={$state.triggerLevels.fatigue}
					label={$T.character.fatigue}
				/>
			</div>
		</div>
	{/if}

	<div class="mt-4">
		<div class="space-y-2">
			<div class="flex items-center gap-2">
				<span class="font-medium">{$T.character.currentActivity}:</span>
				<Badge color="blue">{$state.stepDescription ?? $T.character.idle}</Badge>
			</div>
			<div class="flex flex-col gap-1">
				<span class="font-medium">{$T.character.activityDescriptions}:</span>
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
						{$T.character.noActivity}
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
