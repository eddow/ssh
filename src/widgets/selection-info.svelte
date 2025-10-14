<script lang="ts">
	import Icon from '@iconify/svelte'
	import type { DockviewPanelApi } from 'dockview-core'
	import { TabContent } from 'dockview-svelte/src'
	import { watch } from 'mutts/src'
	import { onDestroy } from 'svelte'
	import type { Writable } from 'svelte/store'
	import CharacterProperties from '$components/properties/CharacterProperties.svelte'
	import TileProperties from '$components/properties/TileProperties.svelte'
	import { type InteractiveGameObject } from '$lib/game'
	import { Tile } from '$lib/game/board/tile'
	import { Character } from '$lib/game/population/character'
	import {
		games,
		interactionMode,
		mrg,
		registerObjectInfoPanel,
		selectionState,
		unregisterObjectInfoPanel
	} from '$lib/globals.svelte'
	import { T } from '$lib/i18n'
	import { p2s } from '$lib/mutts.svelte'
	import { toWorldCoord } from '$lib/utils/position'

	let {
		uid,
		title,
		tabContent,
		panelApi
	}: {
		uid?: string
		title: Writable<string>
		tabContent: Writable<HTMLElement | null>
		panelApi: DockviewPanelApi
	} = $props()
	let object: InteractiveGameObject | undefined = $state(undefined)

	let logLastLine = $state(true) // Flag to track if we should auto-scroll to last line
	let logsContainer: HTMLDivElement | undefined = $state(undefined)
	const game = games.game('GameX')
	let logs = $state<string[]>([])

	// Auto-scroll to bottom when new logs are added and logLastLine is true
	$effect(() => {
		// For object-info panels, use the object from the parameters; otherwise use global selected object
		if (uid) {
			// Object-info panel: use the specific UID from parameters
			object = game.getObject(uid)
		} else {
			// Selection-info panel: use the global selected object UID
			object = selectionState.selectedUid ? game.getObject(selectionState.selectedUid) : undefined
		}

		if (object)
			return watch(object.logs, (newLogs) => {
				logs = [...newLogs]
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
		if (uid) {
			title.set(object?.title ?? $T.game.noSelection)
		} else {
			title.set(object?.title ?? `Unknown object ${uid || 'unknown'}`)
		}
	})

	// Manage panel registration
	$effect(() => {
		if (uid) {
			// Register this panel as an object-info panel
			registerObjectInfoPanel(uid, panelApi.id)
		} else {
			// Register this panel as the selection-info panel
			selectionState.panelId = panelApi.id
		}
	})
	onDestroy(() => {
		if (uid) {
			unregisterObjectInfoPanel(uid)
		} else {
			selectionState.panelId = undefined
		}
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
	function act(event: MouseEvent) {
		if (!object) return
		if (interactionMode.selectedAction) {
			game.simulateObjectClick(object, event)
		}
	}

	function pinToObjectInfo() {
		if (!object) return

		// Update the panel parameters to switch it to object-info mode
		panelApi.updateParameters({
			uid: object.uid
		})
		// Clear global selected object and panel ID
		selectionState.selectedUid = undefined
		selectionState.panelId = undefined
	}
</script>

<TabContent {panelApi} bind:el={$tabContent}>
	{#snippet right()}
		<Icon onclick={goTo} icon="mdi:eye" width="16" height="16" />
		{#if !uid && object}
			<Icon onclick={pinToObjectInfo} icon="mdi:pin" width="16" height="16" />
		{/if}
		{#if interactionMode.selectedAction && object?.canInteract?.(interactionMode.selectedAction)}
			<Icon onmousedown={act} icon="mdi:play" width="16" height="16" />
		{/if}
	{/snippet}
</TabContent>
<div class="selection-info" role="presentation" onmouseenter={mouseIn} onmouseleave={mouseOut}>
	<div class="content">
		{#if object instanceof Character}
			<CharacterProperties character={object} />
		{:else if object instanceof Tile}
			<TileProperties tile={object} />
		{:else}
			<div class="error">
				<p>Unknown object type</p>
			</div>
		{/if}
	</div>

	{#if object && logs}
		<div class="logs" bind:this={logsContainer} onscroll={handleLogScroll}>
			{#each logs as line}
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
