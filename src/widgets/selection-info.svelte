<script lang="ts">
	import { games, interactionMode } from '$lib/globals.svelte'
	import { Button } from 'flowbite-svelte'
	import Icon from '@iconify/svelte'
	import { HexTile, type InteractiveGameObject, Character } from '$lib/game'
	import { mrg } from '$lib/globals.svelte'
	import { m2s, mns } from '$lib/mutts.svelte'
	import { watch } from 'mutts'
	import TileProperties from '$components/TileProperties.svelte'
	import CharacterProperties from '$components/CharacterProperties.svelte'
	import { toWorldCoord } from '$lib/game/position'
	import type { Writable } from 'svelte/store'
	import { T } from '$lib/i18n'
	import { TabContent } from 'dockview-svelte/src'
	import type { DockviewPanelApi } from 'dockview-core'

	let {
		uid,
		title,
		tabContent,
		panelApi
	}: {
		uid: string
		title: Writable<string>
		tabContent: Writable<HTMLElement | null>
		panelApi: DockviewPanelApi
	} = $props()
	let object: InteractiveGameObject | undefined = $state(undefined)
	let logLastLine = $state(true) // Flag to track if we should auto-scroll to last line
	let logsContainer: HTMLDivElement | undefined = $state(undefined)
	const game = games.game('GameX')

	// Auto-scroll to bottom when new logs are added and logLastLine is true
	mns(() => {
		object = game.getObject(uid)
		if (object)
			return watch(object.logs, () => {
				if (object && logLastLine && logsContainer) {
					// Use a small delay to ensure the DOM has updated
					setTimeout(() => {
						logsContainer?.scrollTo({
							top: logsContainer.scrollHeight,
							behavior: 'smooth'
						})
					}, 10)
				}
			})
	})
	$effect(() => {
		title.set(object?.title ?? $T.game.unknownObject({ uid }))
	})

	function handleLogScroll() {
		if (!logsContainer) return

		const { scrollTop, scrollHeight, clientHeight } = logsContainer
		const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5 // 5px tolerance
		logLastLine = isAtBottom
	}

	function goTo() {
		const { x, y } = toWorldCoord(object!.position)
		game.gameView?.stage.position.set(-x, -y)
	}
	function mouseIn() {
		mrg.hoveredObject = object
	}
	function mouseOut() {
		if (mrg.hoveredObject === object) mrg.hoveredObject = undefined
	}
	function act() {
		if (!object) return
		if (interactionMode.selectedAction) {
			game.simulateObjectClick(object)
		}
	}
</script>

<TabContent {panelApi} bind:el={$tabContent}>
	{#snippet right()}
		<Icon onclick={goTo} icon="mdi:eye" width="16" height="16" />
		{#if interactionMode.selectedAction && object?.canInteract?.(interactionMode.selectedAction)}
			<Button onclick={act} size="sm">
				<Icon icon="mdi:play" width="16" height="16" />
			</Button>
		{/if}
	{/snippet}
</TabContent>
<div class="selection-info" role="presentation" onmouseenter={mouseIn} onmouseleave={mouseOut}>
	<div class="content">
		{#if object instanceof Character}
			<CharacterProperties character={object} />
		{:else if object instanceof HexTile}
			<TileProperties tile={object} />
		{:else}
			<div class="error">
				<p>{$T.game.unknownObjectType}</p>
			</div>
		{/if}
	</div>

	{#if object}
		<div class="logs" bind:this={logsContainer} onscroll={handleLogScroll}>
			{#each m2s(object.logs) as line}
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
