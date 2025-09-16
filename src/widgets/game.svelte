<script lang="ts">
	import type { Readable, Writable } from 'svelte/store'
	import { onMount, onDestroy } from 'svelte'
	import { debugInfo, games, interactionMode } from '$lib/globals.svelte'
	import { type InteractiveGameObject, GameView } from '$lib/game'
	import { getDockviewContext } from 'dockview-svelte/src'
	import { HexTile } from '$lib/game/hexboard'
	import { T } from '$lib/i18n'
	const dvContext = getDockviewContext()
	let {
		size,
		game: gameName,
		title
	}: {
		size: Readable<{ width: number; height: number }>
		game: string
		title: Writable<string>
	} = $props()

	$effect(() => {
		title.set($T.game.gameTitle({ game: gameName }))
	})

	const game = games.game(gameName)
	let gameView = $state<GameView | undefined>(undefined)
	size.subscribe((size) => {
		if (gameView) {
			gameView.stage.pivot.set(-size.width / 2, -size.height / 2)
			if (gameView.pixi?.renderer) gameView.pixi.renderer.resize(size.width, size.height)
		}
	})

	let container = $state<HTMLDivElement>()

	onMount(() => {
		// Remove the canvas from wherever it might be
		gameView = new GameView(game, container!)
	})

	onDestroy(() => {
		// Clean up PixiJS resources when component is destroyed
		if (gameView) {
			gameView.destroy()
		}
	})

	// Handle HMR reloads
	if (import.meta.hot) {
		import.meta.hot.accept(() => {
			// Reload the entire PixiJS infrastructure on HMR
			if (gameView) {
				gameView.reload()
			}
		})
	}

	const gameEvents = {
		objectClick(event: MouseEvent, object: InteractiveGameObject) {
			if (event.button === 0) {
				// Check if we're in building mode
				if (interactionMode.selectedAction.startsWith('build:')) {
					handleBuildingAction(object)
				} else {
					// Default behavior: show selection info
					dvContext.addDock(
						'selection-info',
						{ uid: object.uid },
						{
							floating: true
						}
					)
				}
			}
		}
	}

	function handleBuildingAction(object: InteractiveGameObject) {
		// Only allow building on hex tiles
		if (!(object instanceof HexTile)) return

		const tile = object as HexTile
		const action = interactionMode.selectedAction

		// Extract module type from action (e.g., "build:sawmill" -> "sawmill")
		const moduleType = action.replace('build:', '')

		// Use the tile's build method
		const success = tile.build(moduleType)

		if (success) {
			// Reset to selection mode
			interactionMode.selectedAction = ''
		}
	}

	$effect(() => {
		game.on(gameEvents)

		return () => game.off(gameEvents)
	})
</script>

<div bind:this={container} style="width: 100%; height: 100%;"></div>
