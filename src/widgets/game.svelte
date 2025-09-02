<script lang="ts" module>
	import { Button } from 'flowbite-svelte'
	export function title(params: Record<string, any>) {
		return `Game ${params.game}`
	}
</script>

<script lang="ts">
	import type { Writable } from 'svelte/store'
	import { onMount } from 'svelte'
	import { debugInfo } from '$lib/globals.svelte'
	import { play } from '$lib/globals.svelte'
	import type { InteractiveGameObject } from '$lib/game'
	import { getDockviewContext } from '$components/dockview/dockview.svelte'

	const dvContext = getDockviewContext()
	let {
		size,
		game: gameName
	}: { size: Writable<{ width: number; height: number }>; game: string } = $props()

	const game = play(gameName)
	const phaser = game.phaser

	let container = $state<HTMLDivElement>()
	size.subscribe(({ width, height }) => {
		phaser.scale.resize(width, height)
	})

	onMount(() => {
		phaser.canvas.remove()
		container!.appendChild(phaser.canvas)
	})

	const gameEvents = {
		objectOver(event: any, object: InteractiveGameObject) {
			debugInfo.hover = object
		},
		objectOut(event: any, object: InteractiveGameObject) {
			delete debugInfo.hover
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
