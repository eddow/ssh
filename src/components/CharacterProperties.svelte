<script lang="ts">
	import type { Character } from '$lib/game'
	import { Badge } from 'flowbite-svelte'

	let { character }: { character: Character } = $props()
</script>

<div class="character-properties">
	<h2 class="text-lg font-semibold mb-2">Character Properties</h2>

	<div class="space-y-2">
		<div class="flex items-center gap-2">
			<span class="font-medium">Name:</span>
			<Badge color="blue">{character.name}</Badge>
		</div>

		<div class="flex items-center gap-2">
			<span class="font-medium">Coordinates:</span>
			<Badge color="green">{character.coord.q}, {character.coord.r}</Badge>
		</div>

		<div class="flex items-center gap-2">
			<span class="font-medium">World Position:</span>
			<Badge color="purple">
				{Math.round(character.position.x)}, {Math.round(character.position.y)}
			</Badge>
		</div>
	</div>
</div>

<style>
	.character-properties {
		padding: 1rem;
	}
</style>
