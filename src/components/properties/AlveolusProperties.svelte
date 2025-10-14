<script lang="ts">
	import { Badge, Toggle } from 'flowbite-svelte'
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
	<PropertyGridRow label="Working">
		<Toggle bind:checked={alveolus.working} />
	</PropertyGridRow>
{/if}
