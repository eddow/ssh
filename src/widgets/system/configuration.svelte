<script lang="ts" module>
	export function title(params: Record<string, any>) {
		return `Configuration`
	}
</script>

<script lang="ts">
	//https://uxwing.com/?s=Mouse+left+
	//https://boxy-svg.com/

	import { Alert } from 'flowbite-svelte'
	import DarkMode from '$components/dark-mode.svelte'
	import { configuration } from '$lib/globals.svelte'

	let darkMode = $state(configuration.darkMode)

	$effect(() => {
		configuration.darkMode = darkMode
	})

	$effect(() => {
		localStorage.setItem('configuration', JSON.stringify(configuration))
	})
</script>

<DarkMode bind:darkMode />
<Alert>
	<p>Wheel = zoom + look-at</p>
	<p>Both left+right down = pan</p>
</Alert>
