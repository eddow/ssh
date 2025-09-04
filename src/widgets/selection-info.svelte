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
	import TileProperties from '$components/TileProperties.svelte'
	import BuildingProperties from '$components/BuildingProperties.svelte'

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

<div class="selection-info" role="presentation" onmouseenter={mouseIn} onmouseleave={mouseOut}>
	<div class="header">
		<h1 class="text-xl font-bold">{object?.title || 'Unknown Object'}</h1>
		<Button onclick={goTo} size="sm">
			<EyeOutline class="w-4 h-4" />
		</Button>
	</div>

	<div class="content">
		{#if object instanceof HexTile}
			{#if object.building}
				<BuildingProperties tile={object} />
			{:else}
				<TileProperties tile={object} />
			{/if}
		{:else}
			<div class="error">
				<p>Unknown object type</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.selection-info {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.content {
		flex: 1;
		overflow-y: auto;
	}

	.error {
		padding: 1rem;
		color: #ef4444;
	}
</style>
