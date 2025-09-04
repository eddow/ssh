<script lang="ts" module>
	const game = games.game('GameX')
	export function title({ uid }: Record<string, any>) {
		const obj = game.getObject(uid)
		return obj?.title ?? `Unknown object ${uid}`
	}
</script>

<script lang="ts">
	import { games } from '$lib/globals.svelte'
	import { Button } from 'flowbite-svelte'
	import { EyeOutline } from 'flowbite-svelte-icons'
	import { HexTile, InteractiveGameObject } from '$lib/game'
	import { mrg } from '$lib/globals.svelte'
	import { effect, unwrap } from 'mutts'
	let { uid }: { uid: string } = $props()
	let object: InteractiveGameObject | undefined = $state(undefined)
	effect(() => {
		object = game.getObject(uid)
	})

	function goTo() {
		const { x, y } = object!.worldPosition
		game.stage.position.set(-x, -y)
	}
	function mouseIn() {
		mrg.hoveredObject = object
	}
	function mouseOut() {
		if (mrg.hoveredObject === object) mrg.hoveredObject = undefined
	}
</script>

<div class="tile-info" role="presentation" onmouseenter={mouseIn} onmouseleave={mouseOut}>
	{#if object instanceof HexTile}
		<h1>{object.coord.q}, {object.coord.r}</h1>
		<h3>{object.terrain}</h3>
	{:else}
		<error>Unknown object</error>
	{/if}
	<Button onclick={goTo}>
		<EyeOutline class="w-6 h-6" />
	</Button>
</div>

<style>
	.tile-info {
		width: 100%;
		height: 100%;
	}
</style>
