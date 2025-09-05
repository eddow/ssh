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
	import { HexTile, InteractiveGameObject, Character } from '$lib/game'
	import { mrg, muttsArray, mns } from '$lib/globals.svelte'
	import { watch } from 'mutts'
	import TileProperties from '$components/TileProperties.svelte'
	import BuildingProperties from '$components/BuildingProperties.svelte'
	import CharacterProperties from '$components/CharacterProperties.svelte'

	let { uid }: { uid: string } = $props()
	let object: InteractiveGameObject | undefined = $state(undefined)
	let logLastLine = $state(true) // Flag to track if we should auto-scroll to last line
	let logsContainer: HTMLDivElement | undefined = $state(undefined)

	// Auto-scroll to bottom when new logs are added and logLastLine is true
	mns(() => {
		object = game.getObject(uid)
		return watch(
			() => object?.logs.entries(),
			() => {
				if (object && logLastLine && logsContainer) {
					// Use a small delay to ensure the DOM has updated
					setTimeout(() => {
						logsContainer?.scrollTo({
							top: logsContainer.scrollHeight,
							behavior: 'smooth'
						})
					}, 10)
				}
			}
		)
	})

	function handleLogScroll() {
		if (!logsContainer) return

		const { scrollTop, scrollHeight, clientHeight } = logsContainer
		const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5 // 5px tolerance
		logLastLine = isAtBottom
	}

	function goTo() {
		const { x, y } = object!.position
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
		<Button onclick={goTo} size="sm">
			<EyeOutline class="w-4 h-4" />
		</Button>
	</div>

	<div class="content">
		{#if object instanceof Character}
			<CharacterProperties character={object} />
		{:else if object instanceof HexTile}
			<TileProperties tile={object} />
			{#if object.building}
				<BuildingProperties tile={object} />
			{/if}
		{:else}
			<div class="error">
				<p>Unknown object type</p>
			</div>
		{/if}
	</div>

	{#if object}
		<div class="logs" bind:this={logsContainer} onscroll={handleLogScroll}>
			{#each muttsArray(object.logs) as line}
				<div class="log-line">{line}</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.selection-info {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.header {
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem;
		border-bottom: 1px solid #e5e7eb;
		border-bottom-color: rgb(229 231 235);
	}

	:global(.dark) .header {
		border-bottom-color: rgb(55 65 81);
	}

	.content {
		flex: 0 1 auto; /* Don't grow, can shrink, use natural size */
		overflow-y: auto;
		min-height: 0; /* Allow flex shrinking */
	}

	.logs {
		flex: 1; /* Take remaining space */
		min-height: 32px;
		overflow-y: auto;
		border-top: 1px solid #e5e7eb;
		padding: 0.5rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
			'Courier New', monospace;
		font-size: 0.75rem;
		background-color: rgb(249 250 251);
		border-top-color: rgb(229 231 235);
	}

	:global(.dark) .logs {
		background-color: rgb(31 41 55);
		border-top-color: rgb(55 65 81);
	}
	.log-line {
		white-space: pre-wrap;
		color: #374151; /* gray-700 */
	}

	:global(.dark) .log-line {
		color: white;
	}

	.error {
		padding: 1rem;
		color: #ef4444;
	}
</style>
