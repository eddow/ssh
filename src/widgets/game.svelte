<script lang="ts" module>
	export function title(params: Record<string, any>) {
		return `Game ${params.game}`
	}
</script>

<script lang="ts">
	import type { Writable } from 'svelte/store'
	import { Game } from '$lib/game'
	import GameView from '$components/gameView.svelte'
	let { size }: { size: Writable<{ width: number; height: number }> } = $props()

	const game = new Game()
	let initialized = $state(false)

	game.phaser.events.on('sceneReady', () => {
		initialized = true
	})
</script>

{#if initialized}
	<GameView {game} size={$size} />
{/if}
