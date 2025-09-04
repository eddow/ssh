<script lang="ts" module>
	export function title(params: Record<string, any>) {
		return `Game ${params.game}`
	}
</script>

<script lang="ts">
	import type { Writable } from 'svelte/store'
	import { onMount } from 'svelte'
	import { debugInfo, games } from '$lib/globals.svelte'
	import { type InteractiveGameObject, GameView } from '$lib/game'
	import { getDockviewContext } from '$components/dockview/dockview.svelte'

	const dvContext = getDockviewContext()
	let {
		size,
		game: gameName
	}: { size: Writable<{ width: number; height: number }>; game: string } = $props()

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

	const gameEvents = {
		objectOver(event: any, object: InteractiveGameObject) {
			const di = object.debugInfo
			if (di) debugInfo[object.title] = di
		},
		objectOut(event: any, object: InteractiveGameObject) {
			delete debugInfo[object.title]
		},
		objectDown(event: any, object: InteractiveGameObject, stopPropagation: () => void) {
			if (event.button === 0) {
				dvContext.addDock(
					'selection-info',
					{ uid: object.uid },
					{
						floating: true
					}
				)
				stopPropagation()
			}
		}
	}

	$effect(() => {
		game.on(gameEvents)

		return () => game.off(gameEvents)
	})
</script>

<div bind:this={container} style="width: 100%; height: 100%;"></div>
