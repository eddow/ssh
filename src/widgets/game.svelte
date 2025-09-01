<script lang="ts" module>
	export function title(params: Record<string, any>) {
		return `Game ${params.game}`
	}
</script>

<script lang="ts">
	import { onMount } from 'svelte'
	import type { Writable } from 'svelte/store'
	import { Game } from '$lib/game'
	let container = $state<HTMLDivElement>()
	let { size }: { size: Writable<{ width: number; height: number }> } = $props()

	let game: Game = null!
	let phaser: Phaser.Game = null!

	onMount(() => {
		game = new Game()
		phaser = game.phaser
		// Prevent context menu on the canvas
		phaser.canvas.addEventListener('contextmenu', (e) => {
			e.preventDefault()
		})

		size.subscribe(({ width, height }) => {
			phaser.scale.resize(width, height)
		})
		phaser.canvas.remove()
		container!.appendChild(phaser.canvas)
	})
</script>

<div bind:this={container} style="width: 100%; height: 100%;"></div>
