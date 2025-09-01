<script lang="ts">
	import { onMount } from 'svelte'
	import { Game } from '$lib/game'
	import type { AxialCoord } from '$lib/axial'
	import { debugInfo } from '$lib/globals.svelte'

	const props: { game: Game; size: { width: number; height: number } } = $props()

	const phaser = props.game.phaser
	const board = props.game.board

	let container = $state<HTMLDivElement>()
	$effect(() => {
		phaser.scale.resize(props.size.width, props.size.height)
	})

	onMount(() => {
		phaser.canvas.remove()
		container!.appendChild(phaser.canvas)
	})

	const boardEvents = {
		tileOver(event: any, coords: AxialCoord) {
			const tile = board.getTile(coords)
			debugInfo.tile = tile
				? {
						coord: coords,
						terrain: tile.terrain
					}
				: {}
		},
		tileOut(event: any, coords: AxialCoord) {
			debugInfo.tile = {}
		}
	}

	$effect(() => {
		board.on(boardEvents)

		return () => board.off(boardEvents)
	})
</script>

<div bind:this={container} style="width: 100%; height: 100%;"></div>
