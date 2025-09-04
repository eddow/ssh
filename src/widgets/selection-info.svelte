<script lang="ts" module>
	const game = games.game('GameX')
	export function title(params: Record<string, any>) {
		return `Tile`
	}
</script>

<script lang="ts">
	import { games } from '$lib/globals.svelte'
	import { Button } from 'flowbite-svelte'
	import { EyeOutline } from 'flowbite-svelte-icons'
	import { HexTile, InteractiveGameObject } from '$lib/game'
	import { effect } from 'mutts'
	let { uid }: { uid: string } = $props()
	let object: InteractiveGameObject | undefined = $state(undefined)
	effect(() => {
		object = game.getObject(uid)
	})

	function goTo() {
		const { x, y } = object!.worldPosition
		game.stage.position.set(-x, -y)
	}
</script>

<div class="tile-info">
	{#if object instanceof HexTile}
		<h1>{object.worldPosition}</h1>
		<h3>{object.terrain}</h3>
		{object.squares}
	{:else}
		<error>Unknown object</error>
	{/if}
	<Button onclick={goTo}>
		<EyeOutline class="w-6 h-6" />
	</Button>
</div>
